package app.apkify.shell.mod

import android.content.Context
import android.net.Uri
import androidx.mediarouter.app.MediaRouteChooserDialog
import androidx.mediarouter.media.MediaRouteSelector
import app.apkify.shell.MainActivity
import app.apkify.shell.Plugin
import app.apkify.shell.Reply
import app.apkify.shell.str
import com.google.android.gms.cast.CastMediaControlIntent
import com.google.android.gms.cast.MediaInfo
import com.google.android.gms.cast.MediaLoadRequestData
import com.google.android.gms.cast.MediaMetadata
import com.google.android.gms.cast.framework.CastContext
import com.google.android.gms.cast.framework.CastOptions
import com.google.android.gms.cast.framework.CastSession
import com.google.android.gms.cast.framework.OptionsProvider
import com.google.android.gms.cast.framework.SessionManagerListener
import com.google.android.gms.cast.framework.SessionProvider
import com.google.android.gms.common.images.WebImage
import org.json.JSONObject

/** Chromecast: pilih perangkat, putar video/audio URL di TV, kontrol play/pause/stop/seek. */
class CastPlugin(host: MainActivity) : Plugin(host) {
    override val prefixes = setOf("cast")
    override fun enabled(prefix: String) = cfg.on("cast")

    private val ctx by lazy { CastContext.getSharedInstance(host) }
    private var pending: Pair<JSONObject, Reply>? = null

    private val listener = object : SessionManagerListener<CastSession> {
        override fun onSessionStarted(s: CastSession, id: String) { emit("cast", JSONObject().put("state", "connected").put("device", s.castDevice?.friendlyName ?: "")); pending?.let { (a, r) -> pending = null; load(s, a, r) } }
        override fun onSessionResumed(s: CastSession, wasSuspended: Boolean) = onSessionStarted(s, "")
        override fun onSessionEnded(s: CastSession, error: Int) { emit("cast", JSONObject().put("state", "disconnected")) }
        override fun onSessionStartFailed(s: CastSession, error: Int) { pending?.second?.err("gagal terhubung ($error)"); pending = null }
        override fun onSessionStarting(s: CastSession) {}
        override fun onSessionEnding(s: CastSession) {}
        override fun onSessionResuming(s: CastSession, id: String) {}
        override fun onSessionResumeFailed(s: CastSession, error: Int) {}
        override fun onSessionSuspended(s: CastSession, reason: Int) {}
    }
    private var registered = false

    override fun handle(prefix: String, cmd: String, a: JSONObject, r: Reply) {
        if (!registered) { ctx.sessionManager.addSessionManagerListener(listener, CastSession::class.java); registered = true }
        val session = ctx.sessionManager.currentCastSession
        val rm = session?.remoteMediaClient
        when (cmd) {
            "load" -> if (session != null && session.isConnected) load(session, a, r) else { pending = a to r; chooser() }
            "select" -> { chooser(); r.ok() }
            "play" -> { rm?.play(); r.ok() }
            "pause" -> { rm?.pause(); r.ok() }
            "stop" -> { ctx.sessionManager.endCurrentSession(true); r.ok() }
            "seek" -> { rm?.seek(com.google.android.gms.cast.MediaSeekOptions.Builder().setPosition((a.optDouble("seconds") * 1000).toLong()).build()); r.ok() }
            "status" -> r.ok(JSONObject().put("connected", session?.isConnected == true).put("device", session?.castDevice?.friendlyName ?: "")
                .put("playing", rm?.isPlaying == true).put("position", (rm?.approximateStreamPosition ?: 0) / 1000.0))
            else -> r.err("unknown cast.$cmd")
        }
    }

    private fun chooser() {
        val sel = MediaRouteSelector.Builder().addControlCategory(CastMediaControlIntent.categoryForCast(CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID)).build()
        MediaRouteChooserDialog(host).apply { routeSelector = sel }.show()
    }

    private fun load(s: CastSession, a: JSONObject, r: Reply) {
        val type = a.str("contentType", if (a.str("url").contains(".m3u8")) "application/x-mpegURL" else "video/mp4")
        val md = MediaMetadata(if (type.startsWith("audio")) MediaMetadata.MEDIA_TYPE_MUSIC_TRACK else MediaMetadata.MEDIA_TYPE_MOVIE).apply {
            putString(MediaMetadata.KEY_TITLE, a.str("title", cfg.name)); putString(MediaMetadata.KEY_SUBTITLE, a.str("subtitle"))
            a.str("image").takeIf { it.startsWith("http") }?.let { addImage(WebImage(Uri.parse(it))) }
        }
        val info = MediaInfo.Builder(a.str("url")).setStreamType(if (a.optBoolean("live")) MediaInfo.STREAM_TYPE_LIVE else MediaInfo.STREAM_TYPE_BUFFERED)
            .setContentType(type).setMetadata(md).build()
        val rm = s.remoteMediaClient ?: return r.err("tidak ada klien media")
        rm.load(MediaLoadRequestData.Builder().setMediaInfo(info).setAutoplay(true).setCurrentTime((a.optDouble("start", 0.0) * 1000).toLong()).build())
            .setResultCallback { res -> if (res.status.isSuccess) r.ok() else r.err("gagal memutar (${res.status.statusCode})") }
    }

    override fun onDestroy() { if (registered) ctx.sessionManager.removeSessionManagerListener(listener, CastSession::class.java) }
}

/** Dirujuk dari manifest (OPTIONS_PROVIDER_CLASS_NAME). */
class CastOptionsProvider : OptionsProvider {
    override fun getCastOptions(c: Context): CastOptions = CastOptions.Builder().setReceiverApplicationId(CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID).build()
    override fun getAdditionalSessionProviders(c: Context): List<SessionProvider>? = null
}
