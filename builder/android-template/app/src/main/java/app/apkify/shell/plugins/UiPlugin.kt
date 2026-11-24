package app.apkify.shell

import android.app.ActivityManager
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.RestrictionsManager
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.core.graphics.ColorUtils
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.google.android.material.bottomsheet.BottomSheetDialog
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * UI native: dialog, action sheet, date/time picker, warna status bar & orientasi saat runtime,
 * mode gelap, ganti ikon aplikasi, widget layar utama, Quick Settings tile, kunci aplikasi
 * (PIN perangkat/biometrik saat dibuka), kiosk (lock task), konfigurasi MDM dan
 * pemindai barcode industri (Zebra DataWedge, Honeywell, Urovo, Sunmi, Newland, iData, Chainway).
 */
class UiPlugin(host: MainActivity) : Plugin(host) {
    override val prefixes = setOf("dialog", "picker", "ui", "icon", "widget", "tile", "kiosk", "lock", "mdm", "scanner")
    override fun enabled(prefix: String) = when (prefix) {
        "dialog", "picker", "ui" -> cfg.jsApi
        "icon" -> cfg.on("altIcons")
        "widget" -> cfg.on("widget")
        "tile" -> cfg.on("quickTile")
        "kiosk" -> cfg.on("kiosk")
        "lock" -> cfg.on("appLock")
        "mdm" -> cfg.on("mdm")
        "scanner" -> cfg.on("barcodeScanner")
        else -> false
    }

    override fun handle(prefix: String, cmd: String, a: JSONObject, r: Reply) {
        when (prefix) {
            "dialog" -> dialog(cmd, a, r)
            "picker" -> picker(cmd, a, r)
            "ui" -> ui(cmd, a, r)
            "icon" -> icon(cmd, a, r)
            "widget" -> { prefs(host).edit().putString("widget", a.toString()).apply(); AppWidget.refresh(host); r.ok() }
            "tile" -> { prefs(host).edit().putString("tile", a.toString()).apply(); QsTile.refresh(host); r.ok() }
            "kiosk" -> kiosk(cmd, r)
            "lock" -> when (cmd) { "now" -> { showLock(); r.ok() }; "status" -> r.ok("locked", lockView != null); else -> r.err("unknown lock.$cmd") }
            "mdm" -> r.ok("config", mdmConfig(host))
            "scanner" -> when (cmd) { "start" -> { startScanner(); r.ok() }; "stop" -> { stopScanner(); r.ok() }; "trigger" -> { softTrigger(a.optBoolean("on", true)); r.ok() }; else -> r.err("unknown scanner.$cmd") }
        }
    }

    // ---------------- Dialog & action sheet ----------------
    private fun dialog(cmd: String, a: JSONObject, r: Reply) {
        val b = AlertDialog.Builder(host).setTitle(a.str("title").ifBlank { null }).setMessage(a.str("message").ifBlank { null }).setCancelable(a.optBoolean("cancelable", true))
        when (cmd) {
            "alert" -> b.setPositiveButton(a.str("ok", "OK")) { _, _ -> r.ok() }.setOnCancelListener { r.ok() }.show()
            "confirm" -> b.setPositiveButton(a.str("ok", "OK")) { _, _ -> r.ok("value", true) }.setNegativeButton(a.str("cancel", "Batal")) { _, _ -> r.ok("value", false) }
                .setOnCancelListener { r.ok("value", false) }.show()
            "prompt" -> {
                val input = EditText(host).apply {
                    setText(a.str("value")); hint = a.str("placeholder")
                    inputType = when (a.str("type")) { "number" -> InputType.TYPE_CLASS_NUMBER; "password" -> InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD; "email" -> InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS or InputType.TYPE_CLASS_TEXT; else -> InputType.TYPE_CLASS_TEXT }
                }
                val pad = (20 * host.resources.displayMetrics.density).toInt()
                b.setView(FrameLayout(host).apply { setPadding(pad, pad / 2, pad, 0); addView(input) })
                    .setPositiveButton(a.str("ok", "OK")) { _, _ -> r.ok("value", input.text.toString()) }
                    .setNegativeButton(a.str("cancel", "Batal")) { _, _ -> r.ok("value", null) }.setOnCancelListener { r.ok("value", null) }.show()
            }
            "actionSheet" -> {
                val opts = (a.optJSONArray("options") ?: JSONArray()).let { arr -> (0 until arr.length()).map { i -> arr.opt(i).let { o -> if (o is JSONObject) o.str("label", o.str("text")) to o.optBoolean("destructive") else o.toString() to false } } }
                val sheet = BottomSheetDialog(host)
                val box = LinearLayout(host).apply { orientation = LinearLayout.VERTICAL; setPadding(0, 16, 0, 32) }
                val dp = host.resources.displayMetrics.density
                a.str("title").takeIf { it.isNotEmpty() }?.let { t -> box.addView(TextView(host).apply { text = t; setPadding((20 * dp).toInt(), (12 * dp).toInt(), (20 * dp).toInt(), (8 * dp).toInt()); setTextColor(Color.GRAY); textSize = 13f }) }
                var picked = false
                opts.forEachIndexed { idx, (label, destructive) ->
                    box.addView(TextView(host).apply {
                        text = label; textSize = 16f; setPadding((20 * dp).toInt(), (14 * dp).toInt(), (20 * dp).toInt(), (14 * dp).toInt())
                        if (destructive) setTextColor(Color.parseColor("#d32f2f"))
                        val tv = android.util.TypedValue(); host.theme.resolveAttribute(android.R.attr.selectableItemBackground, tv, true); setBackgroundResource(tv.resourceId)
                        setOnClickListener { picked = true; sheet.dismiss(); r.ok(JSONObject().put("index", idx).put("label", label)) }
                    })
                }
                sheet.setContentView(box)
                sheet.setOnDismissListener { if (!picked) r.ok(JSONObject().put("index", -1)) }
                sheet.show()
            }
            "toast" -> { android.widget.Toast.makeText(host, a.str("message").take(300), if (a.optBoolean("long")) android.widget.Toast.LENGTH_LONG else android.widget.Toast.LENGTH_SHORT).show(); r.ok() }
            else -> r.err("unknown dialog.$cmd")
        }
    }

    // ---------------- Date / time picker ----------------
    private fun picker(cmd: String, a: JSONObject, r: Reply) {
        val cal = Calendar.getInstance()
        when (cmd) {
            "date" -> {
                a.str("value").split("-").takeIf { it.size == 3 }?.let { p -> runCatching { cal.set(p[0].toInt(), p[1].toInt() - 1, p[2].take(2).toInt()) } }
                val d = DatePickerDialog(host, { _, y, m, day -> r.ok("value", "%04d-%02d-%02d".format(y, m + 1, day)) }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH))
                fun ms(s: String) = runCatching { java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).parse(s)!!.time }.getOrNull()
                ms(a.str("min"))?.let { d.datePicker.minDate = it }
                ms(a.str("max"))?.let { d.datePicker.maxDate = it }
                d.setOnCancelListener { r.ok("value", null) }
                d.show()
            }
            "time" -> {
                a.str("value").split(":").takeIf { it.size >= 2 }?.let { p -> runCatching { cal.set(Calendar.HOUR_OF_DAY, p[0].toInt()); cal.set(Calendar.MINUTE, p[1].toInt()) } }
                val t = TimePickerDialog(host, { _, h, m -> r.ok("value", "%02d:%02d".format(h, m)) }, cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE), a.optBoolean("is24", true))
                t.setOnCancelListener { r.ok("value", null) }
                t.show()
            }
            else -> r.err("unknown picker.$cmd")
        }
    }

    // ---------------- Status bar, orientasi, tema ----------------
    private fun ui(cmd: String, a: JSONObject, r: Reply) {
        val ctl = WindowInsetsControllerCompat(host.window, host.window.decorView)
        when (cmd) {
            "statusBar" -> {
                a.str("color").takeIf { it.isNotEmpty() }?.let { c ->
                    val col = runCatching { Color.parseColor(c) }.getOrNull() ?: return r.err("warna tidak valid")
                    host.findViewById<View>(R.id.root).setBackgroundColor(col)
                    val light = if (a.has("light")) a.optBoolean("light") else ColorUtils.calculateLuminance(col) > 0.5
                    ctl.isAppearanceLightStatusBars = light; ctl.isAppearanceLightNavigationBars = light
                }
                if (a.has("hidden")) if (a.optBoolean("hidden")) ctl.hide(WindowInsetsCompat.Type.statusBars()) else ctl.show(WindowInsetsCompat.Type.statusBars())
                r.ok()
            }
            "fullscreen" -> {
                if (a.optBoolean("on", true)) { ctl.hide(WindowInsetsCompat.Type.systemBars()); ctl.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE }
                else ctl.show(WindowInsetsCompat.Type.systemBars())
                r.ok()
            }
            "orientation" -> {
                host.requestedOrientation = when (a.str("value")) {
                    "portrait" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
                    "landscape" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                    "locked" -> ActivityInfo.SCREEN_ORIENTATION_LOCKED
                    else -> ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                }
                r.ok()
            }
            "theme" -> r.ok("dark", (host.resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES)
            "toolbar" -> { host.setToolbar(a.optBoolean("visible", true), a.str("title")); r.ok() }
            "refresh" -> { host.setPullToRefresh(a.optBoolean("enable", true)); r.ok() }
            else -> r.err("unknown ui.$cmd")
        }
    }

    // ---------------- Ganti ikon (activity-alias yang dibuat builder) ----------------
    private fun icon(cmd: String, a: JSONObject, r: Reply) {
        val pm = host.packageManager
        val names = listOf("IconDefault") + (1..3).map { "IconAlt$it" }
        val comps = names.map { ComponentName(host.packageName, "app.apkify.shell.$it") }
            .filter { c -> runCatching { pm.getActivityInfo(c, PackageManager.MATCH_DISABLED_COMPONENTS) }.isSuccess }
        if (comps.isEmpty()) return r.err("ikon alternatif belum diunggah saat build")
        when (cmd) {
            "list" -> r.ok(JSONObject().put("icons", JSONArray(comps.map { it.className.substringAfterLast(".IconAlt", "default").substringAfterLast('.') }))
                .put("current", comps.firstOrNull { pm.getComponentEnabledSetting(it).let { s -> s == PackageManager.COMPONENT_ENABLED_STATE_ENABLED || (s == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && it.className.endsWith("IconDefault")) } }
                    ?.className?.substringAfterLast(".IconAlt", "default")?.substringAfterLast('.') ?: "default"))
            "set" -> {
                val want = a.str("name", "default").let { if (it == "default" || it == "0") "IconDefault" else "IconAlt${it.removePrefix("alt")}" }
                val target = comps.firstOrNull { it.className.endsWith(".$want") } ?: return r.err("ikon '$want' tidak ada")
                comps.forEach { c ->
                    pm.setComponentEnabledSetting(c, if (c == target) PackageManager.COMPONENT_ENABLED_STATE_ENABLED else PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
                }
                r.ok()
            }
            else -> r.err("unknown icon.$cmd")
        }
    }

    // ---------------- Kiosk (lock task / screen pinning) ----------------
    private fun kiosk(cmd: String, r: Reply) {
        val am = host.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        when (cmd) {
            "start" -> { runCatching { host.startLockTask() }.onSuccess { r.ok() }.onFailure { r.err(it.message ?: "gagal") } }
            "stop" -> { runCatching { host.stopLockTask() }; r.ok() }
            "status" -> r.ok(JSONObject().put("active", am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE)
                .put("pinned", am.lockTaskModeState == ActivityManager.LOCK_TASK_MODE_PINNED))
            else -> r.err("unknown kiosk.$cmd")
        }
    }

    // ---------------- Kunci aplikasi ----------------
    private var lockView: View? = null
    private var pausedAt = 0L
    private var authing = false

    fun onCreateLock() { if (cfg.on("appLock")) showLock() }
    override fun onPause() { if (cfg.on("appLock") && !host.externalFlow) pausedAt = SystemClock.elapsedRealtime() }
    override fun onResume() {
        if (cfg.on("appLock") && pausedAt > 0 && !authing && !host.externalFlow && lockView == null &&
            SystemClock.elapsedRealtime() - pausedAt > cfg.section("appLock").optLong("timeoutSec", 30) * 1000) showLock()
        if (cfg.on("barcodeScanner")) startScanner()
    }

    private fun showLock() {
        if (lockView != null) return
        val root = host.findViewById<ViewGroup>(android.R.id.content)
        val dp = host.resources.displayMetrics.density
        val v = LinearLayout(host).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; isClickable = true; isFocusable = true
            setBackgroundColor(runCatching { Color.parseColor(cfg.statusBar) }.getOrDefault(Color.DKGRAY))
            addView(ImageView(host).apply { setImageResource(host.applicationInfo.icon); layoutParams = LinearLayout.LayoutParams((72 * dp).toInt(), (72 * dp).toInt()) })
            addView(TextView(host).apply { text = cfg.name; setTextColor(Color.WHITE); textSize = 20f; gravity = Gravity.CENTER; setPadding(0, (16 * dp).toInt(), 0, (24 * dp).toInt()) })
            addView(Button(host).apply { text = "Buka kunci"; setOnClickListener { auth() } })
        }
        root.addView(v, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        lockView = v
        auth()
    }

    private fun auth() {
        val allowed = BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL
        if (BiometricManager.from(host).canAuthenticate(allowed) != BiometricManager.BIOMETRIC_SUCCESS) return unlock() // perangkat tanpa kunci layar
        authing = true
        BiometricPrompt(host, ContextCompat.getMainExecutor(host), object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) { authing = false; unlock() }
            override fun onAuthenticationError(code: Int, msg: CharSequence) { authing = false }
        }).authenticate(BiometricPrompt.PromptInfo.Builder().setTitle(cfg.name).setSubtitle("Buka kunci aplikasi").setAllowedAuthenticators(allowed).build())
    }

    private fun unlock() {
        lockView?.let { (it.parent as? ViewGroup)?.removeView(it) }
        lockView = null; pausedAt = 0
        emit("unlock")
    }

    // ---------------- Pemindai barcode industri (intent broadcast) ----------------
    private var scanRcv: BroadcastReceiver? = null
    private val scanAction by lazy { "${host.packageName}.SCAN" }

    private fun startScanner() {
        if (scanRcv != null) return
        val f = IntentFilter().apply {
            addAction(scanAction)                                       // Zebra DataWedge & Honeywell (dikonfigurasi otomatis)
            addAction("android.intent.ACTION_DECODE_DATA")              // Urovo
            addAction("com.sunmi.scanner.ACTION_DATA_CODE_RECEIVED")    // Sunmi
            addAction("nlscan.action.SCANNER_RESULT")                  // Newland
            addAction("com.android.server.scannerservice.broadcast")    // iData
            addAction("com.scanner.broadcast")                         // Chainway / generik
            addAction("com.honeywell.decode.intent.action.EDIT_DATA")   // Honeywell (lama)
            addCategory(Intent.CATEGORY_DEFAULT)
        }
        val rcv = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) {
                val e = i.extras ?: Bundle()
                val data = listOf("com.symbol.datawedge.data_string", "data", "barcode_string", "SCAN_BARCODE1", "scannerdata", "barcodeData", "barcode", "value")
                    .firstNotNullOfOrNull { k -> e.getString(k)?.takeIf { it.isNotEmpty() } }
                    ?: e.getByteArray("barocode")?.let { String(it, 0, e.getInt("length", it.size)) } ?: return
                val type = e.getString("com.symbol.datawedge.label_type") ?: e.getString("codeId") ?: e.getString("SCAN_BARCODE_TYPE_NAME") ?: (e.get("barcodeType")?.toString() ?: "")
                emit("scan", JSONObject().put("data", data.trim()).put("symbology", type).put("source", e.getString("com.symbol.datawedge.source") ?: i.action))
            }
        }
        // sebagian vendor mengirim broadcast implisit dari aplikasi sistem -> harus exported
        ContextCompat.registerReceiver(host, rcv, f, ContextCompat.RECEIVER_EXPORTED)
        scanRcv = rcv
        configureDataWedge(); claimHoneywell(true)
    }

    private fun stopScanner() { scanRcv?.let { runCatching { host.unregisterReceiver(it) } }; scanRcv = null; claimHoneywell(false) }

    /** Buat profil DataWedge untuk aplikasi ini: barcode (+RFID) -> intent broadcast ke scanAction */
    private fun configureDataWedge() = runCatching {
        val app = Bundle().apply { putString("PACKAGE_NAME", host.packageName); putStringArray("ACTIVITY_LIST", arrayOf("*")) }
        val intentPlugin = Bundle().apply {
            putString("PLUGIN_NAME", "INTENT"); putString("RESET_CONFIG", "true")
            putBundle("PARAM_LIST", Bundle().apply { putString("intent_output_enabled", "true"); putString("intent_action", scanAction); putString("intent_category", Intent.CATEGORY_DEFAULT); putString("intent_delivery", "2") })
        }
        val keystroke = Bundle().apply { putString("PLUGIN_NAME", "KEYSTROKE"); putBundle("PARAM_LIST", Bundle().apply { putString("keystroke_output_enabled", "false") }) }
        val barcode = Bundle().apply { putString("PLUGIN_NAME", "BARCODE"); putBundle("PARAM_LIST", Bundle().apply { putString("scanner_selection", "auto"); putString("scanner_input_enabled", "true") }) }
        val rfid = Bundle().apply { putString("PLUGIN_NAME", "RFID"); putBundle("PARAM_LIST", Bundle().apply { putString("rfid_input_enabled", "true") }) }
        val profile = Bundle().apply {
            putString("PROFILE_NAME", AppConfig.get(host).name.take(30)); putString("PROFILE_ENABLED", "true"); putString("CONFIG_MODE", "CREATE_IF_NOT_EXIST")
            putParcelableArray("APP_LIST", arrayOf(app))
            putParcelableArrayList("PLUGIN_CONFIG", arrayListOf(barcode, rfid, intentPlugin, keystroke))
        }
        host.sendBroadcast(Intent("com.symbol.datawedge.api.ACTION").setPackage("com.symbol.datawedge").putExtra("com.symbol.datawedge.api.SET_CONFIG", profile))
    }

    private fun claimHoneywell(claim: Boolean) = runCatching {
        if (claim) host.sendBroadcast(Intent("com.honeywell.aidc.action.ACTION_CLAIM_SCANNER").setPackage("com.intermec.datacollectionservice")
            .putExtra("com.honeywell.aidc.extra.EXTRA_SCANNER", "dcs.scanner.imager").putExtra("com.honeywell.aidc.extra.EXTRA_PROFILE", "DEFAULT")
            .putExtra("com.honeywell.aidc.extra.EXTRA_PROPERTIES", Bundle().apply { putBoolean("DPR_DATA_INTENT", true); putString("DPR_DATA_INTENT_ACTION", scanAction) }))
        else host.sendBroadcast(Intent("com.honeywell.aidc.action.ACTION_RELEASE_SCANNER").setPackage("com.intermec.datacollectionservice"))
    }

    private fun softTrigger(on: Boolean) = runCatching {
        host.sendBroadcast(Intent("com.symbol.datawedge.api.ACTION").setPackage("com.symbol.datawedge").putExtra("com.symbol.datawedge.api.SOFT_SCAN_TRIGGER", if (on) "START_SCANNING" else "STOP_SCANNING"))
        host.sendBroadcast(Intent("com.honeywell.aidc.action.ACTION_CONTROL_SCANNER").setPackage("com.intermec.datacollectionservice").putExtra("com.honeywell.aidc.extra.EXTRA_SCAN", on))
    }

    override fun onDestroy() = stopScanner()

    companion object {
        fun prefs(c: Context) = c.getSharedPreferences("apkify_ui", Context.MODE_PRIVATE)

        /** Konfigurasi dari MDM/EMM (Managed configurations) sebagai JSON */
        fun mdmConfig(c: Context): JSONObject {
            val b = (c.getSystemService(Context.RESTRICTIONS_SERVICE) as RestrictionsManager).applicationRestrictions
            val o = JSONObject()
            b.keySet().forEach { k -> o.put(k, b.get(k)?.let { v -> if (v is Array<*>) JSONArray(v.map { it.toString() }) else v } ?: JSONObject.NULL) }
            b.getString("config")?.let { s -> runCatching { JSONObject(s) }.getOrNull()?.let { o.put("config", it) } }
            return o
        }
    }
}
