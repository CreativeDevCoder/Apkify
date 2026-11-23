package app.apkify.shell

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.widget.Toast
import org.json.JSONObject

/**
 * Jembatan JS. retry()/primaryColor() selalu ada (dipakai halaman offline);
 * API native lain hanya aktif bila fitur "JavaScript APIs" dinyalakan.
 * Di halaman tersedia sebagai window.Apkify (lihat Scripts.apiShim).
 */
class Bridge(private val activity: MainActivity) {
    private val cfg = AppConfig.get(activity)
    private inline fun api(crossinline block: () -> Unit) { if (cfg.jsApi) activity.runOnUiThread { block() } }

    @JavascriptInterface fun retry() { activity.runOnUiThread { activity.reloadStart() } }
    @JavascriptInterface fun primaryColor(): String = cfg.primary

    @JavascriptInterface fun toast(msg: String) = api { Toast.makeText(activity, msg.take(300), Toast.LENGTH_SHORT).show() }

    @JavascriptInterface fun vibrate(ms: Int) = api {
        val v = activity.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return@api
        val d = ms.coerceIn(10, 2000).toLong()
        if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(d, VibrationEffect.DEFAULT_AMPLITUDE)) else @Suppress("DEPRECATION") v.vibrate(d)
    }

    @JavascriptInterface fun share(text: String) = api { activity.shareText(text.take(2000)) }

    @JavascriptInterface fun copy(text: String) = api {
        (activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("text", text.take(10000)))
    }

    @JavascriptInterface fun openExternal(url: String) = api {
        if (url.startsWith("http") || url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("whatsapp:")) activity.openExternal(Uri.parse(url))
    }

    @JavascriptInterface fun keepScreenOn(on: Boolean) = api {
        if (on) activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) else activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    @JavascriptInterface fun exit() = api { activity.finish() }

    @JavascriptInterface fun deviceInfo(): String = if (!cfg.jsApi) "{}" else JSONObject().apply {
        put("manufacturer", Build.MANUFACTURER); put("model", Build.MODEL); put("sdk", Build.VERSION.SDK_INT); put("release", Build.VERSION.RELEASE)
        put("language", java.util.Locale.getDefault().toLanguageTag())
    }.toString()

    @JavascriptInterface fun appInfo(): String = cfg.publicJson()

    /** Panggilan asinkron generik: hasil dikirim ke window.__apkifyCb(id, json) */
    @JavascriptInterface fun call(cmd: String, args: String, id: String) {
        val json = runCatching { org.json.JSONObject(args) }.getOrDefault(org.json.JSONObject())
        activity.runOnUiThread { activity.native.handle(cmd, json, id) }
    }

    // Penyimpanan native (SharedPreferences) — bertahan walau cache WebView dibersihkan
    private val store by lazy { activity.getSharedPreferences("apkify_store", android.content.Context.MODE_PRIVATE) }
    @JavascriptInterface fun storageGet(key: String): String? = if (cfg.nativeStorage) store.getString(key.take(200), null) else null
    @JavascriptInterface fun storageSet(key: String, value: String) { if (cfg.nativeStorage && value.length <= 100_000) store.edit().putString(key.take(200), value).apply() }
    @JavascriptInterface fun storageRemove(key: String) { if (cfg.nativeStorage) store.edit().remove(key.take(200)).apply() }
    @JavascriptInterface fun storageKeys(): String = if (cfg.nativeStorage) org.json.JSONArray(store.all.keys.toList()).toString() else "[]"
}
