package app.apkify.shell

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.hardware.ConsumerIrManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import android.view.HapticFeedbackConstants
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Perangkat & sensor: info, baterai, jaringan, kecerahan, volume, senter, getar pola, haptic,
 * sensor (akselerometer, giroskop, kompas, cahaya, proximity, barometer, langkah), IR blaster,
 * izin runtime & pengaturan sistem, deteksi root / mode developer.
 */
class DevicePlugin(host: MainActivity) : Plugin(host) {
    override val prefixes = setOf("device", "sensor", "ir", "permission", "settings")
    override fun enabled(prefix: String) = when (prefix) {
        "sensor" -> cfg.on("sensors")
        "ir" -> cfg.on("infrared")
        else -> cfg.jsApi
    }

    private val sm by lazy { host.getSystemService(Context.SENSOR_SERVICE) as SensorManager }
    private val listeners = HashMap<String, SensorEventListener>()

    override fun handle(prefix: String, cmd: String, a: JSONObject, r: Reply) {
        when (prefix) {
            "sensor" -> sensor(cmd, a, r)
            "ir" -> ir(cmd, a, r)
            "permission" -> permission(cmd, a, r)
            "settings" -> settings(a.str("type", "app"), r)
            else -> device(cmd, a, r)
        }
    }

    // ---------------- device.* ----------------
    private fun device(cmd: String, a: JSONObject, r: Reply) {
        when (cmd) {
            "info" -> r.ok(JSONObject().put("manufacturer", Build.MANUFACTURER).put("brand", Build.BRAND).put("model", Build.MODEL)
                .put("sdk", Build.VERSION.SDK_INT).put("release", Build.VERSION.RELEASE).put("language", java.util.Locale.getDefault().toLanguageTag())
                .put("darkMode", dark()).put("tablet", host.resources.configuration.smallestScreenWidthDp >= 600)
                .put("width", host.resources.displayMetrics.widthPixels).put("height", host.resources.displayMetrics.heightPixels)
                .put("density", host.resources.displayMetrics.density).put("features", host.plugins.available()))
            "battery" -> r.ok(battery())
            "network" -> r.ok(network())
            "brightness" -> {
                val lp = host.window.attributes
                if (a.has("value")) { lp.screenBrightness = a.optDouble("value", -1.0).toFloat().let { if (it < 0) -1f else it.coerceIn(0.01f, 1f) }; host.window.attributes = lp }
                r.ok("value", lp.screenBrightness.toDouble())
            }
            "volume" -> {
                val am = host.getSystemService(Context.AUDIO_SERVICE) as AudioManager
                val stream = when (a.str("stream", "music")) { "ring" -> AudioManager.STREAM_RING; "alarm" -> AudioManager.STREAM_ALARM; "notification" -> AudioManager.STREAM_NOTIFICATION; else -> AudioManager.STREAM_MUSIC }
                val max = am.getStreamMaxVolume(stream)
                if (a.has("value")) runCatching { am.setStreamVolume(stream, (a.optDouble("value") * max).toInt().coerceIn(0, max), if (a.optBoolean("showUi")) AudioManager.FLAG_SHOW_UI else 0) }
                r.ok(JSONObject().put("value", am.getStreamVolume(stream).toDouble() / max).put("max", max))
            }
            "flashlight" -> {
                val cm = host.getSystemService(Context.CAMERA_SERVICE) as CameraManager
                val id = cm.cameraIdList.firstOrNull { cm.getCameraCharacteristics(it).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true }
                    ?: return r.err("senter tidak tersedia")
                cm.setTorchMode(id, a.optBoolean("on", true))
                r.ok("on", a.optBoolean("on", true))
            }
            "vibrate" -> {
                val v = host.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                val arr = a.optJSONArray("pattern")
                if (arr != null && arr.length() > 0) {
                    val pattern = LongArray(arr.length() + 1) { if (it == 0) 0L else arr.optLong(it - 1).coerceIn(0, 5000) }
                    if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(pattern, a.optInt("repeat", -1))) else @Suppress("DEPRECATION") v.vibrate(pattern, a.optInt("repeat", -1))
                } else if (a.optBoolean("cancel")) v.cancel()
                else {
                    val ms = a.optLong("ms", 50).coerceIn(5, 5000)
                    if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(ms, a.optInt("amplitude", VibrationEffect.DEFAULT_AMPLITUDE).let { if (it in 1..255) it else VibrationEffect.DEFAULT_AMPLITUDE }))
                    else @Suppress("DEPRECATION") v.vibrate(ms)
                }
                r.ok()
            }
            "haptic" -> {
                val c = when (a.str("type", "click")) {
                    "heavy", "long" -> HapticFeedbackConstants.LONG_PRESS
                    "tick" -> HapticFeedbackConstants.CLOCK_TICK
                    "confirm" -> if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.VIRTUAL_KEY
                    "reject" -> if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.REJECT else HapticFeedbackConstants.LONG_PRESS
                    else -> HapticFeedbackConstants.VIRTUAL_KEY
                }
                host.webView.performHapticFeedback(c)
                r.ok()
            }
            "security" -> r.ok(JSONObject().put("rooted", rooted()).put("developerMode", devMode()).put("emulator", emulator())
                .put("adb", Settings.Global.getInt(host.contentResolver, Settings.Global.ADB_ENABLED, 0) == 1))
            else -> r.err("unknown device.$cmd")
        }
    }

    private fun dark() = (host.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    override fun onConfigurationChanged(c: Configuration) {
        if (cfg.jsApi) emit("theme", JSONObject().put("dark", dark()))
    }

    private fun battery(): JSONObject {
        val i = host.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = i?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = i?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
        val status = i?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        return JSONObject().put("level", if (level >= 0) level.toDouble() / scale else JSONObject.NULL)
            .put("charging", status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL)
            .put("plugged", when (i?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0)) { BatteryManager.BATTERY_PLUGGED_AC -> "ac"; BatteryManager.BATTERY_PLUGGED_USB -> "usb"; BatteryManager.BATTERY_PLUGGED_WIRELESS -> "wireless"; else -> "none" })
            .put("temperature", (i?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) ?: 0) / 10.0)
    }

    private fun network(): JSONObject {
        val cm = host.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.getNetworkCapabilities(cm.activeNetwork)
        val type = when {
            caps == null -> "none"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "vpn"
            else -> "other"
        }
        return JSONObject().put("type", type).put("online", caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true)
            .put("metered", cm.isActiveNetworkMetered).put("downKbps", caps?.linkDownstreamBandwidthKbps ?: 0)
    }

    private fun rooted(): Boolean = listOf("/system/bin/su", "/system/xbin/su", "/sbin/su", "/system/app/Superuser.apk", "/data/local/xbin/su", "/data/local/bin/su", "/system/sd/xbin/su")
        .any { File(it).exists() } || (Build.TAGS?.contains("test-keys") == true)
    private fun devMode() = Settings.Global.getInt(host.contentResolver, Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0) == 1
    private fun emulator() = Build.FINGERPRINT.startsWith("generic") || Build.MODEL.contains("Emulator") || Build.MODEL.contains("Android SDK built for") || Build.HARDWARE.contains("ranchu") || Build.HARDWARE.contains("goldfish")

    // ---------------- sensor.* ----------------
    private val TYPES = mapOf(
        "accelerometer" to Sensor.TYPE_ACCELEROMETER, "gyroscope" to Sensor.TYPE_GYROSCOPE, "magnetometer" to Sensor.TYPE_MAGNETIC_FIELD,
        "compass" to Sensor.TYPE_ROTATION_VECTOR, "orientation" to Sensor.TYPE_ROTATION_VECTOR, "light" to Sensor.TYPE_LIGHT,
        "proximity" to Sensor.TYPE_PROXIMITY, "pressure" to Sensor.TYPE_PRESSURE, "barometer" to Sensor.TYPE_PRESSURE,
        "gravity" to Sensor.TYPE_GRAVITY, "linearAcceleration" to Sensor.TYPE_LINEAR_ACCELERATION,
        "stepCounter" to Sensor.TYPE_STEP_COUNTER, "stepDetector" to Sensor.TYPE_STEP_DETECTOR,
        "humidity" to Sensor.TYPE_RELATIVE_HUMIDITY, "temperature" to Sensor.TYPE_AMBIENT_TEMPERATURE
    )

    private fun sensor(cmd: String, a: JSONObject, r: Reply) {
        when (cmd) {
            "list" -> r.ok("sensors", JSONArray(TYPES.filter { sm.getDefaultSensor(it.value) != null }.keys.toList()))
            "start" -> {
                val name = a.str("type")
                val type = TYPES[name] ?: return r.err("sensor tidak dikenal: $name")
                val s = sm.getDefaultSensor(type) ?: return r.err("sensor $name tidak tersedia di perangkat ini")
                val go = {
                    listeners.remove(name)?.let { sm.unregisterListener(it) }
                    val minGap = a.optLong("interval", 100).coerceAtLeast(16)
                    var last = 0L
                    val l = object : SensorEventListener {
                        override fun onSensorChanged(e: SensorEvent) {
                            val now = System.currentTimeMillis()
                            if (now - last < minGap) return
                            last = now
                            val d = JSONObject().put("type", name).put("values", JSONArray(e.values.map { it.toDouble() })).put("t", now)
                            if (type == Sensor.TYPE_ROTATION_VECTOR) {
                                val rot = FloatArray(9); val o = FloatArray(3)
                                SensorManager.getRotationMatrixFromVector(rot, e.values); SensorManager.getOrientation(rot, o)
                                val az = (Math.toDegrees(o[0].toDouble()) + 360) % 360
                                d.put("heading", az).put("pitch", Math.toDegrees(o[1].toDouble())).put("roll", Math.toDegrees(o[2].toDouble()))
                            }
                            emit("sensor", d)
                        }
                        override fun onAccuracyChanged(s: Sensor?, acc: Int) {}
                    }
                    sm.registerListener(l, s, SensorManager.SENSOR_DELAY_GAME)
                    listeners[name] = l
                    r.ok("type", name)
                }
                if ((type == Sensor.TYPE_STEP_COUNTER || type == Sensor.TYPE_STEP_DETECTOR) && Build.VERSION.SDK_INT >= 29)
                    host.requestPerms(listOf(Manifest.permission.ACTIVITY_RECOGNITION)) { ok -> if (ok) go() else r.err("izin aktivitas fisik ditolak") }
                else go()
            }
            "stop" -> {
                val name = a.str("type")
                if (name.isEmpty()) { listeners.values.forEach { sm.unregisterListener(it) }; listeners.clear() }
                else listeners.remove(name)?.let { sm.unregisterListener(it) }
                r.ok()
            }
            else -> r.err("unknown sensor.$cmd")
        }
    }

    override fun onPause() { if (!cfg.on("backgroundAudio")) listeners.values.forEach { sm.unregisterListener(it) } }
    override fun onDestroy() { listeners.values.forEach { sm.unregisterListener(it) }; listeners.clear() }

    // ---------------- ir.* ----------------
    private fun ir(cmd: String, a: JSONObject, r: Reply) {
        val ir = host.getSystemService(Context.CONSUMER_IR_SERVICE) as? ConsumerIrManager
        when (cmd) {
            "available" -> r.ok("available", ir?.hasIrEmitter() == true)
            "transmit" -> {
                if (ir?.hasIrEmitter() != true) return r.err("perangkat tidak punya IR blaster")
                val p = a.optJSONArray("pattern") ?: return r.err("pattern wajib")
                ir.transmit(a.optInt("frequency", 38000), IntArray(p.length()) { p.optInt(it) })
                r.ok()
            }
            else -> r.err("unknown ir.$cmd")
        }
    }

    // ---------------- permission.* / settings.* ----------------
    private fun names(a: JSONObject): List<String> {
        val arr = a.optJSONArray("names") ?: JSONArray().put(a.str("name"))
        return arr.strings().flatMap { PERMS[it] ?: listOf(it) }.filter { it.startsWith("android.permission.") }
    }

    private fun permission(cmd: String, a: JSONObject, r: Reply) {
        val list = names(a).filter { p -> PERMS.values.flatten().contains(p) || p.startsWith("android.permission.") }
        val declared = runCatching { host.packageManager.getPackageInfo(host.packageName, PackageManager.GET_PERMISSIONS).requestedPermissions?.toSet() }.getOrNull() ?: emptySet()
        val usable = list.filter { declared.contains(it) }
        when (cmd) {
            "check" -> r.ok(JSONObject().put("granted", usable.isNotEmpty() && usable.all { host.has(it) })
                .put("permissions", JSONObject().apply { list.forEach { put(it, if (!declared.contains(it)) "not-declared" else if (host.has(it)) "granted" else "denied") } }))
            "request" -> {
                if (usable.isEmpty()) return r.err("izin belum dideklarasikan: aktifkan fiturnya di Apkify")
                host.requestPerms(usable) { ok -> r.ok("granted", ok) }
            }
            else -> r.err("unknown permission.$cmd")
        }
    }

    private fun settings(type: String, r: Reply) {
        val i = when (type) {
            "wifi" -> Intent(Settings.ACTION_WIFI_SETTINGS)
            "location" -> Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
            "bluetooth" -> Intent(Settings.ACTION_BLUETOOTH_SETTINGS)
            "nfc" -> Intent(Settings.ACTION_NFC_SETTINGS)
            "display" -> Intent(Settings.ACTION_DISPLAY_SETTINGS)
            "sound" -> Intent(Settings.ACTION_SOUND_SETTINGS)
            "battery" -> Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
            "notification" -> if (Build.VERSION.SDK_INT >= 26) Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, host.packageName)
                else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${host.packageName}"))
            "date" -> Intent(Settings.ACTION_DATE_SETTINGS)
            "developer" -> Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS)
            else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${host.packageName}"))
        }
        runCatching { host.startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }.onSuccess { r.ok() }.onFailure { r.err("tidak bisa membuka pengaturan $type") }
    }

    companion object {
        /** nama ramah -> izin Android */
        val PERMS: Map<String, List<String>> = mapOf(
            "camera" to listOf(Manifest.permission.CAMERA),
            "microphone" to listOf(Manifest.permission.RECORD_AUDIO),
            "location" to listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
            "notifications" to if (Build.VERSION.SDK_INT >= 33) listOf(Manifest.permission.POST_NOTIFICATIONS) else emptyList(),
            "contacts" to listOf(Manifest.permission.READ_CONTACTS),
            "phone" to listOf(Manifest.permission.CALL_PHONE),
            "activity" to if (Build.VERSION.SDK_INT >= 29) listOf(Manifest.permission.ACTIVITY_RECOGNITION) else emptyList(),
            "bluetooth" to if (Build.VERSION.SDK_INT >= 31) listOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT) else listOf(Manifest.permission.ACCESS_FINE_LOCATION),
            "storage" to if (Build.VERSION.SDK_INT <= 28) listOf(Manifest.permission.WRITE_EXTERNAL_STORAGE) else emptyList()
        )
    }
}
