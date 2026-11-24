package app.apkify.shell

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import android.util.Base64
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

/**
 * USB OTG (host): daftar perangkat, minta izin, kirim/terima data bulk.
 * Cocok untuk printer USB (kelas 7, ESC/POS) dan adaptor serial CDC-ACM (atur baud rate).
 */
class UsbPlugin(host: MainActivity) : Plugin(host) {
    override val prefixes = setOf("usb")
    override fun enabled(prefix: String) = cfg.on("usb")

    private val um by lazy { host.getSystemService(Context.USB_SERVICE) as UsbManager }
    private class Open(val dev: UsbDevice, val conn: UsbDeviceConnection, val intf: UsbInterface, val out: UsbEndpoint?, val inp: UsbEndpoint?)
    private val open = HashMap<String, Open>()
    private val action by lazy { "${host.packageName}.USB_PERMISSION" }

    private fun json(d: UsbDevice) = JSONObject().put("deviceName", d.deviceName).put("vendorId", d.vendorId).put("productId", d.productId)
        .put("name", d.productName ?: "").put("manufacturer", d.manufacturerName ?: "").put("class", d.deviceClass)
        .put("interfaces", JSONArray((0 until d.interfaceCount).map { d.getInterface(it).interfaceClass }))
        .put("permission", um.hasPermission(d))

    private fun find(a: JSONObject): UsbDevice? {
        val name = a.str("deviceName")
        return um.deviceList.values.firstOrNull { (name.isNotEmpty() && it.deviceName == name) || (a.optInt("vendorId", -1) == it.vendorId && (a.optInt("productId", -1) == -1 || a.optInt("productId") == it.productId)) }
            ?: if (name.isEmpty() && !a.has("vendorId")) um.deviceList.values.firstOrNull() else null
    }

    override fun handle(prefix: String, cmd: String, a: JSONObject, r: Reply) {
        when (cmd) {
            "list" -> r.ok("devices", JSONArray(um.deviceList.values.map { json(it) }))
            "requestPermission" -> {
                val d = find(a) ?: return r.err("perangkat USB tidak ditemukan")
                permission(d) { ok -> r.ok("granted", ok) }
            }
            "open" -> {
                val d = find(a) ?: return r.err("perangkat USB tidak ditemukan")
                permission(d) { ok ->
                    if (!ok) return@permission r.err("izin USB ditolak")
                    try { r.ok(openDev(d, a.optInt("baudRate", 0))) } catch (e: Exception) { r.err(e.message ?: "gagal membuka") }
                }
            }
            "write", "print" -> {
                val d = find(a) ?: return r.err("perangkat USB tidak ditemukan")
                permission(d) { ok ->
                    if (!ok) return@permission r.err("izin USB ditolak")
                    r.bg {
                        val o = open[d.deviceName] ?: run { openDev(d, a.optInt("baudRate", 0)); open[d.deviceName]!! }
                        val ep = o.out ?: throw IllegalStateException("endpoint OUT tidak ada")
                        val bytes = when { a.has("base64") -> Base64.decode(a.str("base64"), Base64.DEFAULT); else -> a.str("text").toByteArray(charset(a.str("charset", "UTF-8"))) }
                        var off = 0
                        while (off < bytes.size) {
                            val n = minOf(16384, bytes.size - off)
                            val w = o.conn.bulkTransfer(ep, bytes, off, n, a.optInt("timeout", 5000))
                            if (w < 0) throw IllegalStateException("bulkTransfer gagal")
                            off += w
                        }
                        r.ok("bytes", bytes.size)
                    }
                }
            }
            "read" -> {
                val o = find(a)?.let { open[it.deviceName] } ?: return r.err("buka perangkat dulu (usb.open)")
                val ep = o.inp ?: return r.err("endpoint IN tidak ada")
                r.bg {
                    val buf = ByteArray(a.optInt("length", 4096).coerceIn(1, 65536))
                    val n = o.conn.bulkTransfer(ep, buf, buf.size, a.optInt("timeout", 3000))
                    r.ok(JSONObject().put("base64", if (n > 0) Base64.encodeToString(buf.copyOf(n), Base64.NO_WRAP) else "").put("length", maxOf(n, 0)))
                }
            }
            "close" -> { find(a)?.let { d -> open.remove(d.deviceName)?.let { it.conn.releaseInterface(it.intf); it.conn.close() } }; r.ok() }
            else -> r.err("unknown usb.$cmd")
        }
    }

    private fun permission(d: UsbDevice, cb: (Boolean) -> Unit) {
        if (um.hasPermission(d)) return cb(true)
        val rcv = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) {
                runCatching { host.unregisterReceiver(this) }
                host.runOnUiThread { cb(i.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false) || um.hasPermission(d)) }
            }
        }
        ContextCompat.registerReceiver(host, rcv, IntentFilter(action), ContextCompat.RECEIVER_NOT_EXPORTED)
        val flags = if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0
        um.requestPermission(d, PendingIntent.getBroadcast(host, 0, Intent(action).setPackage(host.packageName), flags))
    }

    private fun openDev(d: UsbDevice, baud: Int): JSONObject {
        open[d.deviceName]?.let { return json(d) }
        val conn = um.openDevice(d) ?: throw IllegalStateException("tidak bisa membuka perangkat")
        // pilih interface dengan endpoint bulk (printer = kelas 7, CDC data = kelas 10)
        val intf = (0 until d.interfaceCount).map { d.getInterface(it) }
            .sortedByDescending { if (it.interfaceClass == UsbConstants.USB_CLASS_PRINTER || it.interfaceClass == UsbConstants.USB_CLASS_CDC_DATA) 1 else 0 }
            .firstOrNull { i -> (0 until i.endpointCount).any { i.getEndpoint(it).type == UsbConstants.USB_ENDPOINT_XFER_BULK } }
            ?: throw IllegalStateException("tidak ada endpoint bulk")
        conn.claimInterface(intf, true)
        val eps = (0 until intf.endpointCount).map { intf.getEndpoint(it) }.filter { it.type == UsbConstants.USB_ENDPOINT_XFER_BULK }
        // CDC-ACM: SET_LINE_CODING (baud, 8N1) + SET_CONTROL_LINE_STATE (DTR/RTS)
        if (baud > 0) {
            val lc = byteArrayOf((baud and 0xFF).toByte(), (baud shr 8 and 0xFF).toByte(), (baud shr 16 and 0xFF).toByte(), (baud shr 24 and 0xFF).toByte(), 0, 0, 8)
            conn.controlTransfer(0x21, 0x20, 0, 0, lc, lc.size, 1000)
            conn.controlTransfer(0x21, 0x22, 0x03, 0, null, 0, 1000)
        }
        open[d.deviceName] = Open(d, conn, intf, eps.firstOrNull { it.direction == UsbConstants.USB_DIR_OUT }, eps.firstOrNull { it.direction == UsbConstants.USB_DIR_IN })
        return json(d)
    }

    override fun onDestroy() { open.values.forEach { runCatching { it.conn.releaseInterface(it.intf); it.conn.close() } }; open.clear() }
}
