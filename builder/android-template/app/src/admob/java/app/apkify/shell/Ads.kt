package app.apkify.shell

import android.app.Activity
import android.os.SystemClock
import android.view.View
import android.widget.FrameLayout
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback

/** Banner adaptif + interstitial setiap N perpindahan halaman (min. jeda 60 detik). */
object Ads {
    private var adView: AdView? = null
    private var inter: InterstitialAd? = null
    private var cfg: AppConfig? = null
    private var navCount = 0
    private var lastShown = 0L

    fun init(activity: Activity, container: FrameLayout, config: AppConfig) {
        cfg = config
        MobileAds.initialize(activity) {}
        if (config.admobBannerId.isNotBlank()) {
            val view = AdView(activity)
            view.adUnitId = config.admobBannerId
            val dm = activity.resources.displayMetrics
            view.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity, (dm.widthPixels / dm.density).toInt()))
            container.removeAllViews()
            container.addView(view)
            container.visibility = View.VISIBLE
            view.loadAd(AdRequest.Builder().build())
            adView = view
        }
        if (config.interstitial && config.admobInterstitialId.isNotBlank()) loadInterstitial(activity)
    }

    private fun loadInterstitial(activity: Activity) {
        val id = cfg?.admobInterstitialId ?: return
        InterstitialAd.load(activity, id, AdRequest.Builder().build(), object : InterstitialAdLoadCallback() {
            override fun onAdLoaded(ad: InterstitialAd) { inter = ad }
            override fun onAdFailedToLoad(error: LoadAdError) { inter = null }
        })
    }

    fun onNavigation(activity: Activity) {
        val c = cfg ?: return
        if (!c.interstitial) return
        navCount++
        val now = SystemClock.elapsedRealtime()
        if (navCount % c.interstitialEvery != 0 || now - lastShown < 60_000) return
        val ad = inter ?: return
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() { inter = null; loadInterstitial(activity) }
        }
        lastShown = now
        ad.show(activity)
    }

    fun destroy() {
        adView?.destroy()
        adView = null
        inter = null
    }
}
