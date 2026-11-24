package app.apkify.shell

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.net.Uri
import android.os.Build
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.content.ContextCompat
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status
import com.google.android.material.snackbar.Snackbar
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityTokenRequest
import org.json.JSONObject

/**
 * Layanan Google Play & integrasi: In-App Update, Play Integrity, Install Referrer,
 * OTP SMS otomatis (SMS User Consent, tanpa izin baca SMS), dan halaman pembayaran
 * (Midtrans Snap / Xendit Invoice / lainnya) di Custom Tab.
 */
class PlayPlugin(host: MainActivity) : Plugin(host) {
    override val prefixes = setOf("update", "integrity", "referrer", "play", "pay")
    override fun enabled(prefix: String) = when (prefix) {
        "update" -> cfg.on("inAppUpdate")
        "integrity" -> cfg.on("playIntegrity")
        "referrer" -> cfg.on("installReferrer")
        "play" -> cfg.on("smsOtp")
        "pay" -> cfg.on("payments")
        else -> false
    }

    private val updater: AppUpdateManager by lazy { AppUpdateManagerFactory.create(host) }
    private var listener: InstallStateUpdatedListener? = null

    override fun handle(prefix: String, cmd: String, a: JSONObject, r: Reply) {
        when (prefix) {
            "update" -> update(cmd, a, r)
            "integrity" -> integrity(a, r)
            "referrer" -> referrer(r)
            "play" -> if (cmd == "smsOtp") smsOtp(a, r) else r.err("unknown")
            "pay" -> pay(a, r)
        }
    }

    // ---------------- In-App Update ----------------
    private fun update(cmd: String, a: JSONObject, r: Reply) {
        when (cmd) {
            "check" -> updater.appUpdateInfo.addOnSuccessListener { i ->
                r.ok(JSONObject().put("available", i.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE)
                    .put("versionCode", i.availableVersionCode()).put("priority", i.updatePriority())
                    .put("stalenessDays", i.clientVersionStalenessDays() ?: JSONObject.NULL)
                    .put("flexible", i.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)).put("immediate", i.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE))
                    .put("downloaded", i.installStatus() == InstallStatus.DOWNLOADED))
            }.addOnFailureListener { r.err(it.message ?: "pembaruan tidak tersedia (aplikasi harus dari Play Store)") }
            "start" -> start(if (a.str("type", "flexible") == "immediate") AppUpdateType.IMMEDIATE else AppUpdateType.FLEXIBLE, r)
            "complete" -> { updater.completeUpdate(); r.ok() }
            else -> r.err("unknown update.$cmd")
        }
    }

    private fun start(type: Int, r: Reply?) {
        updater.appUpdateInfo.addOnSuccessListener { info ->
            if (info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE && info.updateAvailability() != UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS)
                return@addOnSuccessListener run { r?.err("tidak ada pembaruan") }
            if (type == AppUpdateType.FLEXIBLE && listener == null) {
                listener = InstallStateUpdatedListener { st ->
                    emit("update", JSONObject().put("status", st.installStatus()).put("downloaded", st.bytesDownloaded()).put("total", st.totalBytesToDownload()))
                    if (st.installStatus() == InstallStatus.DOWNLOADED) promptRestart()
                }.also { updater.registerListener(it) }
            }
            updater.startUpdateFlowForResult(info, host.senderLauncher, AppUpdateOptions.newBuilder(type).build())
            r?.ok()
        }.addOnFailureListener { r?.err(it.message ?: "gagal") }
    }

    private fun promptRestart() = ui {
        Snackbar.make(host.webView, "Pembaruan siap dipasang", Snackbar.LENGTH_INDEFINITE).setAction("Mulai ulang") { updater.completeUpdate() }.show()
    }

    /** Dipanggil saat aplikasi dibuka: cek otomatis (prioritas >= 4 -> wajib/immediate) */
    fun autoCheck() {
        if (!cfg.on("inAppUpdate") || !cfg.on("autoUpdate")) return
        updater.appUpdateInfo.addOnSuccessListener { i ->
            if (i.installStatus() == InstallStatus.DOWNLOADED) return@addOnSuccessListener promptRestart()
            if (i.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) return@addOnSuccessListener start(AppUpdateType.IMMEDIATE, null)
            if (i.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE) return@addOnSuccessListener
            start(if (i.updatePriority() >= 4 && i.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) AppUpdateType.IMMEDIATE else AppUpdateType.FLEXIBLE, null)
        }
    }

    // ---------------- Play Integrity ----------------
    private fun integrity(a: JSONObject, r: Reply) {
        val nonce = a.str("nonce")
        if (nonce.length < 16) return r.err("nonce minimal 16 karakter (base64 url-safe, buat di server)")
        val b = IntegrityTokenRequest.builder().setNonce(nonce)
        a.optLong("cloudProjectNumber", cfg.section("integrity").optLong("cloudProjectNumber", 0)).takeIf { it > 0 }?.let { b.setCloudProjectNumber(it) }
        IntegrityManagerFactory.create(host).requestIntegrityToken(b.build())
            .addOnSuccessListener { r.ok("token", it.token()) }
            .addOnFailureListener { r.err(it.message ?: "integrity error") }
    }

    // ---------------- Install Referrer ----------------
    private fun referrer(r: Reply) {
        val c = InstallReferrerClient.newBuilder(host).build()
        c.startConnection(object : InstallReferrerStateListener {
            override fun onInstallReferrerSetupFinished(code: Int) {
                if (code != InstallReferrerClient.InstallReferrerResponse.OK) { r.err("referrer tidak tersedia ($code)"); runCatching { c.endConnection() }; return }
                runCatching {
                    val d = c.installReferrer
                    r.ok(JSONObject().put("referrer", d.installReferrer).put("clickTime", d.referrerClickTimestampSeconds).put("installTime", d.installBeginTimestampSeconds)
                        .put("instantExperience", d.googlePlayInstantParam))
                }.onFailure { r.err(it.message ?: "gagal") }
                runCatching { c.endConnection() }
            }
            override fun onInstallReferrerServiceDisconnected() {}
        })
    }

    // ---------------- OTP SMS (User Consent API) ----------------
    private var smsReceiver: BroadcastReceiver? = null

    private fun smsOtp(a: JSONObject, r: Reply) {
        smsReceiver?.let { runCatching { host.unregisterReceiver(it) } }
        val rcv = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) {
                if (i.action != SmsRetriever.SMS_RETRIEVED_ACTION) return
                runCatching { host.unregisterReceiver(this) }; smsReceiver = null
                val extras = i.extras ?: return r.err("kosong")
                val status = if (Build.VERSION.SDK_INT >= 33) extras.getParcelable(SmsRetriever.EXTRA_STATUS, Status::class.java) else @Suppress("DEPRECATION") extras.get(SmsRetriever.EXTRA_STATUS) as? Status
                when (status?.statusCode) {
                    CommonStatusCodes.SUCCESS -> {
                        val consent = if (Build.VERSION.SDK_INT >= 33) extras.getParcelable(SmsRetriever.EXTRA_CONSENT_INTENT, Intent::class.java) else @Suppress("DEPRECATION") extras.getParcelable(SmsRetriever.EXTRA_CONSENT_INTENT)
                        consent ?: return r.err("tidak ada SMS")
                        host.startForResult(consent) { code, data ->
                            val msg = data?.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE)
                            if (code != Activity.RESULT_OK || msg == null) return@startForResult r.err("cancelled")
                            val re = Regex(a.str("pattern", "\\b(\\d{4,8})\\b"))
                            r.ok(JSONObject().put("message", msg).put("code", re.find(msg)?.let { m -> m.groupValues.getOrElse(1) { m.value } } ?: ""))
                        }
                    }
                    CommonStatusCodes.TIMEOUT -> r.err("timeout: SMS tidak diterima dalam 5 menit")
                    else -> r.err("gagal membaca SMS")
                }
            }
        }
        ContextCompat.registerReceiver(host, rcv, IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION), SmsRetriever.SEND_PERMISSION, null, ContextCompat.RECEIVER_EXPORTED)
        smsReceiver = rcv
        SmsRetriever.getClient(host).startSmsUserConsent(a.str("sender").ifBlank { null })
            .addOnFailureListener { e -> runCatching { host.unregisterReceiver(rcv) }; smsReceiver = null; r.err(e.message ?: "SMS User Consent tidak tersedia") }
    }

    // ---------------- Pembayaran di Custom Tab ----------------
    private var payReply: Reply? = null
    private var payOpenedAt = 0L

    private fun pay(a: JSONObject, r: Reply) {
        val url = a.str("url")
        if (!url.startsWith("https://")) return r.err("url pembayaran harus https")
        payReply?.ok(JSONObject().put("closed", true))
        val color = runCatching { Color.parseColor(cfg.primary) }.getOrDefault(Color.BLACK)
        val ct = CustomTabsIntent.Builder().setShowTitle(true)
            .setDefaultColorSchemeParams(CustomTabColorSchemeParams.Builder().setToolbarColor(color).build()).build()
        try { ct.launchUrl(host, Uri.parse(url)) } catch (e: Exception) { host.openExternal(Uri.parse(url)) }
        payReply = r; payOpenedAt = System.currentTimeMillis()
    }

    /** kembali dari Custom Tab (atau deep link callback pembayaran) */
    override fun onResume() {
        val rep = payReply ?: return
        if (System.currentTimeMillis() - payOpenedAt < 800) return
        payReply = null
        rep.ok(JSONObject().put("closed", true))
        emit("pay", JSONObject().put("closed", true))
    }

    override fun onDestroy() {
        listener?.let { updater.unregisterListener(it) }
        smsReceiver?.let { runCatching { host.unregisterReceiver(it) } }
    }

}
