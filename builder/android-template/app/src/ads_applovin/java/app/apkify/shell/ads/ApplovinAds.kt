package app.apkify.shell.ads

import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import app.apkify.shell.AdProvider
import app.apkify.shell.MainActivity
import app.apkify.shell.str
import com.applovin.mediation.MaxAd
import com.applovin.mediation.MaxAdListener
import com.applovin.mediation.MaxAdViewAdListener
import com.applovin.mediation.MaxError
import com.applovin.mediation.MaxReward
import com.applovin.mediation.MaxRewardedAdListener
import com.applovin.mediation.ads.MaxAdView
import com.applovin.mediation.ads.MaxAppOpenAd
import com.applovin.mediation.ads.MaxInterstitialAd
import com.applovin.mediation.ads.MaxRewardedAd
import com.applovin.sdk.AppLovinMediationProvider
import com.applovin.sdk.AppLovinSdk
import com.applovin.sdk.AppLovinSdkInitializationConfiguration
import org.json.JSONObject

/** AppLovin MAX (mediasi): banner, interstitial, rewarded, app open. */
class ApplovinAds : AdProvider {
    private lateinit var host: MainActivity
    private var c = JSONObject()
    private var banner: MaxAdView? = null
    private var inter: MaxInterstitialAd? = null
    private var rewarded: MaxRewardedAd? = null
    private var appOpen: MaxAppOpenAd? = null
    private var interDone: ((Boolean) -> Unit)? = null
    private var rewardDone: ((Boolean, String, Int) -> Unit)? = null
    private var earned: MaxReward? = null
    private var openDone: ((Boolean) -> Unit)? = null

    override fun init(host: MainActivity, cfg: JSONObject, ready: () -> Unit) {
        this.host = host
        c = cfg.optJSONObject("applovin") ?: JSONObject()
        val conf = AppLovinSdkInitializationConfiguration.builder(c.str("sdkKey"), host).setMediationProvider(AppLovinMediationProvider.MAX).build()
        AppLovinSdk.getInstance(host).initialize(conf) { host.runOnUiThread { load(); ready() } }
    }

    private abstract inner class L : MaxAdListener {
        override fun onAdLoaded(ad: MaxAd) {}
        override fun onAdDisplayed(ad: MaxAd) {}
        override fun onAdClicked(ad: MaxAd) {}
        override fun onAdLoadFailed(unit: String, e: MaxError) {}
    }

    private fun load() {
        c.str("interstitialId").takeIf { it.isNotBlank() }?.let { id ->
            inter = MaxInterstitialAd(id, host).apply {
                setListener(object : L() {
                    override fun onAdHidden(ad: MaxAd) { interDone?.invoke(true); interDone = null; loadAd() }
                    override fun onAdDisplayFailed(ad: MaxAd, e: MaxError) { interDone?.invoke(false); interDone = null; loadAd() }
                })
                loadAd()
            }
        }
        c.str("rewardedId").takeIf { it.isNotBlank() }?.let { id ->
            rewarded = MaxRewardedAd.getInstance(id, host).apply {
                setListener(object : L(), MaxRewardedAdListener {
                    override fun onUserRewarded(ad: MaxAd, reward: MaxReward) { earned = reward }
                    override fun onAdHidden(ad: MaxAd) { finishReward(); loadAd() }
                    override fun onAdDisplayFailed(ad: MaxAd, e: MaxError) { finishReward(); loadAd() }
                })
                loadAd()
            }
        }
        c.str("appOpenId").takeIf { it.isNotBlank() }?.let { id ->
            appOpen = MaxAppOpenAd(id, host).apply {
                setListener(object : L() {
                    override fun onAdHidden(ad: MaxAd) { openDone?.invoke(true); openDone = null; loadAd() }
                    override fun onAdDisplayFailed(ad: MaxAd, e: MaxError) { openDone?.invoke(false); openDone = null; loadAd() }
                })
                loadAd()
            }
        }
    }

    private fun finishReward() {
        val e = earned; earned = null
        rewardDone?.invoke(e != null, e?.label ?: "", e?.amount ?: 0); rewardDone = null
    }

    override fun banner(container: FrameLayout) {
        hideBanner()
        val id = c.str("bannerId").ifBlank { return }
        val v = MaxAdView(id, host)
        val h = (50 * host.resources.displayMetrics.density).toInt()
        v.layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, h)
        v.setListener(object : L(), MaxAdViewAdListener {
            override fun onAdHidden(ad: MaxAd) {}
            override fun onAdDisplayFailed(ad: MaxAd, e: MaxError) {}
            override fun onAdExpanded(ad: MaxAd) {}
            override fun onAdCollapsed(ad: MaxAd) {}
        })
        container.removeAllViews(); container.addView(v); container.visibility = View.VISIBLE
        v.loadAd()
        banner = v
    }

    override fun hideBanner() {
        banner?.let { v -> (v.parent as? FrameLayout)?.let { it.removeAllViews(); it.visibility = View.GONE }; v.destroy() }
        banner = null
    }

    override fun showInterstitial(done: (Boolean) -> Unit) {
        val ad = inter?.takeIf { it.isReady } ?: return done(false)
        interDone = done; ad.showAd(host)
    }

    override fun showRewarded(done: (Boolean, String, Int) -> Unit) {
        val ad = rewarded?.takeIf { it.isReady } ?: return done(false, "", 0)
        rewardDone = done; earned = null; ad.showAd(host)
    }

    override fun showAppOpen(done: (Boolean) -> Unit) {
        val ad = appOpen?.takeIf { it.isReady } ?: return done(false)
        openDone = done; ad.showAd()
    }

    override fun destroy() { hideBanner(); inter?.destroy(); appOpen?.destroy() }
}
