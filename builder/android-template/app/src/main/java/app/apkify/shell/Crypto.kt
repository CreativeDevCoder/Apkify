package app.apkify.shell

import android.content.Context
import android.webkit.MimeTypeMap
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

    /** isi asli berkas terenkripsi (rel relatif terhadap www/), null bila tidak ada */
    fun bytes(rel: String): ByteArray? {
        val data = try { ctx.assets.open("www_enc/$rel").use { it.readBytes() } } catch (e: FileNotFoundException) { return null }
        return try {
            val c = Cipher.getInstance("AES/GCM/NoPadding")
            c.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, data, 0, 12))
            c.doFinal(data, 12, data.size - 12)
        } catch (e: Exception) { null }
    }

    companion object {
    fun isText(mime: String) = mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") || mime.contains("svg") || mime.contains("xml")

    fun mimeOf(name: String): String {
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
}
