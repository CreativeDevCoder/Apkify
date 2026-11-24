package app.apkify.shell

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.io.FileNotFoundException

/**
 * Menyajikan konten lokal (ZIP/HTML/hasil build React-Vite) di root origin
 * https://appassets.androidplatform.net/ sehingga path absolut ("/assets/x.js")
 * dan BrowserRouter/history API berjalan normal. Rute tanpa berkas -> index.html (SPA fallback).
 * Urutan sumber: bundle OTA -> aset terenkripsi -> aset biasa.
 */
class LocalServer(private val ctx: Context, private val cfg: AppConfig) {
    private val encrypted by lazy { EncryptedAssets(ctx) }

    fun serve(request: WebResourceRequest): WebResourceResponse {
        var rel = Uri.decode(request.url.encodedPath ?: "/").trimStart('/')
        if (rel.isEmpty() || rel.endsWith("/")) rel += "index.html"
        if (rel.contains("..")) return notFound()
        load(rel)?.let { return it }
        // SPA fallback: navigasi (tanpa ekstensi / meminta HTML) -> index.html
        val last = rel.substringAfterLast('/')
        val wantsHtml = request.isForMainFrame || (request.requestHeaders["Accept"] ?: "").contains("text/html") || !last.contains('.')
        if (wantsHtml) load("index.html")?.let { return it }
        return notFound()
    }

    private fun load(rel: String): WebResourceResponse? {
        Remote.otaDir(ctx)?.let { dir -> Remote.serveOta(dir, rel)?.let { return it } }
        val bytes: ByteArray = if (cfg.encrypted) encrypted.bytes(rel) ?: return null
        else try { ctx.assets.open("www/$rel").use { it.readBytes() } } catch (e: FileNotFoundException) { return null }
        val mime = EncryptedAssets.mimeOf(rel)
        return WebResourceResponse(mime, if (EncryptedAssets.isText(mime)) "utf-8" else null, 200, "OK",
            mapOf("Cache-Control" to "no-cache", "Access-Control-Allow-Origin" to "*"), ByteArrayInputStream(bytes))
    }

    /** Halaman bawaan Apkify (offline.html / error.html) di /__apkify/ */
    fun internal(path: String): WebResourceResponse {
        val rel = path.removePrefix("/__apkify/")
        if (rel.contains("..")) return notFound()
        return try {
            val b = ctx.assets.open(rel).use { it.readBytes() }
            WebResourceResponse(EncryptedAssets.mimeOf(rel), "utf-8", ByteArrayInputStream(b))
        } catch (e: Exception) { notFound() }
    }

    private fun notFound() = WebResourceResponse("text/plain", "utf-8", 404, "Not Found", mapOf("Access-Control-Allow-Origin" to "*"), ByteArrayInputStream(ByteArray(0)))
}
