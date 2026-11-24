package app.apkify.shell

import android.content.Context
import android.nfc.NdefMessage
import android.nfc.NdefRecord
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.cardemulation.HostApduService
import android.nfc.tech.Ndef
import android.nfc.tech.NdefFormatable
import android.os.Bundle
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.nio.charset.Charset

/**
 * NFC: baca/tulis NDEF (teks, URL, MIME), info tag (UID, teknologi), mode pantau terus-menerus,
 * dan emulasi kartu (HCE) sebagai NFC Forum Type 4 Tag atau respons APDU statis untuk AID kustom.
 */
class NfcPlugin(host: MainActivity) : Plugin(host) {
    override val prefixes = setOf("nfc")
    override fun enabled(prefix: String) = cfg.on("nfc")

    private val adapter: NfcAdapter? by lazy { NfcAdapter.getDefaultAdapter(host) }
    private var active = false
    private var watch = false
    private var readReply: Reply? = null
    private var writeMsg: NdefMessage? = null
    private var writeReply: Reply? = null

    override fun handle(prefix: String, cmd: String, a: JSONObject, r: Reply) {
        when (cmd) {
            "status" -> r.ok(JSONObject().put("available", adapter != null).put("enabled", adapter?.isEnabled == true).put("hce", cfg.on("nfcHce")))
            "read" -> { if (!ready(r)) return; readReply = r; start() }
            "watch" -> { if (!ready(r)) return; watch = true; start(); r.ok() }
            "write" -> {
                if (!ready(r)) return
                writeMsg = message(a.optJSONArray("records") ?: JSONArray().put(a))
                writeReply = r
                start()
            }
            "stop" -> { watch = false; readReply?.err("cancelled"); writeReply?.err("cancelled"); readReply = null; writeReply = null; writeMsg = null; stop(); r.ok() }
            "emulate" -> {
                if (!cfg.on("nfcHce")) return r.err("aktifkan fitur 'Emulasi kartu NFC (HCE)'")
                val msg = message(a.optJSONArray("records") ?: JSONArray().put(a))
                prefs(host).edit().putString("ndef", Base64.encodeToString(msg.toByteArray(), Base64.NO_WRAP)).apply()
                r.ok("bytes", msg.byteArrayLength)
            }
            "emulateApdu" -> {
                if (!cfg.on("nfcHce")) return r.err("aktifkan fitur 'Emulasi kartu NFC (HCE)'")
                prefs(host).edit().putString("apdu", (a.optJSONObject("responses") ?: JSONObject()).toString()).apply()
                r.ok()
            }
            "emulateStop" -> { prefs(host).edit().clear().apply(); r.ok() }
            else -> r.err("unknown nfc.$cmd")
        }
    }

    private fun ready(r: Reply): Boolean {
        val ad = adapter ?: run { r.err("perangkat tidak mendukung NFC"); return false }
        if (!ad.isEnabled) { r.err("NFC mati: aktifkan di Pengaturan (Apkify.settings.open({type:'nfc'}))"); return false }
        return true
    }

    private fun start() {
        if (active) return
        active = true
        val flags = NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or NfcAdapter.FLAG_READER_NFC_F or NfcAdapter.FLAG_READER_NFC_V or NfcAdapter.FLAG_READER_NFC_BARCODE
        adapter?.enableReaderMode(host, { tag -> onTag(tag) }, flags, Bundle().apply { putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 250) })
    }

    private fun stop() { if (active) runCatching { adapter?.disableReaderMode(host) }; active = false }

    private fun onTag(tag: Tag) {
        val msg = writeMsg
        if (msg != null) {
            val rep = writeReply
            writeMsg = null; writeReply = null
            try { write(tag, msg); rep?.ok(info(tag)) } catch (e: Exception) { rep?.err(e.message ?: "gagal menulis") }
        } else {
            val json = info(tag)
            readReply?.ok(json); readReply = null
            emit("nfc", json)
        }
        if (!watch && readReply == null && writeMsg == null) ui { stop() }
    }

    private fun write(tag: Tag, msg: NdefMessage) {
        Ndef.get(tag)?.let { n ->
            n.connect()
            try {
                if (!n.isWritable) throw IllegalStateException("tag hanya-baca")
                if (n.maxSize < msg.byteArrayLength) throw IllegalStateException("data terlalu besar (${msg.byteArrayLength}/${n.maxSize} byte)")
                n.writeNdefMessage(msg)
            } finally { runCatching { n.close() } }
            return
        }
        NdefFormatable.get(tag)?.let { f -> f.connect(); try { f.format(msg) } finally { runCatching { f.close() } }; return }
        throw IllegalStateException("tag tidak mendukung NDEF")
    }

    private fun info(tag: Tag): JSONObject {
        val o = JSONObject().put("id", hex(tag.id)).put("techs", JSONArray(tag.techList.map { it.substringAfterLast('.') }))
        Ndef.get(tag)?.let { n ->
            runCatching {
                n.connect()
                o.put("type", n.type).put("maxSize", n.maxSize).put("writable", n.isWritable)
                val m = n.ndefMessage ?: n.cachedNdefMessage
                o.put("records", JSONArray(m?.records?.map { rec(it) } ?: emptyList<JSONObject>()))
                n.close()
            }.onFailure { n.cachedNdefMessage?.let { m -> o.put("records", JSONArray(m.records.map { rec(it) })) } }
        }
        if (!o.has("records")) o.put("records", JSONArray())
        return o
    }

    private fun rec(r: NdefRecord): JSONObject {
        val o = JSONObject().put("tnf", r.tnf).put("type", String(r.type, Charsets.US_ASCII)).put("payload", Base64.encodeToString(r.payload, Base64.NO_WRAP))
        when {
            r.tnf == NdefRecord.TNF_WELL_KNOWN && r.type.contentEquals(NdefRecord.RTD_TEXT) && r.payload.isNotEmpty() -> {
                val st = r.payload[0].toInt()
                val langLen = st and 0x3F
                val cs = if (st and 0x80 != 0) Charsets.UTF_16 else Charsets.UTF_8
                o.put("recordType", "text").put("lang", String(r.payload, 1, langLen, Charsets.US_ASCII))
                    .put("value", String(r.payload, 1 + langLen, r.payload.size - 1 - langLen, cs))
            }
            r.toUri() != null -> o.put("recordType", "uri").put("value", r.toUri().toString())
            r.tnf == NdefRecord.TNF_MIME_MEDIA -> o.put("recordType", "mime").put("mime", r.toMimeType()).put("value", runCatching { String(r.payload, Charset.forName("UTF-8")) }.getOrDefault(""))
            r.tnf == NdefRecord.TNF_EXTERNAL_TYPE -> o.put("recordType", "external").put("value", String(r.payload, Charsets.UTF_8))
            else -> o.put("recordType", "unknown")
        }
        return o
    }

    private fun message(arr: JSONArray): NdefMessage {
        val recs = (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            val v = o.str("value", o.str("text", o.str("url")))
            when (o.str("type", o.str("recordType", if (o.has("url")) "uri" else "text"))) {
                "uri", "url" -> NdefRecord.createUri(v)
                "mime" -> NdefRecord.createMime(o.str("mime", "text/plain"), if (o.has("base64")) Base64.decode(o.str("base64"), Base64.DEFAULT) else v.toByteArray())
                "app" -> NdefRecord.createApplicationRecord(v.ifBlank { host.packageName })
                "external" -> NdefRecord.createExternal(o.str("domain", host.packageName), o.str("externalType", "data"), v.toByteArray())
                else -> NdefRecord.createTextRecord(o.str("lang", "id"), v)
            }
        }
        require(recs.isNotEmpty()) { "records kosong" }
        return NdefMessage(recs.toTypedArray())
    }

    override fun onPause() { if (active) { runCatching { adapter?.disableReaderMode(host) } } }
    override fun onResume() { if (active) { active = false; start() } }
    override fun onDestroy() = stop()

    companion object {
        fun prefs(c: Context) = c.getSharedPreferences("apkify_hce", Context.MODE_PRIVATE)
        fun hex(b: ByteArray?) = b?.joinToString("") { "%02X".format(it) } ?: ""
    }
}

/**
 * Host Card Emulation: emulasi NFC Forum Type 4 Tag berisi pesan NDEF dari Apkify.nfc.emulate(),
 * atau respons statis per perintah APDU (hex) dari Apkify.nfc.emulateApdu().
 */
class HceService : HostApduService() {
    private var selected = 0 // 1 = CC, 2 = NDEF

    override fun processCommandApdu(apdu: ByteArray, extras: Bundle?): ByteArray {
        val hex = NfcPlugin.hex(apdu)
        val p = NfcPlugin.prefs(this)
        // respons statis (prefix perintah -> respons)
        p.getString("apdu", null)?.let { s ->
            runCatching { JSONObject(s) }.getOrNull()?.let { m -> m.keys().asSequence().sortedByDescending { it.length }.firstOrNull { hex.startsWith(it.uppercase()) }?.let { return unhex(m.getString(it)) } }
        }
        val ndef = p.getString("ndef", null)?.let { Base64.decode(it, Base64.DEFAULT) } ?: return NOT_FOUND
        val file = byteArrayOf((ndef.size shr 8).toByte(), ndef.size.toByte()) + ndef
        return when {
            hex.startsWith("00A4040007D2760000850101") -> { selected = 0; OK }
            hex.startsWith("00A4000C02E103") -> { selected = 1; OK }
            hex.startsWith("00A4000C02E104") -> { selected = 2; OK }
            apdu.size >= 5 && apdu[0] == 0x00.toByte() && apdu[1] == 0xB0.toByte() -> {
                val src = when (selected) { 1 -> cc(file.size); 2 -> file; else -> return NOT_FOUND }
                val off = ((apdu[2].toInt() and 0xFF) shl 8) or (apdu[3].toInt() and 0xFF)
                val len = (apdu[4].toInt() and 0xFF).let { if (it == 0) 256 else it }
                if (off > src.size) return NOT_FOUND
                src.copyOfRange(off, minOf(src.size, off + len)) + OK
            }
            else -> NOT_FOUND
        }
    }

    private fun cc(max: Int): ByteArray {
        val m = maxOf(max, 0x80).coerceAtMost(0x7FFF)
        return byteArrayOf(0x00, 0x0F, 0x20, 0x00, 0x3B, 0x00, 0x34, 0x04, 0x06, 0xE1.toByte(), 0x04, (m shr 8).toByte(), m.toByte(), 0x00, 0xFF.toByte())
    }

    override fun onDeactivated(reason: Int) { selected = 0 }

    private fun unhex(s: String): ByteArray { val c = s.replace(" ", ""); return ByteArray(c.length / 2) { c.substring(it * 2, it * 2 + 2).toInt(16).toByte() } }

    companion object {
        val OK = byteArrayOf(0x90.toByte(), 0x00)
        val NOT_FOUND = byteArrayOf(0x6A.toByte(), 0x82.toByte())
    }
}
