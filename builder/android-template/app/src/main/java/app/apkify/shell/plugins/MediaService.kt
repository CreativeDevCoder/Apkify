package app.apkify.shell

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.IBinder
import org.json.JSONObject
import java.net.URL
import kotlin.concurrent.thread

/**
 * Foreground service "mediaPlayback": menjaga audio halaman tetap berbunyi saat aplikasi
 * di latar / layar terkunci, menampilkan kontrol di notifikasi & layar kunci (MediaSession).
 * Tombol kontrol diteruskan ke halaman sebagai event 'media' {action: play|pause|next|previous|stop}.
 */
class MediaService : Service() {
    private var session: MediaSession? = null
    private var meta = JSONObject()
    private var art: Bitmap? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        running = true
        session = MediaSession(this, "apkify").apply {
            setCallback(object : MediaSession.Callback() {
                override fun onPlay() = send("play")
                override fun onPause() = send("pause")
                override fun onSkipToNext() = send("next")
                override fun onSkipToPrevious() = send("previous")
                override fun onStop() = send("stop")
                override fun onSeekTo(pos: Long) = send("seek:$pos")
            })
            isActive = true
        }
    }

    private fun send(action: String) {
        listener?.invoke(action)
        if (action == "play" || action == "pause") { meta.put("playing", action == "play"); update() }
        if (action == "stop") stopSelf()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        intent?.getStringExtra("action")?.let { send(it); return START_NOT_STICKY }
        intent?.getStringExtra("meta")?.let { s ->
            val n = runCatching { JSONObject(s) }.getOrDefault(JSONObject())
            val oldArt = meta.optString("artwork")
            n.keys().forEach { k -> meta.put(k, n.get(k)) }
            val newArt = meta.optString("artwork")
            if (newArt.startsWith("http") && newArt != oldArt) thread { art = runCatching { URL(newArt).openStream().use { BitmapFactory.decodeStream(it) } }.getOrNull(); update() }
        }
        update()
        return START_NOT_STICKY
    }

    private fun action(icon: Int, title: String, act: String): Notification.Action {
        val pi = PendingIntent.getService(this, act.hashCode(), Intent(this, MediaService::class.java).putExtra("action", act), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        @Suppress("DEPRECATION") return Notification.Action.Builder(icon, title, pi).build()
    }

    private fun update() {
        val s = session ?: return
        val playing = meta.optBoolean("playing", true)
        s.setMetadata(MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, meta.optString("title", AppConfig.get(this).name))
            .putString(MediaMetadata.METADATA_KEY_ARTIST, meta.optString("artist"))
            .putString(MediaMetadata.METADATA_KEY_ALBUM, meta.optString("album"))
            .putLong(MediaMetadata.METADATA_KEY_DURATION, (meta.optDouble("duration", 0.0) * 1000).toLong())
            .apply { art?.let { putBitmap(MediaMetadata.METADATA_KEY_ART, it) } }.build())
        s.setPlaybackState(PlaybackState.Builder()
            .setActions(PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_SKIP_TO_NEXT or PlaybackState.ACTION_SKIP_TO_PREVIOUS or PlaybackState.ACTION_STOP or PlaybackState.ACTION_SEEK_TO)
            .setState(if (playing) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED, (meta.optDouble("position", 0.0) * 1000).toLong(), if (playing) 1f else 0f).build())

        if (Build.VERSION.SDK_INT >= 26) (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
            .createNotificationChannel(NotificationChannel(CH, "Pemutar media", NotificationManager.IMPORTANCE_LOW))
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        @Suppress("DEPRECATION")
        val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CH) else Notification.Builder(this)
        b.setSmallIcon(applicationInfo.icon).setContentTitle(meta.optString("title", AppConfig.get(this).name)).setContentText(meta.optString("artist"))
            .setContentIntent(open).setOngoing(playing).setVisibility(Notification.VISIBILITY_PUBLIC)
            .addAction(action(android.R.drawable.ic_media_previous, "Sebelumnya", "previous"))
            .addAction(if (playing) action(android.R.drawable.ic_media_pause, "Jeda", "pause") else action(android.R.drawable.ic_media_play, "Putar", "play"))
            .addAction(action(android.R.drawable.ic_media_next, "Berikutnya", "next"))
            .setStyle(Notification.MediaStyle().setMediaSession(s.sessionToken).setShowActionsInCompactView(0, 1, 2))
        art?.let { b.setLargeIcon(it) }
        val n = b.build()
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK) else startForeground(ID, n)
    }

    override fun onDestroy() {
        running = false
        session?.release(); session = null
        listener?.invoke("stopped")
        super.onDestroy()
    }

    companion object {
        @Volatile var running = false
        var listener: ((String) -> Unit)? = null
        private const val CH = "apkify_media"
        private const val ID = 4242
    }
}
