package app.apkify.shell.ads

import android.view.View
import android.widget.FrameLayout
import app.apkify.shell.AdProvider
import app.apkify.shell.MainActivity
import app.apkify.shell.str
import com.startapp.sdk.ads.banner.Banner
import com.startapp.sdk.adsbase.Ad
import com.startapp.sdk.adsbase.StartAppAd
import com.startapp.sdk.adsbase.StartAppSDK
import com.startapp.sdk.adsbase.adlisteners.AdDisplayListener
import org.json.JSONObject

/** Start.io (StartApp): banner, interstitial, rewarded video. */
class StartioAds : AdProvider {
    private lateinit var host: MainActivity
    private var c = JSONObject()
    private var banner: Banner? = null
    private var inter: StartAppAd? = null
    private var rewarded: StartAppAd? = null
    private var completed = false

    override fun init(host: MainActivity, cfg: JSONObject, ready: () -> Unit) {
        this.host = host
        c = cfg.optJSONObject("startio") ?: JSONObject()
        StartAppSDK.init(host, c.str("appId"), false)
        StartAppAd.disableSplash()
        if (c.optBoolean("testMode")) StartAppSDK.setTestAdsEnabled(true)
        inter = StartAppAd(host).also { it.loadAd(StartAppAd.AdMode.AUTOMATIC) }
        rewarded = StartAppAd(host).also { r ->
            r.setVideoListener { completed = true }
            r.loadAd(StartAppAd.AdMode.REWARDED_VIDEO)
        }
        ready()
    }

    override fun banner(container: FrameLayout) {
        hideBanner()
        val v = Banner(host)
        container.removeAllViews(); container.addView(v); container.visibility = View.VISIBLE
        banner = v
    }

    override fun hideBanner() {
        banner?.let { v -> (v.parent as? FrameLayout)?.let { it.removeAllViews(); it.visibility = View.GONE } }
        banner = null
    }

    private fun show(ad: StartAppAd?, reload: StartAppAd.AdMode, done: (Boolean) -> Unit) {
        if (ad == null || !ad.isReady) { ad?.loadAd(reload); return done(false) }
        ad.showAd(object : AdDisplayListener {
            override fun adHidden(a: Ad?) { done(true); ad.loadAd(reload) }
            override fun adDisplayed(a: Ad?) {}
            override fun adClicked(a: Ad?) {}
            override fun adNotDisplayed(a: Ad?) { done(false); ad.loadAd(reload) }
        })
    }

    override fun showInterstitial(done: (Boolean) -> Unit) = show(inter, StartAppAd.AdMode.AUTOMATIC, done)
    override fun showRewarded(done: (Boolean, String, Int) -> Unit) {
        completed = false
        show(rewarded, StartAppAd.AdMode.REWARDED_VIDEO) { done(completed, "reward", if (completed) 1 else 0) }
    }
    override fun destroy() = hideBanner()
}
