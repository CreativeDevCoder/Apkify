package app.apkify.shell.ads

import android.view.View
import android.widget.FrameLayout
import app.apkify.shell.AdProvider
import app.apkify.shell.MainActivity
import app.apkify.shell.str
import com.unity3d.ads.IUnityAdsInitializationListener
import com.unity3d.ads.IUnityAdsLoadListener
import com.unity3d.ads.IUnityAdsShowListener
import com.unity3d.ads.UnityAdsShowOptions
import com.unity3d.services.banners.BannerView
import com.unity3d.services.banners.UnityBannerSize
import org.json.JSONObject
import com.unity3d.ads.UnityAds as U

/** Unity Ads: banner, interstitial, rewarded. */
class UnityAds : AdProvider {
    private lateinit var host: MainActivity
    private var c = JSONObject()
    private val loaded = HashSet<String>()
    private var banner: BannerView? = null

    override fun init(host: MainActivity, cfg: JSONObject, ready: () -> Unit) {
        this.host = host
        c = cfg.optJSONObject("unity") ?: JSONObject()
        U.initialize(host, c.str("gameId"), c.optBoolean("testMode"), object : IUnityAdsInitializationListener {
            override fun onInitializationComplete() { host.runOnUiThread { load(c.str("interstitialId")); load(c.str("rewardedId")); ready() } }
            override fun onInitializationFailed(error: U.UnityAdsInitializationError?, message: String?) { host.runOnUiThread { ready() } }
        })
    }

    private fun load(id: String) {
        if (id.isBlank()) return
        U.load(id, object : IUnityAdsLoadListener {
            override fun onUnityAdsAdLoaded(placementId: String?) { loaded += id }
            override fun onUnityAdsFailedToLoad(placementId: String?, error: U.UnityAdsLoadError?, message: String?) { loaded -= id }
        })
    }

    private fun show(id: String, done: (Boolean, Boolean) -> Unit) {
        if (id.isBlank() || id !in loaded) { load(id); return done(false, false) }
        loaded -= id
        U.show(host, id, UnityAdsShowOptions(), object : IUnityAdsShowListener {
            override fun onUnityAdsShowFailure(placementId: String?, error: U.UnityAdsShowError?, message: String?) { host.runOnUiThread { done(false, false); load(id) } }
            override fun onUnityAdsShowStart(placementId: String?) {}
            override fun onUnityAdsShowClick(placementId: String?) {}
            override fun onUnityAdsShowComplete(placementId: String?, state: U.UnityAdsShowCompletionState?) {
                host.runOnUiThread { done(true, state == U.UnityAdsShowCompletionState.COMPLETED); load(id) }
            }
        })
    }

    override fun banner(container: FrameLayout) {
        hideBanner()
        val id = c.str("bannerId").ifBlank { return }
        val v = BannerView(host, id, UnityBannerSize(320, 50))
        v.listener = object : BannerView.Listener() {}
        container.removeAllViews(); container.addView(v); container.visibility = View.VISIBLE
        v.load()
        banner = v
    }

    override fun hideBanner() {
        banner?.let { v -> (v.parent as? FrameLayout)?.let { it.removeAllViews(); it.visibility = View.GONE }; v.destroy() }
        banner = null
    }

    override fun showInterstitial(done: (Boolean) -> Unit) = show(c.str("interstitialId")) { shown, _ -> done(shown) }
    override fun showRewarded(done: (Boolean, String, Int) -> Unit) = show(c.str("rewardedId")) { _, completed -> done(completed, "reward", 1) }
    override fun destroy() = hideBanner()
}
