package app.apkify.shell

import android.content.Context
import android.webkit.MimeTypeMap
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.io.FileNotFoundException
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Menyajikan konten ZIP/HTML yang dienkripsi builder (assets/www_enc).
 * Format file: iv(12) | ciphertext | tag(16), AES-256-GCM.
 */
class EncryptedAssets(private val ctx: Context) {
    private val key by lazy { SecretKeySpec(K.k(), "AES") }

    fun serve(path: String): WebResourceResponse? {
        // path relatif terhadap /assets/www/
        var rel = path.trimStart('/').substringBefore('?').substringBefore('#')
        if (rel.isEmpty() || rel.endsWith("/")) rel += "index.html"
        if (rel.contains("..")) return null
        val bytes = try {
            ctx.assets.open("www_enc/$rel").use { it.readBytes() }
        } catch (e: FileNotFoundException) {
            return WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, ByteArrayInputStream(ByteArray(0)))
        }
        val plain = try {
            val c = Cipher.getInstance("AES/GCM/NoPadding")
            c.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, bytes, 0, 12))
            c.doFinal(bytes, 12, bytes.size - 12)
        } catch (e: Exception) {
            return null
        }
        val mime = mimeOf(rel)
        val text = mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") || mime.contains("svg") || mime.contains("xml")
        return WebResourceResponse(mime, if (text) "utf-8" else null, ByteArrayInputStream(plain)).apply {
            responseHeaders = mapOf("Cache-Control" to "no-cache", "Access-Control-Allow-Origin" to "*")
        }
    }

    private fun mimeOf(name: String): String {
        val ext = name.substringAfterLast('.', "").lowercase()
        return when (ext) {
            "html", "htm" -> "text/html"
            "js", "mjs" -> "text/javascript"
            "css" -> "text/css"
            "json", "map" -> "application/json"
            "svg" -> "image/svg+xml"
            "wasm" -> "application/wasm"
            "webmanifest" -> "application/manifest+json"
            "woff2" -> "font/woff2"
            "woff" -> "font/woff"
            "ttf" -> "font/ttf"
            else -> MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: "application/octet-stream"
        }
    }
}
