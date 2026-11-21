package app.apkify.shell

import android.webkit.JavascriptInterface

/**
 * Jembatan JS minimal: hanya fungsi tak berbahaya (muat ulang, warna tema, bagikan teks).
 * Tidak ada akses file, kontak, atau data sensitif.
 */
class Bridge(private val activity: MainActivity) {
    @JavascriptInterface
    fun retry() {
        activity.runOnUiThread { activity.reloadStart() }
    }

    @JavascriptInterface
    fun primaryColor(): String = AppConfig.get(activity).primary

    @JavascriptInterface
    fun share(text: String) {
        activity.runOnUiThread { activity.shareText(text) }
    }
}
