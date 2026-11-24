package app.apkify.shell

import android.os.SystemClock
import android.widget.FrameLayout
import org.json.JSONObject

/** Kontrak jaringan iklan. Implementasi ada di source set ads_<jaringan> dan dimuat lewat refleksi. */
interface AdProvider {
    /** siapkan SDK; panggil ready() setelah siap (atau gagal) */
    fun init(host: MainActivity, cfg: JSONObject, ready: () -> Unit)
    fun banner(container: FrameLayout)
    fun hideBanner() {}
    fun showInterstitial(done: (Boolean) -> Unit)
    /** done(rewarded, type, amount) */
    fun showRewarded(done: (Boolean, String, Int) -> Unit)
    fun showRewardedInterstitial(done: (Boolean, String, Int) -> Unit) = showRewarded(done)
    fun showAppOpen(done: (Boolean) -> Unit) = done(false)
    fun destroy() {}
}

/**
 * Iklan: banner (atas/bawah, adaptif/collapsible/native), interstitial otomatis setiap N halaman,
 * rewarded, rewarded interstitial, app open. Jaringan: AdMob (+mediasi), AppLovin MAX, Unity Ads,
 * Meta Audience Network, Start.io. API JS: Apkify.ads.*
 */
class AdsPlugin(host: MainActivity) : Plugin(host) {
    override val prefixes = setOf("ads")
    override fun enabled(prefix: String) = provider != null

    private val ads: JSONObject get() = cfg.section("ads")
    private val network: String get() = ads.str("network").ifBlank { if (cfg.admob) "admob" else "" }
    val provider: AdProvider? by lazy {
        val n = network.ifBlank { return@lazy null }
        runCatching { Class.forName("app.apkify.shell.ads.${n.replaceFirstChar { it.uppercase() }}Ads").getConstructor().newInstance() as AdProvider }.getOrNull()
    }
    private var navCount = 0
    private var lastFull = 0L
    private var backgroundAt = 0L
    private var ready = false
    private var showingFull = false

    fun start() {
        val p = provider ?: return
        p.init(host, ads, {
            ready = true
            val pos = ads.str("banner", if (cfg.admobBannerId.isNotBlank() || ads.has("bannerId")) "bottom" else "none")
            if (pos != "none") p.banner(host.findViewById<FrameLayout>(if (pos == "top") R.id.adContainerTop else R.id.adContainer))
            if (ads.optBoolean("appOpen")) showAppOpen()
        })
    }

    private fun gapOk() = SystemClock.elapsedRealtime() - lastFull > ads.optLong("minGapSec", 45) * 1000

    fun onNavigation() {
        val p = provider ?: return
        if (!ready || !(ads.optBoolean("interstitial") || cfg.interstitial)) return
        navCount++
        val every = ads.optInt("interstitialEvery", cfg.interstitialEvery).coerceIn(1, 50)
        if (navCount % every != 0 || !gapOk() || showingFull) return
        showingFull = true
        p.showInterstitial { shown -> showingFull = false; if (shown) lastFull = SystemClock.elapsedRealtime() }
    }

    private fun showAppOpen() {
        val p = provider ?: return
        if (showingFull) return
        showingFull = true
        p.showAppOpen { shown -> showingFull = false; if (shown) lastFull = SystemClock.elapsedRealtime() }
    }

    override fun onPause() { backgroundAt = SystemClock.elapsedRealtime() }
    override fun onResume() {
        if (ready && ads.optBoolean("appOpen") && backgroundAt > 0 && SystemClock.elapsedRealtime() - backgroundAt > 30_000 && gapOk()) showAppOpen()
    }

    override fun handle(prefix: String, cmd: String, a: JSONObject, r: Reply) {
        val p = provider ?: return r.err("iklan tidak aktif")
        if (!ready) return r.err("iklan belum siap")
        val reward = { ok: Boolean, type: String, amount: Int ->
            if (ok) lastFull = SystemClock.elapsedRealtime()
            r.ok(JSONObject().put("rewarded", ok).put("type", type).put("amount", amount))
        }
        when (cmd) {
            "showInterstitial" -> p.showInterstitial { shown -> if (shown) lastFull = SystemClock.elapsedRealtime(); r.ok("shown", shown) }
            "showRewarded" -> p.showRewarded(reward)
            "showRewardedInterstitial" -> p.showRewardedInterstitial(reward)
            "showAppOpen" -> p.showAppOpen { r.ok("shown", it) }
            "hideBanner" -> { p.hideBanner(); r.ok() }
            "showBanner" -> { p.banner(host.findViewById(if (a.str("position", ads.str("banner", "bottom")) == "top") R.id.adContainerTop else R.id.adContainer)); r.ok() }
            "network" -> r.ok("network", network)
            else -> r.err("unknown ads.$cmd")
        }
    }

    override fun onDestroy() { provider?.destroy() }
}
