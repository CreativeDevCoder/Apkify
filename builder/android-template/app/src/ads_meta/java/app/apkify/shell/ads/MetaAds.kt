package app.apkify.shell.ads

import android.view.View
import android.widget.FrameLayout
import app.apkify.shell.AdProvider
import app.apkify.shell.MainActivity
import app.apkify.shell.str
import com.facebook.ads.Ad
import com.facebook.ads.AdError
import com.facebook.ads.AdSize
import com.facebook.ads.AdView
import com.facebook.ads.AudienceNetworkAds
import com.facebook.ads.InterstitialAd
import com.facebook.ads.InterstitialAdListener
import com.facebook.ads.RewardedVideoAd
import com.facebook.ads.RewardedVideoAdListener
import org.json.JSONObject

/** Meta Audience Network: banner, interstitial, rewarded video. */
class MetaAds : AdProvider {
    private lateinit var host: MainActivity
    private var c = JSONObject()
    private var banner: AdView? = null
    private var inter: InterstitialAd? = null
    private var rewarded: RewardedVideoAd? = null
    private var interDone: ((Boolean) -> Unit)? = null
    private var rewardDone: ((Boolean, String, Int) -> Unit)? = null
    private var completed = false

    override fun init(host: MainActivity, cfg: JSONObject, ready: () -> Unit) {
        this.host = host
        c = cfg.optJSONObject("meta") ?: JSONObject()
        AudienceNetworkAds.buildInitSettings(host).withInitListener { host.runOnUiThread { loadInter(); loadRewarded(); ready() } }.initialize()
    }

    private fun loadInter() {
        val id = c.str("interstitialId").ifBlank { return }
        inter?.destroy()
        val ad = InterstitialAd(host, id)
        ad.loadAd(ad.buildLoadAdConfig().withAdListener(object : InterstitialAdListener {
            override fun onInterstitialDisplayed(a: Ad?) {}
            override fun onInterstitialDismissed(a: Ad?) { interDone?.invoke(true); interDone = null; loadInter() }
            override fun onError(a: Ad?, e: AdError?) { interDone?.invoke(false); interDone = null }
            override fun onAdLoaded(a: Ad?) {}
            override fun onAdClicked(a: Ad?) {}
            override fun onLoggingImpression(a: Ad?) {}
        }).build())
        inter = ad
    }

    private fun loadRewarded() {
        val id = c.str("rewardedId").ifBlank { return }
        rewarded?.destroy()
        val ad = RewardedVideoAd(host, id)
        ad.loadAd(ad.buildLoadAdConfig().withAdListener(object : RewardedVideoAdListener {
            override fun onRewardedVideoCompleted() { completed = true }
            override fun onRewardedVideoClosed() { rewardDone?.invoke(completed, "reward", if (completed) 1 else 0); rewardDone = null; loadRewarded() }
            override fun onError(a: Ad?, e: AdError?) { rewardDone?.invoke(false, "", 0); rewardDone = null }
            override fun onAdLoaded(a: Ad?) {}
            override fun onAdClicked(a: Ad?) {}
            override fun onLoggingImpression(a: Ad?) {}
        }).build())
        rewarded = ad
    }

    override fun banner(container: FrameLayout) {
        hideBanner()
        val id = c.str("bannerId").ifBlank { return }
        val v = AdView(host, id, AdSize.BANNER_HEIGHT_50)
        container.removeAllViews(); container.addView(v); container.visibility = View.VISIBLE
        v.loadAd()
        banner = v
    }

    override fun hideBanner() {
        banner?.let { v -> (v.parent as? FrameLayout)?.let { it.removeAllViews(); it.visibility = View.GONE }; v.destroy() }
        banner = null
    }

    override fun showInterstitial(done: (Boolean) -> Unit) {
        val ad = inter?.takeIf { it.isAdLoaded && !it.isAdInvalidated } ?: return done(false).also { loadInter() }
        interDone = done; ad.show()
    }

    override fun showRewarded(done: (Boolean, String, Int) -> Unit) {
        val ad = rewarded?.takeIf { it.isAdLoaded && !it.isAdInvalidated } ?: return done(false, "", 0).also { loadRewarded() }
        completed = false; rewardDone = done; ad.show()
    }

    override fun destroy() { hideBanner(); inter?.destroy(); rewarded?.destroy() }
}
