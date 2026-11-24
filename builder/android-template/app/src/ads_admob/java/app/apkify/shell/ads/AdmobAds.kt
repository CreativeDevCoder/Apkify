package app.apkify.shell.ads

import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import app.apkify.shell.AdProvider
import app.apkify.shell.AppConfig
import app.apkify.shell.MainActivity
import app.apkify.shell.str
import com.google.ads.mediation.admob.AdMobAdapter
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdLoader
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.appopen.AppOpenAd
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.nativead.NativeAd
import com.google.android.gms.ads.nativead.NativeAdView
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAdLoadCallback
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicBoolean

/** Google AdMob: banner (adaptif/collapsible/native), interstitial, rewarded, rewarded interstitial, app open + UMP (GDPR). */
class AdmobAds : AdProvider {
    private lateinit var host: MainActivity
    private var c = JSONObject()
    private var bannerView: View? = null
    private var inter: InterstitialAd? = null
    private var rewarded: RewardedAd? = null
    private var rInter: RewardedInterstitialAd? = null
    private var appOpen: AppOpenAd? = null
    private var appOpenAt = 0L
    private var native: NativeAd? = null

    private fun id(k: String, legacy: String = "") = c.str(k).ifBlank { legacy }
    private fun req(collapsible: Boolean = false) = AdRequest.Builder().apply {
        if (collapsible) addNetworkExtrasBundle(AdMobAdapter::class.java, Bundle().apply { putString("collapsible", c.str("bannerPosition", "bottom")) })
    }.build()

    override fun init(host: MainActivity, cfg: JSONObject, ready: () -> Unit) {
        this.host = host
        val app = AppConfig.get(host)
        c = cfg.optJSONObject("admob") ?: JSONObject()
        if (c.str("bannerId").isBlank()) c.put("bannerId", app.admobBannerId)
        if (c.str("interstitialId").isBlank()) c.put("interstitialId", app.admobInterstitialId)
        c.put("bannerPosition", cfg.str("banner", "bottom")).put("bannerStyle", cfg.str("bannerStyle", "adaptive"))
        val started = AtomicBoolean(false)
        val start = {
            if (started.compareAndSet(false, true)) MobileAds.initialize(host) { host.runOnUiThread { preload(); ready() } }
        }
        // Persetujuan GDPR/UMP (hanya muncul di wilayah yang mewajibkan)
        val info = UserMessagingPlatform.getConsentInformation(host)
        info.requestConsentInfoUpdate(host, ConsentRequestParameters.Builder().build(), {
            UserMessagingPlatform.loadAndShowConsentFormIfRequired(host) { _ -> if (info.canRequestAds()) start() }
        }, { _ -> start() })
        if (info.canRequestAds()) start()
    }

    private fun preload() {
        loadInter(); loadRewarded(); loadRInter(); loadAppOpen()
    }

    private fun loadInter() { val i = id("interstitialId"); if (i.isNotBlank()) InterstitialAd.load(host, i, req(), object : InterstitialAdLoadCallback() {
        override fun onAdLoaded(ad: InterstitialAd) { inter = ad }
        override fun onAdFailedToLoad(e: LoadAdError) { inter = null }
    }) }
    private fun loadRewarded() { val i = id("rewardedId"); if (i.isNotBlank()) RewardedAd.load(host, i, req(), object : RewardedAdLoadCallback() {
        override fun onAdLoaded(ad: RewardedAd) { rewarded = ad }
        override fun onAdFailedToLoad(e: LoadAdError) { rewarded = null }
    }) }
    private fun loadRInter() { val i = id("rewardedInterstitialId"); if (i.isNotBlank()) RewardedInterstitialAd.load(host, i, req(), object : RewardedInterstitialAdLoadCallback() {
        override fun onAdLoaded(ad: RewardedInterstitialAd) { rInter = ad }
        override fun onAdFailedToLoad(e: LoadAdError) { rInter = null }
    }) }
    private fun loadAppOpen() { val i = id("appOpenId"); if (i.isNotBlank()) AppOpenAd.load(host, i, req(), object : AppOpenAd.AppOpenAdLoadCallback() {
        override fun onAdLoaded(ad: AppOpenAd) { appOpen = ad; appOpenAt = System.currentTimeMillis() }
        override fun onAdFailedToLoad(e: LoadAdError) { appOpen = null }
    }) }

    private fun callback(after: () -> Unit, reload: () -> Unit) = object : FullScreenContentCallback() {
        override fun onAdDismissedFullScreenContent() { after(); reload() }
        override fun onAdFailedToShowFullScreenContent(e: com.google.android.gms.ads.AdError) { after(); reload() }
    }

    override fun banner(container: FrameLayout) {
        hideBanner()
        val style = c.str("bannerStyle", "adaptive")
        if (style == "native") return nativeBanner(container)
        val unit = id("bannerId").ifBlank { return }
        val v = AdView(host)
        v.adUnitId = unit
        val dm = host.resources.displayMetrics
        v.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(host, (dm.widthPixels / dm.density).toInt()))
        container.removeAllViews(); container.addView(v); container.visibility = View.VISIBLE
        v.loadAd(req(style == "collapsible"))
        bannerView = v
    }

    private fun nativeBanner(container: FrameLayout) {
        val unit = id("nativeId").ifBlank { return }
        AdLoader.Builder(host, unit).forNativeAd { ad ->
            native?.destroy(); native = ad
            container.removeAllViews(); container.addView(nativeView(ad)); container.visibility = View.VISIBLE
            bannerView = container.getChildAt(0)
        }.withAdListener(object : AdListener() {}).build().loadAd(req())
    }

    /** tata letak native ad ringkas: ikon, judul, teks, tombol CTA, label "Iklan" */
    private fun nativeView(ad: NativeAd): NativeAdView {
        val dp = host.resources.displayMetrics.density
        val nv = NativeAdView(host)
        val row = LinearLayout(host).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; setPadding((8 * dp).toInt(), (6 * dp).toInt(), (8 * dp).toInt(), (6 * dp).toInt()) }
        val icon = ImageView(host).apply { layoutParams = LinearLayout.LayoutParams((40 * dp).toInt(), (40 * dp).toInt()) }
        val texts = LinearLayout(host).apply { orientation = LinearLayout.VERTICAL; layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply { marginStart = (8 * dp).toInt() } }
        val badge = TextView(host).apply { text = "Iklan"; textSize = 10f; setTextColor(Color.WHITE); setBackgroundColor(Color.parseColor("#F9A825")); setPadding((4 * dp).toInt(), 0, (4 * dp).toInt(), 0) }
        val head = TextView(host).apply { textSize = 14f; setTypeface(typeface, Typeface.BOLD); maxLines = 1; setTextColor(Color.BLACK) }
        val body = TextView(host).apply { textSize = 12f; maxLines = 1; setTextColor(Color.DKGRAY) }
        val cta = Button(host).apply { textSize = 12f; isAllCaps = false }
        texts.addView(LinearLayout(host).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL; addView(badge); addView(head.apply { setPadding((6 * dp).toInt(), 0, 0, 0) }) })
        texts.addView(body)
        row.addView(icon); row.addView(texts); row.addView(cta)
        nv.addView(row)
        head.text = ad.headline; body.text = ad.body ?: ""; cta.text = ad.callToAction ?: "Buka"
        ad.icon?.drawable?.let { icon.setImageDrawable(it) } ?: run { icon.visibility = View.GONE }
        nv.headlineView = head; nv.bodyView = body; nv.callToActionView = cta; nv.iconView = icon
        nv.setNativeAd(ad)
        return nv
    }

    override fun hideBanner() {
        (bannerView as? AdView)?.destroy()
        (bannerView?.parent as? FrameLayout)?.let { it.removeAllViews(); it.visibility = View.GONE }
        bannerView = null
    }

    override fun showInterstitial(done: (Boolean) -> Unit) {
        val ad = inter ?: return done(false).also { loadInter() }
        inter = null
        ad.fullScreenContentCallback = callback({ done(true) }, ::loadInter)
        ad.show(host)
    }

    override fun showRewarded(done: (Boolean, String, Int) -> Unit) {
        val ad = rewarded ?: return done(false, "", 0).also { loadRewarded() }
        rewarded = null
        var earned: Pair<String, Int>? = null
        ad.fullScreenContentCallback = callback({ done(earned != null, earned?.first ?: "", earned?.second ?: 0) }, ::loadRewarded)
        ad.show(host) { item -> earned = item.type to item.amount }
    }

    override fun showRewardedInterstitial(done: (Boolean, String, Int) -> Unit) {
        val ad = rInter ?: return showRewarded(done)
        rInter = null
        var earned: Pair<String, Int>? = null
        ad.fullScreenContentCallback = callback({ done(earned != null, earned?.first ?: "", earned?.second ?: 0) }, ::loadRInter)
        ad.show(host) { item -> earned = item.type to item.amount }
    }

    override fun showAppOpen(done: (Boolean) -> Unit) {
        val ad = appOpen?.takeIf { System.currentTimeMillis() - appOpenAt < 4 * 3_600_000L } ?: return done(false).also { loadAppOpen() }
        appOpen = null
        ad.fullScreenContentCallback = callback({ done(true) }, ::loadAppOpen)
        ad.show(host)
    }

    override fun destroy() { hideBanner(); native?.destroy() }
}
