package app.apkify.shell

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/** Firebase Cloud Messaging: token untuk server Anda + tampilan notifikasi (klik membuka URL dari data "url"). */
object Fcm {
    fun token(ctx: Context, cb: (String?) -> Unit) {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { t -> cb(if (t.isSuccessful) t.result else null) }
    }
}

class FcmService : FirebaseMessagingService() {
    override fun onMessageReceived(msg: RemoteMessage) {
        val title = msg.notification?.title ?: msg.data["title"] ?: return
        val body = msg.notification?.body ?: msg.data["body"].orEmpty()
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel("default", "Notifikasi", NotificationManager.IMPORTANCE_DEFAULT))
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            msg.data["url"]?.let { data = Uri.parse(it) }
        }
        val pi = PendingIntent.getActivity(this, msg.messageId?.hashCode() ?: 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val n = NotificationCompat.Builder(this, "default")
            .setSmallIcon(R.mipmap.ic_launcher).setContentTitle(title).setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body)).setAutoCancel(true).setContentIntent(pi).build()
        nm.notify(System.currentTimeMillis().toInt(), n)
    }
}
