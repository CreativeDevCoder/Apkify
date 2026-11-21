package app.apkify.shell

import android.app.Activity
import android.widget.FrameLayout

/** Varian tanpa AdMob: tidak ada dependency iklan di APK. */
object Ads {
    fun init(activity: Activity, container: FrameLayout, bannerId: String) {}
    fun destroy() {}
}
