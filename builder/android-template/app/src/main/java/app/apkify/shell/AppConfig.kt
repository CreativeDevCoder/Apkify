package app.apkify.shell

import android.content.Context
import org.json.JSONObject

/** Konfigurasi runtime dari assets/apkify.json (ditulis builder). */
class AppConfig(private val json: JSONObject) {
    val name: String = json.optString("name")
    val packageName: String = json.optString("packageName")
    val versionCode: Int = json.optInt("versionCode", 1)
    val versionName: String = json.optString("versionName")
    val startUrl: String = json.optString("startUrl")
    val local: Boolean = json.optBoolean("local")
    val encrypted: Boolean = json.optBoolean("encrypted")
    val userAgentSuffix: String = json.optString("userAgentSuffix")
    val appId: String = json.optString("appId")
    val apiBase: String = json.optString("apiBase").trimEnd('/')
    val exitText: String = json.optString("exitText", "Keluar dari aplikasi?")
    val splashDurationMs: Long = json.optLong("splashDurationMs", 0)
    val progressStyle: String = json.optJSONObject("progress")?.optString("style", "bar") ?: "bar"

    private val colors = json.optJSONObject("colors") ?: JSONObject()
    val primary: String = colors.optString("primary", "#4f46e5")
    val statusBar: String = colors.optString("statusBar", "#3730a3")
    val accent: String = colors.optString("accent", primary)

    private val f = json.optJSONObject("features") ?: JSONObject()
    private fun flag(k: String, d: Boolean = false) = f.optBoolean(k, d)
    val pullToRefresh = flag("pullToRefresh", true)
    val fileUpload = flag("fileUpload", true)
    val downloads = flag("downloads", true)
    val externalLinksInBrowser = flag("externalLinksInBrowser", true)
    val offlinePage = flag("offlinePage", true)
    val geolocation = flag("geolocation")
    val camera = flag("camera")
    val microphone = flag("microphone") || flag("camera") // konfigurasi lama: kamera termasuk mikrofon
    val vibrate = flag("vibrate")
    val zoom = flag("zoom")
    val zoomButtons = flag("zoomButtons")
    val scrollbars = flag("scrollbars", true)
    val textSelection = flag("textSelection", true)
    val saveFormData = flag("saveFormData", true)
    val keepAwake = flag("keepAwake")
    val fullscreen = flag("fullscreen")
    val disallowScreenshot = flag("disallowScreenshot")
    val confirmExit = flag("confirmExit")
    val popupBlocker = flag("popupBlocker")
    val httpsOnly = flag("httpsOnly", true)
    val allowFileAccess = flag("allowFileAccess")
    val crossOrigin = flag("crossOrigin")
    val sideMenu = flag("sideMenu")
    val showToolbar = flag("showToolbar") || sideMenu
    val liveTitle = flag("liveTitle")
    val homeButton = flag("homeButton")
    val hideWebViewUA = flag("hideWebViewUA")
    val hideMobileUA = flag("hideMobileUA")
    val desktopMode = flag("desktopMode")
    val admob = flag("admob")
    val interstitial = flag("interstitial")
    val onesignal = flag("onesignal")
    val jsApi = flag("jsApi")
    val remoteUpdate = flag("remoteUpdate")
    val cacheMode: String = f.optString("cacheMode", "default")

    private val sm = json.optJSONObject("sideMenu") ?: JSONObject()
    val about: String = sm.optString("about")
    val contactEmail: String = sm.optString("contactEmail")
    val shareText: String = sm.optString("shareText")
    val links: List<Pair<String, String>> = sm.optJSONArray("links")?.let { arr ->
        (0 until arr.length()).mapNotNull { i -> arr.optJSONObject(i)?.let { it.optString("label") to it.optString("url") } }
    } ?: emptyList()

    private val ad = json.optJSONObject("admob") ?: JSONObject()
    val admobBannerId: String = ad.optString("bannerId")
    val admobInterstitialId: String = ad.optString("interstitialId")
    val interstitialEvery: Int = ad.optInt("interstitialEvery", 4).coerceIn(2, 20)
    val onesignalAppId: String = json.optJSONObject("onesignal")?.optString("appId").orEmpty()

    val tawkPropertyId: String = json.optJSONObject("tawk")?.optString("propertyId").orEmpty()
    val tawkWidgetId: String = json.optJSONObject("tawk")?.optString("widgetId", "default").orEmpty()
    val supabaseUrl: String = json.optJSONObject("supabase")?.optString("url").orEmpty()
    val supabaseAnonKey: String = json.optJSONObject("supabase")?.optString("anonKey").orEmpty()

    /** Objek window.APKIFY yang disuntikkan ke halaman */
    fun publicJson(): String = JSONObject().apply {
        put("appId", appId); put("name", name); put("packageName", packageName)
        put("versionName", versionName); put("versionCode", versionCode)
        if (supabaseUrl.isNotBlank()) { put("supabaseUrl", supabaseUrl); put("supabaseAnonKey", supabaseAnonKey) }
    }.toString()

    companion object {
        @Volatile private var cached: AppConfig? = null
        fun get(ctx: Context): AppConfig = cached ?: synchronized(this) {
            cached ?: AppConfig(JSONObject(ctx.assets.open("apkify.json").bufferedReader().use { it.readText() })).also { cached = it }
        }
    }
}
