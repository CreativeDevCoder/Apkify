package app.apkify.shell

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.WebResourceResponse
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipInputStream
import kotlin.concurrent.thread

/**
 * Remote Update:
 *  - pesan dari pemilik aplikasi (tampil sekali per pesan)
 *  - paksa update bila versionCode < minVersionCode
 *  - update konten OTA untuk aplikasi ZIP/HTML (tanpa build ulang & tanpa upload ulang ke Play Store)
 */
object Remote {
    private const val PREF = "apkify_remote"

    /** Direktori konten OTA aktif (null bila belum ada) */
    fun otaDir(ctx: Context): File? {
        val v = ctx.getSharedPreferences(PREF, Context.MODE_PRIVATE).getInt("ota", 0)
        if (v <= 0) return null
        val d = File(ctx.filesDir, "ota/v$v")
        return if (File(d, "index.html").exists()) d else null
    }

    fun serveOta(dir: File, rel: String): WebResourceResponse? {
        var path = rel.trimStart('/').substringBefore('?').substringBefore('#')
        if (path.isEmpty() || path.endsWith("/")) path += "index.html"
        val f = File(dir, path).canonicalFile
        if (!f.path.startsWith(dir.canonicalPath) || !f.isFile) return null
        val mime = EncryptedAssets.mimeOf(path)
        return WebResourceResponse(mime, if (EncryptedAssets.isText(mime)) "utf-8" else null, FileInputStream(f))
    }

    fun check(activity: MainActivity) {
        val cfg = AppConfig.get(activity)
        if (!cfg.remoteUpdate || cfg.apiBase.isBlank() || cfg.appId.isBlank()) return
        thread(name = "apkify-remote") {
            val json = runCatching { JSONObject(httpText("${cfg.apiBase}/api/public/apps/${cfg.appId}/remote")) }.getOrNull() ?: return@thread
            val prefs = activity.getSharedPreferences(PREF, Context.MODE_PRIVATE)
            val min = json.optInt("minVersionCode", 0)
            val updateUrl = json.optString("updateUrl").ifBlank { "https://play.google.com/store/apps/details?id=${activity.packageName}" }
            activity.runOnUiThread {
                if (activity.isFinishing) return@runOnUiThread
                if (min > cfg.versionCode) {
                    AlertDialog.Builder(activity).setTitle("Pembaruan diperlukan")
                        .setMessage("Versi aplikasi ini sudah tidak didukung. Silakan perbarui untuk melanjutkan.")
                        .setCancelable(false)
                        .setPositiveButton("Perbarui") { _, _ ->
                            runCatching { activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(updateUrl))) }
                            activity.finish()
                        }.show()
                    return@runOnUiThread
                }
                val msg = json.optString("message")
                val msgId = json.optString("messageId")
                if (msg.isNotBlank() && msgId != prefs.getString("msg", "")) {
                    prefs.edit().putString("msg", msgId).apply()
                    AlertDialog.Builder(activity).setTitle(cfg.name).setMessage(msg).setPositiveButton("OK", null).show()
                }
            }
            // Update konten OTA
            val bundle = json.optJSONObject("bundle") ?: return@thread
            val ver = bundle.optInt("version", 0)
            if (!cfg.local || ver <= prefs.getInt("ota", 0)) return@thread
            runCatching {
                val root = File(activity.filesDir, "ota")
                val tmp = File(activity.cacheDir, "bundle.zip")
                httpDownload(bundle.getString("url"), tmp)
                val dir = File(root, "v$ver").apply { deleteRecursively(); mkdirs() }
                unzip(tmp, dir)
                tmp.delete()
                // ZIP berisi satu folder (mis. dist/) -> naikkan
                if (!File(dir, "index.html").exists()) {
                    dir.listFiles()?.singleOrNull { it.isDirectory }?.let { inner ->
                        inner.listFiles()?.forEach { it.renameTo(File(dir, it.name)) }
                        inner.deleteRecursively()
                    }
                }
                if (File(dir, "index.html").exists()) {
                    prefs.edit().putInt("ota", ver).apply()
                    root.listFiles()?.filter { it.name != "v$ver" }?.forEach { it.deleteRecursively() }
                    activity.runOnUiThread {
                        Toast.makeText(activity, "Konten diperbarui", Toast.LENGTH_SHORT).show()
                        activity.reloadStart()
                    }
                } else dir.deleteRecursively()
            }
        }
    }

    private fun open(url: String): HttpURLConnection = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 10_000; readTimeout = 30_000; instanceFollowRedirects = true
    }

    private fun httpText(url: String): String = open(url).run {
        try { if (responseCode != 200) error("HTTP $responseCode"); inputStream.bufferedReader().use { it.readText() } } finally { disconnect() }
    }

    private fun httpDownload(url: String, dest: File) = open(url).run {
        try { if (responseCode != 200) error("HTTP $responseCode"); inputStream.use { i -> dest.outputStream().use { o -> i.copyTo(o) } } } finally { disconnect() }
    }

    private fun unzip(zip: File, dest: File) {
        val base = dest.canonicalPath + File.separator
        ZipInputStream(FileInputStream(zip)).use { zis ->
            var e = zis.nextEntry
            while (e != null) {
                val out = File(dest, e.name).canonicalFile
                if (!out.path.startsWith(base)) error("zip slip") // tolak path ../
                if (e.isDirectory) out.mkdirs() else {
                    out.parentFile?.mkdirs()
                    out.outputStream().use { zis.copyTo(it) }
                }
                e = zis.nextEntry
            }
        }
    }
}
