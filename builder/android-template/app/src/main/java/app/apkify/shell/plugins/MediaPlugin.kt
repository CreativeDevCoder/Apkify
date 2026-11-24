package app.apkify.shell

import android.Manifest
import android.app.Activity
import android.app.DownloadManager
import android.app.PictureInPictureParams
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Environment
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import android.print.PrintManager
import android.provider.MediaStore
import android.speech.RecognizerIntent
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Rational
import android.webkit.CookieManager
import android.webkit.URLUtil
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.Locale

/**
 * Media: text-to-speech, speech-to-text, rekam audio, cetak (Android Print), penampil PDF native,
 * simpan ke galeri, unduhan dengan progres, Picture-in-Picture, audio latar + kontrol layar kunci.
 */
class MediaPlugin(host: MainActivity) : Plugin(host) {
    override val prefixes = setOf("tts", "stt", "recorder", "print", "pdf", "gallery", "download", "pip", "media")
    override fun enabled(prefix: String) = when (prefix) {
        "tts" -> cfg.on("tts")
        "stt" -> cfg.on("speech")
        "recorder" -> cfg.on("audioRecord")
        "print" -> cfg.on("print")
        "pdf" -> cfg.on("pdfViewer")
        "gallery" -> cfg.on("saveGallery")
        "download" -> cfg.on("downloads") && cfg.jsApi
        "pip" -> cfg.on("pip")
        "media" -> cfg.on("backgroundAudio")
        else -> false
    }

    override fun handle(prefix: String, cmd: String, a: JSONObject, r: Reply) {
        when (prefix) {
            "tts" -> tts(cmd, a, r)
            "stt" -> stt(a, r)
            "recorder" -> recorder(cmd, a, r)
            "print" -> print(a, r)
            "pdf" -> r.bg { val f = AppFiles.resolve(host, a, "pdf"); ui { openPdf(host, f, a.str("title")) }; r.ok() }
            "gallery" -> r.bg { r.ok(saveToGallery(host, AppFiles.resolve(host, a, "jpg"), a.str("name"), a.str("album", cfg.name))) }
            "download" -> download(cmd, a, r)
            "pip" -> pip(cmd, a, r)
            "media" -> media(cmd, a, r)
        }
    }

    // ---------------- TTS ----------------
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private val ttsWaiting = ArrayDeque<() -> Unit>()
    private val ttsReplies = HashMap<String, Reply>()

    private fun withTts(go: () -> Unit) {
        if (ttsReady) return go()
        ttsWaiting.addLast(go)
        if (tts == null) tts = TextToSpeech(host) { st ->
            ttsReady = st == TextToSpeech.SUCCESS
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(id: String) {}
                override fun onDone(id: String) { ttsReplies.remove(id)?.ok() }
                @Deprecated("deprecated") override fun onError(id: String) { ttsReplies.remove(id)?.err("tts error") }
            })
            ui { while (ttsWaiting.isNotEmpty()) ttsWaiting.removeFirst().invoke() }
        }
    }

    private fun tts(cmd: String, a: JSONObject, r: Reply) = withTts {
        val t = tts ?: return@withTts r.err("TTS tidak tersedia")
        if (!ttsReady) return@withTts r.err("mesin TTS tidak tersedia")
        when (cmd) {
            "speak" -> {
                a.str("lang").takeIf { it.isNotEmpty() }?.let { t.language = Locale.forLanguageTag(it) }
                t.setSpeechRate(a.optDouble("rate", 1.0).toFloat()); t.setPitch(a.optDouble("pitch", 1.0).toFloat())
                val id = "u${System.nanoTime()}"
                ttsReplies[id] = r
                t.speak(a.str("text").take(3900), if (a.optBoolean("queue")) TextToSpeech.QUEUE_ADD else TextToSpeech.QUEUE_FLUSH, Bundle(), id)
            }
            "stop" -> { t.stop(); ttsReplies.values.forEach { it.err("stopped") }; ttsReplies.clear(); r.ok() }
            "languages" -> r.ok("languages", JSONArray(runCatching { t.availableLanguages.map { it.toLanguageTag() } }.getOrDefault(emptyList())))
            else -> r.err("unknown tts.$cmd")
        }
    }

    // ---------------- Speech-to-text (UI Google, tanpa izin mikrofon) ----------------
    private fun stt(a: JSONObject, r: Reply) {
        val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, a.str("lang", Locale.getDefault().toLanguageTag()))
            .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, a.optInt("max", 5))
        a.str("prompt").takeIf { it.isNotEmpty() }?.let { i.putExtra(RecognizerIntent.EXTRA_PROMPT, it) }
        if (i.resolveActivity(host.packageManager) == null) return r.err("pengenalan suara tidak tersedia")
        host.startForResult(i) { code, data ->
            val list = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            if (code != Activity.RESULT_OK || list.isNullOrEmpty()) r.err("cancelled")
            else r.ok(JSONObject().put("text", list[0]).put("alternatives", JSONArray(list)))
        }
    }

    // ---------------- Rekam audio ----------------
    private var rec: MediaRecorder? = null
    private var recFile: File? = null
    private var recStart = 0L

    private fun recorder(cmd: String, a: JSONObject, r: Reply) {
        when (cmd) {
            "start" -> host.requestPerms(listOf(Manifest.permission.RECORD_AUDIO)) { ok ->
                if (!ok) return@requestPerms r.err("izin mikrofon ditolak")
                stopRec()
                val f = AppFiles.newFile(host, "m4a")
                val m = if (Build.VERSION.SDK_INT >= 31) MediaRecorder(host) else @Suppress("DEPRECATION") MediaRecorder()
                m.setAudioSource(MediaRecorder.AudioSource.MIC)
                m.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                m.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                m.setAudioEncodingBitRate(a.optInt("bitrate", 128_000)); m.setAudioSamplingRate(44_100)
                if (a.has("maxSeconds")) m.setMaxDuration(a.optInt("maxSeconds") * 1000)
                m.setOutputFile(f.absolutePath)
                m.prepare(); m.start()
                rec = m; recFile = f; recStart = System.currentTimeMillis()
                r.ok()
            }
            "stop" -> {
                val f = recFile ?: return r.err("tidak sedang merekam")
                val dur = System.currentTimeMillis() - recStart
                stopRec()
                r.ok(AppFiles.describe(f, "audio/mp4", a.optBoolean("base64")).put("durationMs", dur))
            }
            else -> r.err("unknown recorder.$cmd")
        }
    }

    private fun stopRec() { rec?.let { runCatching { it.stop() }; it.release() }; rec = null }

    // ---------------- Cetak ----------------
    private fun print(a: JSONObject, r: Reply) {
        val pm = host.getSystemService(Context.PRINT_SERVICE) as PrintManager
        val name = a.str("name", cfg.name)
        if (!a.has("url") && !a.has("base64")) {
            pm.print(name, host.webView.createPrintDocumentAdapter(name), PrintAttributes.Builder().build())
            return r.ok()
        }
        r.bg {
            val f = AppFiles.resolve(host, a, "pdf")
            ui { pm.print(name, FilePrintAdapter(f, name), null); r.ok() }
        }
    }

    private class FilePrintAdapter(val f: File, val name: String) : PrintDocumentAdapter() {
        override fun onLayout(old: PrintAttributes?, new: PrintAttributes, cancel: CancellationSignal?, cb: LayoutResultCallback, extras: Bundle?) {
            if (cancel?.isCanceled == true) return cb.onLayoutCancelled()
            cb.onLayoutFinished(PrintDocumentInfo.Builder(name).setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT).build(), true)
        }
        override fun onWrite(pages: Array<out PageRange>, dest: ParcelFileDescriptor, cancel: CancellationSignal?, cb: WriteResultCallback) {
            try {
                FileInputStream(f).use { i -> FileOutputStream(dest.fileDescriptor).use { o -> i.copyTo(o) } }
                cb.onWriteFinished(arrayOf(PageRange.ALL_PAGES))
            } catch (e: Exception) { cb.onWriteFailed(e.message) }
        }
    }

    // ---------------- Unduhan dengan progres ----------------
    private fun download(cmd: String, a: JSONObject, r: Reply) {
        val dm = host.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        when (cmd) {
            "start" -> {
                val url = a.str("url")
                if (!url.startsWith("http")) return r.err("url harus http(s)")
                val name = a.str("name").ifBlank { URLUtil.guessFileName(url, null, a.str("mime").ifBlank { null }) }
                val req = DownloadManager.Request(Uri.parse(url)).setTitle(name)
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
                CookieManager.getInstance().getCookie(url)?.let { req.addRequestHeader("Cookie", it) }
                a.optJSONObject("headers")?.let { h -> h.keys().forEach { k -> req.addRequestHeader(k, h.optString(k)) } }
                if (a.str("mime").isNotBlank()) req.setMimeType(a.str("mime"))
                val id = dm.enqueue(req)
                poll(dm, id, r, name)
            }
            "cancel" -> { dm.remove(a.optLong("id")); r.ok() }
            else -> r.err("unknown download.$cmd")
        }
    }

    private fun poll(dm: DownloadManager, id: Long, r: Reply, name: String) {
        main.postDelayed(object : Runnable {
            override fun run() {
                val c = dm.query(DownloadManager.Query().setFilterById(id)) ?: return r.err("unduhan hilang")
                c.use {
                    if (!it.moveToFirst()) return r.err("unduhan dibatalkan")
                    val status = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                    val done = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
                    val total = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                    emit("download", JSONObject().put("id", id).put("name", name).put("loaded", done).put("total", total)
                        .put("progress", if (total > 0) done.toDouble() / total else JSONObject.NULL))
                    when (status) {
                        DownloadManager.STATUS_SUCCESSFUL -> r.ok(JSONObject().put("id", id).put("name", name).put("size", total)
                            .put("uri", dm.getUriForDownloadedFile(id)?.toString() ?: ""))
                        DownloadManager.STATUS_FAILED -> r.err("unduhan gagal (${it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))})")
                        else -> main.postDelayed(this, 500)
                    }
                }
            }
        }, 300)
    }

    // ---------------- Picture-in-Picture ----------------
    var autoPip = false
    private fun pip(cmd: String, a: JSONObject, r: Reply) {
        if (Build.VERSION.SDK_INT < 26 || !host.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)) return r.err("PiP tidak didukung")
        val ratio = a.optJSONArray("aspect")?.let { Rational(it.optInt(0, 16), it.optInt(1, 9)) } ?: Rational(16, 9)
        when (cmd) {
            "enter" -> r.ok("entered", host.enterPictureInPictureMode(PictureInPictureParams.Builder().setAspectRatio(ratio).build()))
            "auto" -> { autoPip = a.optBoolean("enable", true); r.ok() }
            else -> r.err("unknown pip.$cmd")
        }
    }

    fun onUserLeave() {
        if (autoPip && Build.VERSION.SDK_INT >= 26) runCatching { host.enterPictureInPictureMode(PictureInPictureParams.Builder().build()) }
    }

    override fun onPipChanged(inPip: Boolean) { emit("pip", JSONObject().put("active", inPip)) }

    // ---------------- Audio latar + kontrol layar kunci ----------------
    private fun media(cmd: String, a: JSONObject, r: Reply) {
        when (cmd) {
            "start", "update" -> {
                val go = {
                    MediaService.listener = { action -> host.runOnUiThread { emit("media", JSONObject().put("action", action)) } }
                    val i = Intent(host, MediaService::class.java).putExtra("meta", a.toString())
                    if (Build.VERSION.SDK_INT >= 26) host.startForegroundService(i) else host.startService(i)
                    r.ok()
                }
                if (Build.VERSION.SDK_INT >= 33) host.requestPerms(listOf(Manifest.permission.POST_NOTIFICATIONS)) { go() } else go()
            }
            "stop" -> { host.stopService(Intent(host, MediaService::class.java)); r.ok() }
            else -> r.err("unknown media.$cmd")
        }
    }

    override fun onDestroy() {
        tts?.shutdown(); tts = null
        stopRec()
    }

    companion object {
        fun openPdf(ctx: Context, f: File, title: String) {
            ctx.startActivity(Intent(ctx, PdfActivity::class.java).putExtra("path", f.absolutePath).putExtra("title", title))
        }

        /** Simpan gambar/video ke galeri (MediaStore). Panggil dari thread latar. */
        fun saveToGallery(ctx: Context, f: File, name: String, album: String): JSONObject {
            val mime = EncryptedAssets.mimeOf(name.ifBlank { f.name }).let { if (it == "application/octet-stream") "image/jpeg" else it }
            val video = mime.startsWith("video/")
            val fileName = name.ifBlank { "IMG_${System.currentTimeMillis()}.${f.extension.ifBlank { "jpg" }}" }
            val collection = if (video) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            val cv = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                put(MediaStore.MediaColumns.MIME_TYPE, mime)
                if (Build.VERSION.SDK_INT >= 29) {
                    put(MediaStore.MediaColumns.RELATIVE_PATH, (if (video) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES) + "/" + album.replace(Regex("[^\\w .-]"), "").ifBlank { "App" })
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                } else {
                    val dir = File(Environment.getExternalStoragePublicDirectory(if (video) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES), album).apply { mkdirs() }
                    @Suppress("DEPRECATION") put(MediaStore.MediaColumns.DATA, File(dir, fileName).absolutePath)
                }
            }
            val uri = ctx.contentResolver.insert(collection, cv) ?: throw IllegalStateException("gagal menyimpan ke galeri")
            ctx.contentResolver.openOutputStream(uri)!!.use { o -> f.inputStream().use { it.copyTo(o) } }
            if (Build.VERSION.SDK_INT >= 29) ctx.contentResolver.update(uri, ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }, null, null)
            return JSONObject().put("uri", uri.toString()).put("name", fileName)
        }
    }
}
