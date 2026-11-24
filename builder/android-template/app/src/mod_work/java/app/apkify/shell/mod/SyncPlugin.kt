package app.apkify.shell.mod

import android.content.Context
import androidx.work.Constraints
import androidx.work.Data
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import app.apkify.shell.MainActivity
import app.apkify.shell.Notifier
import app.apkify.shell.Plugin
import app.apkify.shell.Reply
import app.apkify.shell.str
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * Sinkronisasi latar (WorkManager): aplikasi memanggil URL Anda secara berkala (min. 15 menit)
 * walau sedang ditutup. Respons JSON {"notifications":[{title, body, url}]} langsung tampil sebagai notifikasi,
 * respons terakhir bisa dibaca lewat Apkify.sync.last().
 */
class SyncPlugin(host: MainActivity) : Plugin(host) {
    override val prefixes = setOf("sync")
    override fun enabled(prefix: String) = cfg.on("backgroundSync")

    override fun handle(prefix: String, cmd: String, a: JSONObject, r: Reply) {
        val wm = WorkManager.getInstance(host)
        when (cmd) {
            "register" -> {
                val url = a.str("url")
                if (!url.startsWith("https://")) return r.err("url harus https")
                val data = Data.Builder().putString("url", url).putString("headers", (a.optJSONObject("headers") ?: JSONObject()).toString()).build()
                val c = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
                val req = PeriodicWorkRequestBuilder<SyncWorker>(a.optLong("minutes", 60).coerceAtLeast(15), TimeUnit.MINUTES).setConstraints(c).setInputData(data).build()
                wm.enqueueUniquePeriodicWork(a.str("id", "apkify-sync"), ExistingPeriodicWorkPolicy.UPDATE, req)
                r.ok()
            }
            "runNow" -> {
                val data = Data.Builder().putString("url", a.str("url")).putString("headers", (a.optJSONObject("headers") ?: JSONObject()).toString()).build()
                wm.enqueue(OneTimeWorkRequestBuilder<SyncWorker>().setInputData(data).build()); r.ok()
            }
            "cancel" -> { wm.cancelUniqueWork(a.str("id", "apkify-sync")); r.ok() }
            "last" -> r.ok(JSONObject().put("time", prefs(host).getLong("time", 0)).put("body", prefs(host).getString("body", null) ?: JSONObject.NULL))
            else -> r.err("unknown sync.$cmd")
        }
    }

    companion object { fun prefs(c: Context) = c.getSharedPreferences("apkify_sync", Context.MODE_PRIVATE) }
}

class SyncWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        val url = inputData.getString("url") ?: return Result.failure()
        return try {
        val c = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 20_000; readTimeout = 30_000
            setRequestProperty("X-Apkify-Sync", "1")
            runCatching { JSONObject(inputData.getString("headers") ?: "{}") }.getOrNull()?.let { h -> h.keys().forEach { k -> setRequestProperty(k, h.optString(k)) } }
        }
        val code = c.responseCode
        val body = (if (code < 400) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
        c.disconnect()
        SyncPlugin.prefs(applicationContext).edit().putLong("time", System.currentTimeMillis()).putString("body", body.take(100_000)).apply()
        runCatching { JSONObject(body).optJSONArray("notifications") }.getOrNull()?.let { arr ->
            for (i in 0 until minOf(arr.length(), 5)) Notifier.show(applicationContext, Notifier.item(arr.getJSONObject(i)))
        }
        if (code in 500..599) Result.retry() else Result.success()
    } catch (e: Exception) { Result.retry() }
    }
}

