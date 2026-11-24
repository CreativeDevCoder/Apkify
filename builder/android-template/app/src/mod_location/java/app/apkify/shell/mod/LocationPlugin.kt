package app.apkify.shell.mod

import android.Manifest
import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.Location
import android.os.Build
import android.os.Looper
import androidx.core.content.ContextCompat
import app.apkify.shell.MainActivity
import app.apkify.shell.Plugin
import app.apkify.shell.Reply
import app.apkify.shell.str
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import org.json.JSONArray
import org.json.JSONObject

/**
 * Lokasi presisi (Fused Location), pantau lokasi selama aplikasi dibuka, geofence untuk absensi
 * (masuk/keluar area + cek di dalam radius), deteksi Fake GPS / mock location, dan pengenalan aktivitas
 * (diam, jalan, lari, sepeda, kendaraan). Tanpa izin lokasi latar belakang.
 */
@SuppressLint("MissingPermission")
class LocationPlugin(host: MainActivity) : Plugin(host) {
    override val prefixes = setOf("location", "geofence", "activity")
    override fun enabled(prefix: String) = when (prefix) {
        "activity" -> cfg.on("activityRecognition"); "geofence" -> cfg.on("geofence"); else -> cfg.on("locationApi") || cfg.on("geofence")
    }

    private val client by lazy { LocationServices.getFusedLocationProviderClient(host) }
    private var watchCb: LocationCallback? = null
    private var fences = JSONArray()
    private val inside = HashSet<String>()
    private var actRcv: BroadcastReceiver? = null
    private var actPi: PendingIntent? = null

    private fun perm(go: () -> Unit, r: Reply) = host.requestPerms(listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), any = true) { ok ->
        if (ok) go() else r.err("izin lokasi ditolak")
    }

    private fun json(l: Location) = JSONObject().put("lat", l.latitude).put("lng", l.longitude).put("accuracy", l.accuracy.toDouble())
        .put("altitude", l.altitude).put("speed", l.speed.toDouble()).put("bearing", l.bearing.toDouble()).put("time", l.time)
        .put("mock", if (Build.VERSION.SDK_INT >= 31) l.isMock else @Suppress("DEPRECATION") l.isFromMockProvider)
        .put("provider", l.provider ?: "")

    private fun priority(a: JSONObject) = if (a.str("accuracy", "high") == "high") Priority.PRIORITY_HIGH_ACCURACY else Priority.PRIORITY_BALANCED_POWER_ACCURACY

    override fun handle(prefix: String, cmd: String, a: JSONObject, r: Reply) {
        when ("$prefix.$cmd") {
            "location.current" -> perm({
                client.getCurrentLocation(priority(a), CancellationTokenSource().token)
                    .addOnSuccessListener { l -> if (l == null) r.err("lokasi tidak tersedia (GPS mati?)") else r.ok(json(l)) }
                    .addOnFailureListener { r.err(it.message ?: "gagal") }
            }, r)
            "location.watch" -> perm({ watch(a); r.ok() }, r)
            "location.stop" -> { stopWatch(); r.ok() }
            "location.distance" -> {
                val out = FloatArray(1)
                Location.distanceBetween(a.optDouble("lat1"), a.optDouble("lng1"), a.optDouble("lat2"), a.optDouble("lng2"), out)
                r.ok("meters", out[0].toDouble())
            }
            // absensi: apakah posisi sekarang di dalam salah satu area? + status fake GPS
            "geofence.check" -> perm({
                client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, CancellationTokenSource().token).addOnSuccessListener { l ->
                    if (l == null) return@addOnSuccessListener r.err("lokasi tidak tersedia")
                    val list = a.optJSONArray("fences") ?: fences
                    val res = JSONArray((0 until list.length()).map { i -> list.getJSONObject(i).let { f -> eval(f, l) } })
                    r.ok(json(l).put("fences", res).put("inside", (0 until res.length()).any { res.getJSONObject(it).getBoolean("inside") }))
                }.addOnFailureListener { r.err(it.message ?: "gagal") }
            }, r)
            "geofence.watch" -> perm({ fences = a.optJSONArray("fences") ?: JSONArray(); inside.clear(); watch(a); r.ok() }, r)
            "geofence.stop" -> { fences = JSONArray(); inside.clear(); stopWatch(); r.ok() }
            "activity.start" -> activityStart(r)
            "activity.stop" -> { activityStop(); r.ok() }
            else -> r.err("unknown $prefix.$cmd")
        }
    }

    private fun eval(f: JSONObject, l: Location): JSONObject {
        val d = FloatArray(1)
        Location.distanceBetween(l.latitude, l.longitude, f.optDouble("lat"), f.optDouble("lng"), d)
        val radius = f.optDouble("radius", 100.0)
        return JSONObject().put("id", f.str("id")).put("distance", d[0].toDouble()).put("inside", d[0] <= radius)
    }

    private fun watch(a: JSONObject) {
        stopWatch()
        val req = LocationRequest.Builder(priority(a), a.optLong("interval", 5000).coerceAtLeast(1000))
            .setMinUpdateDistanceMeters(a.optDouble("distance", 0.0).toFloat()).build()
        val cb = object : LocationCallback() {
            override fun onLocationResult(res: LocationResult) {
                val l = res.lastLocation ?: return
                emit("location", json(l))
                for (i in 0 until fences.length()) {
                    val e = eval(fences.getJSONObject(i), l)
                    val id = e.getString("id")
                    if (e.getBoolean("inside") && inside.add(id)) emit("geofence", e.put("transition", "enter").put("mock", json(l).get("mock")))
                    else if (!e.getBoolean("inside") && inside.remove(id)) emit("geofence", e.put("transition", "exit"))
                }
            }
        }
        client.requestLocationUpdates(req, cb, Looper.getMainLooper())
        watchCb = cb
    }

    private fun stopWatch() { watchCb?.let { client.removeLocationUpdates(it) }; watchCb = null }

    private fun activityStart(r: Reply) {
        val perms = if (Build.VERSION.SDK_INT >= 29) listOf(Manifest.permission.ACTIVITY_RECOGNITION) else emptyList()
        host.requestPerms(perms) { ok ->
            if (!ok) return@requestPerms r.err("izin aktivitas fisik ditolak")
            activityStop()
            val action = "${host.packageName}.ACTIVITY"
            val rcv = object : BroadcastReceiver() {
                override fun onReceive(c: Context, i: Intent) {
                    if (!ActivityTransitionResult.hasResult(i)) return
                    ActivityTransitionResult.extractResult(i)?.transitionEvents?.forEach { e ->
                        emit("activity", JSONObject().put("type", name(e.activityType)).put("transition", if (e.transitionType == ActivityTransition.ACTIVITY_TRANSITION_ENTER) "enter" else "exit"))
                    }
                }
            }
            ContextCompat.registerReceiver(host, rcv, IntentFilter(action), ContextCompat.RECEIVER_EXPORTED)
            actRcv = rcv
            val pi = PendingIntent.getBroadcast(host, 7, Intent(action).setPackage(host.packageName), PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0))
            actPi = pi
            val types = listOf(DetectedActivity.STILL, DetectedActivity.WALKING, DetectedActivity.RUNNING, DetectedActivity.ON_BICYCLE, DetectedActivity.IN_VEHICLE)
            val transitions = types.flatMap { t -> listOf(ActivityTransition.ACTIVITY_TRANSITION_ENTER, ActivityTransition.ACTIVITY_TRANSITION_EXIT).map { ActivityTransition.Builder().setActivityType(t).setActivityTransition(it).build() } }
            ActivityRecognition.getClient(host).requestActivityTransitionUpdates(ActivityTransitionRequest(transitions), pi)
                .addOnSuccessListener { r.ok() }.addOnFailureListener { r.err(it.message ?: "gagal") }
        }
    }

    private fun activityStop() {
        actPi?.let { runCatching { ActivityRecognition.getClient(host).removeActivityTransitionUpdates(it) } }
        actRcv?.let { runCatching { host.unregisterReceiver(it) } }
        actPi = null; actRcv = null
    }

    private fun name(t: Int) = when (t) {
        DetectedActivity.STILL -> "still"; DetectedActivity.WALKING -> "walking"; DetectedActivity.RUNNING -> "running"
        DetectedActivity.ON_BICYCLE -> "bicycle"; DetectedActivity.IN_VEHICLE -> "vehicle"; else -> "unknown"
    }

    override fun onPause() { if (!cfg.on("backgroundAudio")) watchCb?.let { client.removeLocationUpdates(it) } }
    override fun onResume() { watchCb?.let { cb -> client.requestLocationUpdates(LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000).build(), cb, Looper.getMainLooper()) } }
    override fun onDestroy() { stopWatch(); activityStop() }
}
