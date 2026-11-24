package app.apkify.shell.mod

import android.os.Bundle
import app.apkify.shell.MainActivity
import app.apkify.shell.Plugin
import app.apkify.shell.Reply
import app.apkify.shell.str
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.crashlytics.FirebaseCrashlytics
import org.json.JSONObject

/**
 * Firebase Analytics (event, user ID, properti, screen view) & Crashlytics (crash native otomatis,
 * log & error dari JavaScript). Butuh google-services.json.
 */
class FirebasePlugin(host: MainActivity) : Plugin(host) {
    override val prefixes = setOf("analytics", "crashlytics")
    override fun enabled(prefix: String) = if (prefix == "analytics") cfg.on("firebaseAnalytics") else cfg.on("crashlytics")

    private val fa by lazy { FirebaseAnalytics.getInstance(host) }

    private fun bundle(o: JSONObject?) = Bundle().apply {
        o?.keys()?.forEach { k ->
            when (val v = o.get(k)) {
                is Int -> putLong(k, v.toLong()); is Long -> putLong(k, v); is Double -> putDouble(k, v); is Boolean -> putLong(k, if (v) 1 else 0)
                else -> putString(k, v.toString().take(100))
            }
        }
    }

    override fun handle(prefix: String, cmd: String, a: JSONObject, r: Reply) {
        if (prefix == "analytics") when (cmd) {
            "log" -> { fa.logEvent(a.str("name").replace(Regex("[^A-Za-z0-9_]"), "_").take(40), bundle(a.optJSONObject("params"))); r.ok() }
            "screen" -> { fa.logEvent(FirebaseAnalytics.Event.SCREEN_VIEW, Bundle().apply { putString(FirebaseAnalytics.Param.SCREEN_NAME, a.str("name")); putString(FirebaseAnalytics.Param.SCREEN_CLASS, a.str("class", "WebView")) }); r.ok() }
            "setUserId" -> { fa.setUserId(a.str("id").ifBlank { null }); r.ok() }
            "setUserProperty" -> { fa.setUserProperty(a.str("name"), a.str("value").ifBlank { null }); r.ok() }
            "setEnabled" -> { fa.setAnalyticsCollectionEnabled(a.optBoolean("enabled", true)); r.ok() }
            else -> r.err("unknown analytics.$cmd")
        } else {
            val c = FirebaseCrashlytics.getInstance()
            when (cmd) {
                "log" -> { c.log(a.str("message")); r.ok() }
                "recordError" -> { c.recordException(JsError(a.str("message", "JS error"), a.str("stack"))); r.ok() }
                "setUserId" -> { c.setUserId(a.str("id")); r.ok() }
                "setKey" -> { c.setCustomKey(a.str("key"), a.str("value")); r.ok() }
                "crash" -> { r.ok(); main.postDelayed({ throw RuntimeException("Uji crash dari Apkify.crashlytics.crash()") }, 300) }
                else -> r.err("unknown crashlytics.$cmd")
            }
        }
    }

    class JsError(msg: String, private val js: String) : Exception(msg) {
        override fun toString() = "JsError: $message\n$js"
    }
}
