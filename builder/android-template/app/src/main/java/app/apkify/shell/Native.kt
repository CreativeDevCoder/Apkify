package app.apkify.shell

import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ConsumeParams
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.google.android.play.core.review.ReviewManagerFactory
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import org.json.JSONArray
import org.json.JSONObject

/**
 * Plugin native asinkron untuk window.Apkify:
 * scanQR, biometric, requestReview, iap.* (Google Play Billing), pushToken.
 * Hasil dikirim ke JS lewat activity.jsCallback(id, json).
 */
class Native(private val activity: MainActivity) {
    private val cfg = AppConfig.get(activity)
    private var billing: BillingClient? = null
    private var purchaseCb: String? = null
    private val productCache = HashMap<String, ProductDetails>()

    private fun ok(id: String, data: JSONObject = JSONObject()) = activity.jsCallback(id, data.put("ok", true).toString())
    private fun err(id: String, msg: String) = activity.jsCallback(id, JSONObject().put("ok", false).put("error", msg).toString())

    fun handle(cmd: String, args: JSONObject, id: String) {
        when (cmd) {
            "scanQR" -> if (cfg.qrScanner) scanQR(id) else err(id, "disabled")
            "biometric" -> if (cfg.biometric) biometric(id, args.optString("reason", "Verifikasi identitas")) else err(id, "disabled")
            "review" -> if (cfg.inAppReview) review(id) else err(id, "disabled")
            "iap.products" -> if (cfg.billing) products(id, args) else err(id, "disabled")
            "iap.purchase" -> if (cfg.billing) purchase(id, args) else err(id, "disabled")
            "iap.restore" -> if (cfg.billing) restore(id, args.optString("type", "inapp")) else err(id, "disabled")
            "iap.acknowledge" -> if (cfg.billing) acknowledge(id, args.optString("token")) else err(id, "disabled")
            "iap.consume" -> if (cfg.billing) consume(id, args.optString("token")) else err(id, "disabled")
            "pushToken" -> Fcm.token(activity) { t -> if (t != null) ok(id, JSONObject().put("token", t)) else err(id, "unavailable") }
            else -> activity.plugins.handle(cmd, args, Reply(activity, id))
        }
    }

    // ---------- QR / barcode (Google code scanner: tanpa izin kamera, UI native) ----------
    private fun scanQR(id: String) {
        GmsBarcodeScanning.getClient(activity).startScan()
            .addOnSuccessListener { b -> ok(id, JSONObject().put("value", b.rawValue ?: "").put("format", b.format)) }
            .addOnCanceledListener { err(id, "cancelled") }
            .addOnFailureListener { e -> err(id, e.message ?: "failed") }
    }

    // ---------- Biometrik ----------
    private fun biometric(id: String, reason: String) {
        val auth = BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        if (BiometricManager.from(activity).canAuthenticate(auth) != BiometricManager.BIOMETRIC_SUCCESS) return err(id, "unavailable")
        val prompt = BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) = ok(id)
            override fun onAuthenticationError(code: Int, msg: CharSequence) = err(id, msg.toString())
        })
        prompt.authenticate(BiometricPrompt.PromptInfo.Builder().setTitle(cfg.name).setSubtitle(reason).setAllowedAuthenticators(auth).build())
    }

    // ---------- In-app review ----------
    private fun review(id: String) {
        val m = ReviewManagerFactory.create(activity)
        m.requestReviewFlow().addOnCompleteListener { t ->
            if (t.isSuccessful) m.launchReviewFlow(activity, t.result).addOnCompleteListener { ok(id) } else err(id, "unavailable")
        }
    }

    // ---------- Google Play Billing ----------
    private fun purchaseJson(p: Purchase) = JSONObject()
        .put("orderId", p.orderId ?: "").put("token", p.purchaseToken).put("products", JSONArray(p.products))
        .put("state", when (p.purchaseState) { Purchase.PurchaseState.PURCHASED -> "purchased"; Purchase.PurchaseState.PENDING -> "pending"; else -> "unspecified" })
        .put("acknowledged", p.isAcknowledged).put("time", p.purchaseTime)

    private fun client(ready: (BillingClient?) -> Unit) {
        billing?.let { if (it.isReady) return ready(it) }
        val c = BillingClient.newBuilder(activity)
            .setListener { result, purchases ->
                val id = purchaseCb ?: return@setListener
                purchaseCb = null
                activity.runOnUiThread {
                    when (result.responseCode) {
                        BillingClient.BillingResponseCode.OK -> ok(id, JSONObject().put("purchases", JSONArray((purchases ?: emptyList()).map { purchaseJson(it) })))
                        BillingClient.BillingResponseCode.USER_CANCELED -> err(id, "cancelled")
                        else -> err(id, result.debugMessage.ifBlank { "billing error ${result.responseCode}" })
                    }
                }
            }
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build()
        billing = c
        c.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(r: BillingResult) { activity.runOnUiThread { ready(if (r.responseCode == BillingClient.BillingResponseCode.OK) c else null) } }
            override fun onBillingServiceDisconnected() { billing = null }
        })
    }

    private fun type(t: String) = if (t == "subs") BillingClient.ProductType.SUBS else BillingClient.ProductType.INAPP

    private fun query(ids: List<String>, t: String, done: (List<ProductDetails>?) -> Unit) = client { c ->
        if (c == null) return@client done(null)
        val params = QueryProductDetailsParams.newBuilder().setProductList(ids.map {
            QueryProductDetailsParams.Product.newBuilder().setProductId(it).setProductType(type(t)).build()
        }).build()
        c.queryProductDetailsAsync(params) { r, list ->
            activity.runOnUiThread {
                if (r.responseCode == BillingClient.BillingResponseCode.OK) { list.forEach { productCache[it.productId] = it }; done(list) } else done(null)
            }
        }
    }

    private fun products(id: String, args: JSONObject) {
        val arr = args.optJSONArray("ids") ?: JSONArray()
        val ids = (0 until arr.length()).map { arr.getString(it) }
        query(ids, args.optString("type", "inapp")) { list ->
            if (list == null) return@query err(id, "billing unavailable")
            ok(id, JSONObject().put("products", JSONArray(list.map { pd ->
                val price = pd.oneTimePurchaseOfferDetails?.formattedPrice
                    ?: pd.subscriptionOfferDetails?.firstOrNull()?.pricingPhases?.pricingPhaseList?.firstOrNull()?.formattedPrice ?: ""
                JSONObject().put("id", pd.productId).put("title", pd.title).put("description", pd.description).put("price", price)
            })))
        }
    }

    private fun purchase(id: String, args: JSONObject) {
        val pid = args.optString("id")
        val t = args.optString("type", "inapp")
        query(listOf(pid), t) { list ->
            val pd = list?.firstOrNull() ?: return@query err(id, "product not found")
            val b = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd)
            pd.subscriptionOfferDetails?.firstOrNull()?.offerToken?.let { b.setOfferToken(it) }
            purchaseCb = id
            val r = billing?.launchBillingFlow(activity, BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(b.build())).build())
            if (r == null || r.responseCode != BillingClient.BillingResponseCode.OK) { purchaseCb = null; err(id, r?.debugMessage ?: "billing unavailable") }
        }
    }

    private fun restore(id: String, t: String) = client { c ->
        if (c == null) return@client err(id, "billing unavailable")
        c.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(type(t)).build()) { r, list ->
            activity.runOnUiThread {
                if (r.responseCode == BillingClient.BillingResponseCode.OK) ok(id, JSONObject().put("purchases", JSONArray(list.map { purchaseJson(it) })))
                else err(id, r.debugMessage)
            }
        }
    }

    private fun acknowledge(id: String, token: String) = client { c ->
        if (c == null) return@client err(id, "billing unavailable")
        c.acknowledgePurchase(AcknowledgePurchaseParams.newBuilder().setPurchaseToken(token).build()) { r ->
            activity.runOnUiThread { if (r.responseCode == BillingClient.BillingResponseCode.OK) ok(id) else err(id, r.debugMessage) }
        }
    }

    private fun consume(id: String, token: String) = client { c ->
        if (c == null) return@client err(id, "billing unavailable")
        c.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(token).build()) { r, _ ->
            activity.runOnUiThread { if (r.responseCode == BillingClient.BillingResponseCode.OK) ok(id) else err(id, r.debugMessage) }
        }
    }

    fun destroy() { billing?.endConnection(); billing = null }
}
