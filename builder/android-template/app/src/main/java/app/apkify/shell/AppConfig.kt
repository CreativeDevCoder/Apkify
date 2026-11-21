package app.apkify.shell

import android.content.Context
import org.json.JSONObject

/** Konfigurasi runtime dari assets/apkify.json (ditulis builder). */
class AppConfig(json: JSONObject) {
    val name: String = json.optString("name")
    val startUrl: String = json.optString("startUrl")
    val local: Boolean = json.optBoolean("local")
    val userAgentSuffix: String = json.optString("userAgentSuffix")
    val encrypted: Boolean = json.optBoolean("encrypted")

    private val colors = json.optJSONObject("colors") ?: JSONObject()
    val primary: String = colors.optString("primary", "#4f46e5")
    val statusBar: String = colors.optString("statusBar", "#3730a3")

    private val f = json.optJSONObject("features") ?: JSONObject()
    val pullToRefresh = f.optBoolean("pullToRefresh", true)
    val fileUpload = f.optBoolean("fileUpload", true)
    val downloads = f.optBoolean("downloads", true)
    val externalLinksInBrowser = f.optBoolean("externalLinksInBrowser", true)
    val offlinePage = f.optBoolean("offlinePage", true)
    val geolocation = f.optBoolean("geolocation")
    val camera = f.optBoolean("camera")
    val zoom = f.optBoolean("zoom")
    val keepAwake = f.optBoolean("keepAwake")
    val fullscreen = f.optBoolean("fullscreen")
    val sideMenu = f.optBoolean("sideMenu")
    val admob = f.optBoolean("admob")
    val onesignal = f.optBoolean("onesignal")
    val cacheMode: String = f.optString("cacheMode", "default")

    private val sm = json.optJSONObject("sideMenu") ?: JSONObject()
    val about: String = sm.optString("about")
    val contactEmail: String = sm.optString("contactEmail")
    val shareText: String = sm.optString("shareText")
    val links: List<Pair<String, String>> = sm.optJSONArray("links")?.let { arr ->
        (0 until arr.length()).mapNotNull { i ->
            arr.optJSONObject(i)?.let { it.optString("label") to it.optString("url") }
        }
    } ?: emptyList()

    val admobBannerId: String = json.optJSONObject("admob")?.optString("bannerId").orEmpty()
    val onesignalAppId: String = json.optJSONObject("onesignal")?.optString("appId").orEmpty()

    companion object {
        @Volatile private var cached: AppConfig? = null
        fun get(ctx: Context): AppConfig = cached ?: synchronized(this) {
            cached ?: AppConfig(JSONObject(ctx.assets.open("apkify.json").bufferedReader().use { it.readText() })).also { cached = it }
        }
    }
}
