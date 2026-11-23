package app.apkify.shell

import android.content.Context

/** Varian tanpa Firebase Cloud Messaging. */
object Fcm {
    fun token(ctx: Context, cb: (String?) -> Unit) = cb(null)
}
