package app.apkify.shell

import android.app.Activity
import android.view.View
import android.widget.FrameLayout
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.MobileAds

object Ads {
    private var adView: AdView? = null

    fun init(activity: Activity, container: FrameLayout, bannerId: String) {
        MobileAds.initialize(activity) {}
        if (bannerId.isBlank()) return
        val view = AdView(activity)
        view.adUnitId = bannerId
        val dm = activity.resources.displayMetrics
        val widthDp = (dm.widthPixels / dm.density).toInt()
        view.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity, widthDp))
        container.removeAllViews()
        container.addView(view)
        container.visibility = View.VISIBLE
        view.loadAd(AdRequest.Builder().build())
        adView = view
    }

    fun destroy() {
        adView?.destroy()
        adView = null
    }
}
