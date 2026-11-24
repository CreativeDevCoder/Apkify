package app.apkify.shell

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONArray
import org.json.JSONObject
import java.net.URL

/**
 * Notifikasi lokal: tampil langsung / terjadwal / berulang, channel, badge angka,
 * dijadwalkan ulang setelah HP restart. Ketuk notifikasi -> membuka URL di aplikasi.
 */
class NotifyPlugin(host: MainActivity) : Plugin(host) {
    override val prefixes = setOf("notify", "badge")
    override fun enabled(prefix: String) = cfg.on("localNotifications")

    override fun handle(prefix: String, cmd: String, a: JSONObject, r: Reply) {
        if (prefix == "badge") {
            Notifier.badge(host, a.optInt("count", 0)); return r.ok()
        }
        when (cmd) {
            "requestPermission" -> permission { r.ok("granted", it) }
            "show", "schedule" -> permission { granted ->
                if (!granted) return@permission r.err("izin notifikasi ditolak")
                val item = Notifier.item(a)
                if (item.optLong("at") > System.currentTimeMillis() + 1000) { Notifier.save(host, item); Notifier.arm(host, item) }
                else r.bg { Notifier.show(host, item) }
                r.ok("id", item.getInt("id"))
            }
            "cancel" -> { Notifier.cancel(host, a.optInt("id")); r.ok() }
            "cancelAll" -> { Notifier.all(host).let { arr -> (0 until arr.length()).forEach { Notifier.cancel(host, arr.getJSONObject(it).getInt("id")) } }; NotificationManagerCompat.from(host).cancelAll(); r.ok() }
            "pending" -> r.ok("items", Notifier.all(host))
            "createChannel" -> { Notifier.channel(host, a.str("id", "default"), a.str("name", cfg.name), a.str("importance", "default"), a.str("description")); r.ok() }
            else -> r.err("unknown notify.$cmd")
        }
    }

    private fun permission(cb: (Boolean) -> Unit) =
        if (Build.VERSION.SDK_INT >= 33) host.requestPerms(listOf(Manifest.permission.POST_NOTIFICATIONS), cb = cb) else cb(NotificationManagerCompat.from(host).areNotificationsEnabled())
}

/** Logika notifikasi yang juga dipakai receiver (tanpa Activity). */
object Notifier {
    private fun prefs(c: Context) = c.getSharedPreferences("apkify_notify", Context.MODE_PRIVATE)
    const val EXTRA_ID = "apkify_notification_id"

    fun item(a: JSONObject): JSONObject {
        val every = when (val e = a.opt("every")) {
            "minute" -> 60_000L; "hour" -> 3_600_000L; "day" -> 86_400_000L; "week" -> 604_800_000L
            is Number -> e.toLong().coerceAtLeast(60_000L); else -> 0L
        }
        return JSONObject().put("id", if (a.has("id")) a.optInt("id") else (System.currentTimeMillis() % 1_000_000_000).toInt())
            .put("title", a.str("title")).put("body", a.str("body", a.str("text"))).put("url", a.str("url"))
            .put("channel", a.str("channel", "default")).put("at", a.optLong("at", 0)).put("every", every)
            .put("image", a.str("image")).put("number", a.optInt("number", 0)).put("ongoing", a.optBoolean("ongoing"))
    }

    fun all(c: Context): JSONArray = runCatching { JSONArray(prefs(c).getString("items", "[]")) }.getOrDefault(JSONArray())

    fun save(c: Context, item: JSONObject) {
        val arr = all(c); val out = JSONArray()
        for (i in 0 until arr.length()) arr.getJSONObject(i).let { if (it.getInt("id") != item.getInt("id")) out.put(it) }
        out.put(item)
        prefs(c).edit().putString("items", out.toString()).apply()
    }

    private fun remove(c: Context, id: Int) {
        val arr = all(c); val out = JSONArray()
        for (i in 0 until arr.length()) arr.getJSONObject(i).let { if (it.getInt("id") != id) out.put(it) }
        prefs(c).edit().putString("items", out.toString()).apply()
    }

    private fun pi(c: Context, id: Int): PendingIntent = PendingIntent.getBroadcast(c, id,
        Intent(c, NotifyReceiver::class.java).setAction("${c.packageName}.NOTIFY").putExtra(EXTRA_ID, id),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    fun arm(c: Context, item: JSONObject) {
        val am = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        var at = item.optLong("at")
        val every = item.optLong("every")
        if (every > 0) while (at < System.currentTimeMillis()) at += every
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi(c, item.getInt("id")))
    }

    fun cancel(c: Context, id: Int) {
        (c.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(pi(c, id))
        remove(c, id)
        NotificationManagerCompat.from(c).cancel(id)
    }

    fun rearmAll(c: Context) { val arr = all(c); for (i in 0 until arr.length()) arm(c, arr.getJSONObject(i)) }

    fun fire(c: Context, id: Int) {
        val arr = all(c)
        val item = (0 until arr.length()).map { arr.getJSONObject(it) }.firstOrNull { it.getInt("id") == id } ?: return
        show(c, item)
        if (item.optLong("every") > 0) { item.put("at", item.optLong("at") + item.optLong("every")); save(c, item); arm(c, item) } else remove(c, id)
    }

    fun channel(c: Context, id: String, name: String, importance: String = "default", desc: String = "") {
        if (Build.VERSION.SDK_INT < 26) return
        val imp = when (importance) { "high" -> NotificationManager.IMPORTANCE_HIGH; "low" -> NotificationManager.IMPORTANCE_LOW; "min" -> NotificationManager.IMPORTANCE_MIN; else -> NotificationManager.IMPORTANCE_DEFAULT }
        val ch = NotificationChannel(id, name, imp).apply { description = desc; setShowBadge(true) }
        (c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(ch)
    }

    fun openIntent(c: Context, url: String, id: Int): PendingIntent {
        val i = Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra(EXTRA_ID, id)
        if (url.isNotBlank()) { i.action = Intent.ACTION_VIEW; i.data = Uri.parse(AppConfig.get(c).resolve(url)) }
        return PendingIntent.getActivity(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    /** tampilkan notifikasi (panggil dari thread latar bila ada gambar) */
    fun show(c: Context, item: JSONObject) {
        val chId = item.optString("channel", "default").ifBlank { "default" }
        if (Build.VERSION.SDK_INT >= 26 && (c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).getNotificationChannel(chId) == null)
            channel(c, chId, if (chId == "default") AppConfig.get(c).name else chId)
        val id = item.getInt("id")
        val b = NotificationCompat.Builder(c, chId).setSmallIcon(c.applicationInfo.icon)
            .setContentTitle(item.optString("title").ifBlank { AppConfig.get(c).name }).setContentText(item.optString("body"))
            .setStyle(NotificationCompat.BigTextStyle().bigText(item.optString("body")))
            .setAutoCancel(!item.optBoolean("ongoing")).setOngoing(item.optBoolean("ongoing"))
            .setContentIntent(openIntent(c, item.optString("url"), id))
        if (item.optInt("number") > 0) b.setNumber(item.optInt("number"))
        item.optString("image").takeIf { it.startsWith("http") }?.let { u ->
            runCatching { URL(u).openStream().use { BitmapFactory.decodeStream(it) } }.getOrNull()?.let { bmp ->
                b.setLargeIcon(bmp).setStyle(NotificationCompat.BigPictureStyle().bigPicture(bmp))
            }
        }
        runCatching { NotificationManagerCompat.from(c).notify(id, b.build()) }
    }

    /** Badge angka di ikon: Android menampilkannya dari notifikasi aktif, jadi dibuat notifikasi senyap. */
    fun badge(c: Context, count: Int) {
        val nm = NotificationManagerCompat.from(c)
        if (count <= 0) return nm.cancel(BADGE_ID)
        if (Build.VERSION.SDK_INT >= 26) {
            val ch = NotificationChannel("badge", "Badge", NotificationManager.IMPORTANCE_MIN).apply { setShowBadge(true) }
            (c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(ch)
        }
        val n = NotificationCompat.Builder(c, "badge").setSmallIcon(c.applicationInfo.icon).setContentTitle(AppConfig.get(c).name)
            .setContentText("$count baru").setNumber(count).setBadgeIconType(NotificationCompat.BADGE_ICON_SMALL)
            .setPriority(NotificationCompat.PRIORITY_MIN).setSilent(true).setContentIntent(openIntent(c, "", BADGE_ID)).build()
        runCatching { nm.notify(BADGE_ID, n) }
    }

    private const val BADGE_ID = 777001
}

/** Alarm notifikasi terjadwal + BOOT_COMPLETED (jadwal ulang & mulai otomatis). */
class NotifyReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        when (i.action) {
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_LOCKED_BOOT_COMPLETED, "android.intent.action.QUICKBOOT_POWERON", Intent.ACTION_MY_PACKAGE_REPLACED -> {
                val pr = goAsync()
                Thread {
                    runCatching { Notifier.rearmAll(c) }
                    val cfg = AppConfig.get(c)
                    if (cfg.on("autoStart") && i.action != Intent.ACTION_MY_PACKAGE_REPLACED) runCatching {
                        c.startActivity(Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    }
                    pr.finish()
                }.start()
            }
            else -> {
                val id = i.getIntExtra(Notifier.EXTRA_ID, 0)
                val pr = goAsync()
                Thread { runCatching { Notifier.fire(c, id) }; pr.finish() }.start()
            }
        }
    }
}
