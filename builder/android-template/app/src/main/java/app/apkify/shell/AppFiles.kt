package app.apkify.shell

import android.content.Context
import android.net.Uri
import android.util.Base64
import android.webkit.CookieManager
import android.webkit.WebResourceResponse
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/**
 * Berkas sementara milik aplikasi (foto kamera, rekaman, hasil scan, unduhan).
 * Disajikan ke halaman lewat https://appassets.androidplatform.net/__apkify/files/<nama>
 * sehingga bisa dipakai di <img>, fetch(), atau diunggah kembali oleh situs.
 */
object AppFiles {
    const val PREFIX = "/__apkify/files/"

    fun dir(ctx: Context): File = File(ctx.cacheDir, "apkify").apply { mkdirs() }

    fun newFile(ctx: Context, ext: String): File =
        File(dir(ctx), "f_${System.currentTimeMillis()}_${UUID.randomUUID().toString().take(8)}.${ext.trimStart('.').ifBlank { "bin" }}")

    fun url(f: File): String = "https://${MainActivity.ASSET_HOST}$PREFIX${Uri.encode(f.name)}"

    fun fromUrl(ctx: Context, u: String): File? {
        val p = Uri.parse(u)
        if (p.host != MainActivity.ASSET_HOST || !(p.path ?: "").startsWith(PREFIX)) return null
        val name = p.path!!.removePrefix(PREFIX)
        if (name.contains('/') || name.contains("..")) return null
        return File(dir(ctx), name).takeIf { it.isFile }
    }

    fun uri(ctx: Context, f: File): Uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.files", f)

    fun describe(f: File, mime: String = EncryptedAssets.mimeOf(f.name), base64: Boolean = false): JSONObject = JSONObject()
        .put("url", url(f)).put("name", f.name).put("size", f.length()).put("mime", mime)
        .apply { if (base64) put("base64", Base64.encodeToString(f.readBytes(), Base64.NO_WRAP)) }

    fun serve(ctx: Context, path: String): WebResourceResponse {
        val name = Uri.decode(path.removePrefix(PREFIX))
        val f = File(dir(ctx), name)
        val headers = mapOf("Access-Control-Allow-Origin" to "*", "Cache-Control" to "no-store")
        if (name.contains('/') || name.contains("..") || !f.isFile)
            return WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers, "".byteInputStream())
        val mime = EncryptedAssets.mimeOf(f.name)
        return WebResourceResponse(mime, null, 200, "OK", headers, FileInputStream(f))
    }

    /**
     * Ambil masukan berkas dari argumen JS: {url} (berkas lokal / http(s) / data:) atau {base64}.
     * Harus dipanggil dari thread latar (bisa mengunduh).
     */
    fun resolve(ctx: Context, a: JSONObject, defExt: String = "bin"): File {
        val name = a.str("name")
        val ext = name.substringAfterLast('.', "").ifBlank { defExt }
        a.str("base64").takeIf { it.isNotEmpty() }?.let { b ->
            return newFile(ctx, ext).apply { writeBytes(Base64.decode(b.substringAfter("base64,"), Base64.DEFAULT)) }
        }
        val u = a.str("url").ifBlank { a.str("uri") }
        require(u.isNotEmpty()) { "url atau base64 wajib" }
        fromUrl(ctx, u)?.let { return it }
        if (u.startsWith("data:")) return newFile(ctx, ext).apply { writeBytes(Base64.decode(u.substringAfter(","), Base64.DEFAULT)) }
        if (u.startsWith("content://")) {
            val f = newFile(ctx, ext)
            ctx.contentResolver.openInputStream(Uri.parse(u))!!.use { i -> f.outputStream().use { i.copyTo(it) } }
            return f
        }
        require(u.startsWith("http")) { "url tidak didukung" }
        val c = (URL(u).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15_000; readTimeout = 60_000
            CookieManager.getInstance().getCookie(u)?.let { setRequestProperty("Cookie", it) }
        }
        require(c.responseCode in 200..299) { "unduh gagal: HTTP ${c.responseCode}" }
        val e2 = name.substringAfterLast('.', "").ifBlank { u.substringBefore('?').substringAfterLast('/').substringAfterLast('.', "").take(5).ifBlank { defExt } }
        val f = newFile(ctx, e2)
        c.inputStream.use { i -> f.outputStream().use { i.copyTo(it) } }
        c.disconnect()
        return f
    }

    /** bersihkan berkas sementara > 2 hari */
    fun prune(ctx: Context) = runCatching {
        val limit = System.currentTimeMillis() - 2 * 86_400_000L
        dir(ctx).listFiles()?.forEach { if (it.lastModified() < limit) it.delete() }
    }
}
