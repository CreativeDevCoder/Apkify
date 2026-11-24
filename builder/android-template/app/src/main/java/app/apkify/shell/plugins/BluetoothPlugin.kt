package app.apkify.shell

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.ParcelUuid
import android.util.Base64
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/**
 * Bluetooth Classic (printer thermal ESC/POS lewat SPP) & Bluetooth Low Energy
 * (scan, connect, read, write, notify). Semua data biner dikirim sebagai base64.
 */
@SuppressLint("MissingPermission")
class BluetoothPlugin(host: MainActivity) : Plugin(host) {
    override val prefixes = setOf("bt", "ble")
    override fun enabled(prefix: String) = cfg.on("bluetooth")

    private val adapter: BluetoothAdapter? by lazy { (host.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter }
    private val gatts = HashMap<String, Conn>()
    private var scanCb: ScanCallback? = null
    private val sockets = HashMap<String, android.bluetooth.BluetoothSocket>()

    private fun perms(scan: Boolean): List<String> = if (Build.VERSION.SDK_INT >= 31)
        listOf(Manifest.permission.BLUETOOTH_CONNECT) + if (scan) listOf(Manifest.permission.BLUETOOTH_SCAN) else emptyList()
    else if (scan) listOf(Manifest.permission.ACCESS_FINE_LOCATION) else emptyList()

    private fun withBt(r: Reply, scan: Boolean = false, go: (BluetoothAdapter) -> Unit) {
        val ad = adapter ?: return r.err("perangkat tidak mendukung Bluetooth")
        host.requestPerms(perms(scan)) { ok ->
            if (!ok) return@requestPerms r.err("izin Bluetooth ditolak")
            if (!ad.isEnabled) return@requestPerms r.err("Bluetooth mati: panggil Apkify.bt.enable()")
            try { go(ad) } catch (e: Exception) { r.err(e.message ?: "bluetooth error") }
        }
    }

    override fun handle(prefix: String, cmd: String, a: JSONObject, r: Reply) {
        if (prefix == "bt") classic(cmd, a, r) else ble(cmd, a, r)
    }

    private fun dev(d: BluetoothDevice, rssi: Int? = null) = JSONObject().put("name", runCatching { d.name }.getOrNull() ?: "").put("address", d.address)
        .put("type", when (d.type) { BluetoothDevice.DEVICE_TYPE_LE -> "le"; BluetoothDevice.DEVICE_TYPE_DUAL -> "dual"; BluetoothDevice.DEVICE_TYPE_CLASSIC -> "classic"; else -> "unknown" })
        .put("bonded", d.bondState == BluetoothDevice.BOND_BONDED).apply { if (rssi != null) put("rssi", rssi) }

    // ---------------- Classic ----------------
    private fun classic(cmd: String, a: JSONObject, r: Reply) {
        when (cmd) {
            "status" -> r.ok(JSONObject().put("available", adapter != null).put("enabled", adapter?.isEnabled == true))
            "enable" -> host.requestPerms(perms(false)) { ok ->
                if (!ok) return@requestPerms r.err("izin Bluetooth ditolak")
                if (adapter?.isEnabled == true) return@requestPerms r.ok("enabled", true)
                host.startForResult(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)) { _, _ -> r.ok("enabled", adapter?.isEnabled == true) }
            }
            "paired" -> withBt(r) { ad -> r.ok("devices", JSONArray(ad.bondedDevices.map { dev(it) })) }
            "discover" -> withBt(r, scan = true) { ad ->
                val found = LinkedHashMap<String, JSONObject>()
                val rcv = object : BroadcastReceiver() {
                    override fun onReceive(c: Context, i: Intent) {
                        val d = if (Build.VERSION.SDK_INT >= 33) i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
                            else @Suppress("DEPRECATION") i.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
                        d ?: return
                        val j = dev(d, i.getShortExtra(BluetoothDevice.EXTRA_RSSI, 0).toInt())
                        found[d.address] = j
                        emit("bt.device", j)
                    }
                }
                ContextCompat.registerReceiver(host, rcv, IntentFilter(BluetoothDevice.ACTION_FOUND), ContextCompat.RECEIVER_EXPORTED)
                ad.startDiscovery()
                main.postDelayed({
                    runCatching { ad.cancelDiscovery(); host.unregisterReceiver(rcv) }
                    r.ok("devices", JSONArray(found.values))
                }, a.optLong("seconds", 10).coerceIn(2, 30) * 1000)
            }
            // kirim byte mentah ke printer thermal / perangkat serial Bluetooth (SPP)
            "print", "send" -> withBt(r) { ad ->
                val address = a.str("address")
                val bytes = data(a)
                r.bg {
                    ad.cancelDiscovery()
                    val sock = sockets[address]?.takeIf { it.isConnected } ?: ad.getRemoteDevice(address).createRfcommSocketToServiceRecord(SPP).also { it.connect() }
                    try {
                        sock.outputStream.write(bytes); sock.outputStream.flush()
                        if (a.optBoolean("keepOpen")) sockets[address] = sock else { Thread.sleep(300); sock.close(); sockets.remove(address) }
                        r.ok("bytes", bytes.size)
                    } catch (e: Exception) { runCatching { sock.close() }; sockets.remove(address); throw e }
                }
            }
            "close" -> { sockets.remove(a.str("address"))?.let { runCatching { it.close() } }; r.ok() }
            else -> r.err("unknown bt.$cmd")
        }
    }

    private fun data(a: JSONObject): ByteArray = when {
        a.has("base64") -> Base64.decode(a.str("base64"), Base64.DEFAULT)
        a.has("bytes") -> a.getJSONArray("bytes").let { arr -> ByteArray(arr.length()) { arr.getInt(it).toByte() } }
        else -> a.str("text").toByteArray(charset(a.str("charset", "UTF-8")))
    }

    // ---------------- BLE ----------------
    private inner class Conn(val address: String) : BluetoothGattCallback() {
        var gatt: BluetoothGatt? = null
        var connectReply: Reply? = null
        var pending: Reply? = null
        val queue = ArrayDeque<() -> Unit>()

        fun enqueue(op: () -> Unit) { queue.addLast(op); if (pending == null && queue.size == 1) next() }
        fun next() { main.post { if (pending == null) queue.removeFirstOrNull()?.invoke() } }
        fun done() { pending = null; next() }

        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, state: Int) {
            if (state == BluetoothProfile.STATE_CONNECTED) { g.requestMtu(247); main.postDelayed({ g.discoverServices() }, 300) }
            else if (state == BluetoothProfile.STATE_DISCONNECTED) {
                connectReply?.err("gagal terhubung (status $status)"); connectReply = null
                pending?.err("terputus"); pending = null; queue.clear()
                gatts.remove(address); runCatching { g.close() }
                emit("ble.disconnected", JSONObject().put("address", address))
            }
        }

        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
            val svc = JSONArray(g.services.map { s ->
                JSONObject().put("uuid", s.uuid.toString()).put("characteristics", JSONArray(s.characteristics.map { c ->
                    JSONObject().put("uuid", c.uuid.toString()).put("properties", JSONArray(props(c.properties)))
                }))
            })
            connectReply?.ok(JSONObject().put("address", address).put("services", svc)); connectReply = null
        }

        @Deprecated("API < 33") override fun onCharacteristicRead(g: BluetoothGatt, c: BluetoothGattCharacteristic, status: Int) {
            @Suppress("DEPRECATION") result(status, c.value)
        }
        override fun onCharacteristicRead(g: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray, status: Int) = result(status, value)
        override fun onCharacteristicWrite(g: BluetoothGatt, c: BluetoothGattCharacteristic, status: Int) = result(status, null)
        override fun onDescriptorWrite(g: BluetoothGatt, d: BluetoothGattDescriptor, status: Int) = result(status, null)

        @Deprecated("API < 33") override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic) {
            @Suppress("DEPRECATION") changed(c, c.value)
        }
        override fun onCharacteristicChanged(g: BluetoothGatt, c: BluetoothGattCharacteristic, value: ByteArray) = changed(c, value)

        private fun changed(c: BluetoothGattCharacteristic, v: ByteArray?) = emit("ble.notify", JSONObject().put("address", address)
            .put("service", c.service.uuid.toString()).put("characteristic", c.uuid.toString()).put("value", Base64.encodeToString(v ?: ByteArray(0), Base64.NO_WRAP)))

        private fun result(status: Int, v: ByteArray?) {
            val p = pending ?: return
            if (status == BluetoothGatt.GATT_SUCCESS) p.ok(JSONObject().apply { if (v != null) put("value", Base64.encodeToString(v, Base64.NO_WRAP)) }) else p.err("GATT status $status")
            done()
        }
    }

    private fun props(p: Int) = listOfNotNull(
        "read".takeIf { p and BluetoothGattCharacteristic.PROPERTY_READ != 0 },
        "write".takeIf { p and BluetoothGattCharacteristic.PROPERTY_WRITE != 0 },
        "writeWithoutResponse".takeIf { p and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0 },
        "notify".takeIf { p and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0 },
        "indicate".takeIf { p and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0 }
    )

    private fun ble(cmd: String, a: JSONObject, r: Reply) {
        when (cmd) {
            "scan" -> withBt(r, scan = true) { ad ->
                val scanner = ad.bluetoothLeScanner ?: return@withBt r.err("BLE tidak tersedia")
                scanCb?.let { scanner.stopScan(it) }
                val found = LinkedHashMap<String, JSONObject>()
                val nameFilter = a.str("name")
                val cb = object : ScanCallback() {
                    override fun onScanResult(type: Int, res: ScanResult) {
                        val j = dev(res.device, res.rssi)
                        if (j.optString("name").isBlank()) j.put("name", res.scanRecord?.deviceName ?: "")
                        if (nameFilter.isNotEmpty() && !j.optString("name").contains(nameFilter, true)) return
                        j.put("services", JSONArray(res.scanRecord?.serviceUuids?.map { it.toString() } ?: emptyList<String>()))
                        if (found.put(res.device.address, j) == null) emit("ble.device", j)
                    }
                    override fun onScanFailed(code: Int) { r.err("scan gagal ($code)") }
                }
                val filters = a.optJSONArray("services")?.strings()?.map { ScanFilter.Builder().setServiceUuid(ParcelUuid.fromString(it)).build() }
                scanner.startScan(filters, ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(), cb)
                scanCb = cb
                main.postDelayed({ runCatching { scanner.stopScan(cb) }; if (scanCb === cb) scanCb = null; r.ok("devices", JSONArray(found.values)) },
                    a.optLong("seconds", 8).coerceIn(1, 60) * 1000)
            }
            "stopScan" -> { scanCb?.let { cb -> adapter?.bluetoothLeScanner?.stopScan(cb) }; scanCb = null; r.ok() }
            "connect" -> withBt(r) { ad ->
                val address = a.str("address")
                gatts[address]?.gatt?.let { it.disconnect(); it.close() }
                val c = Conn(address)
                c.connectReply = r
                gatts[address] = c
                c.gatt = ad.getRemoteDevice(address).connectGatt(host, a.optBoolean("autoConnect"), c, BluetoothDevice.TRANSPORT_LE)
            }
            "disconnect" -> { gatts.remove(a.str("address"))?.gatt?.let { it.disconnect(); it.close() }; r.ok() }
            "read", "write", "notify" -> {
                val c = gatts[a.str("address")] ?: return r.err("belum terhubung: panggil ble.connect dulu")
                val g = c.gatt ?: return r.err("belum terhubung")
                val ch = g.getService(UUID.fromString(a.str("service")))?.getCharacteristic(UUID.fromString(a.str("characteristic")))
                    ?: return r.err("service/characteristic tidak ditemukan")
                c.enqueue {
                    c.pending = r
                    val started: Boolean = when (cmd) {
                        "read" -> g.readCharacteristic(ch)
                        "write" -> {
                            val v = data(a)
                            val type = if (a.optBoolean("withoutResponse")) BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE else BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                            if (Build.VERSION.SDK_INT >= 33) g.writeCharacteristic(ch, v, type) == BluetoothGatt.GATT_SUCCESS
                            else { @Suppress("DEPRECATION") run { ch.writeType = type; ch.value = v; g.writeCharacteristic(ch) } }
                        }
                        else -> {
                            val on = a.optBoolean("enable", true)
                            g.setCharacteristicNotification(ch, on)
                            val d = ch.getDescriptor(CCCD)
                            if (d == null) { r.ok(); c.done(); return@enqueue }
                            val v = if (!on) BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE
                                else if (ch.properties and BluetoothGattCharacteristic.PROPERTY_INDICATE != 0) BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
                                else BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                            if (Build.VERSION.SDK_INT >= 33) g.writeDescriptor(d, v) == BluetoothGatt.GATT_SUCCESS
                            else { @Suppress("DEPRECATION") run { d.value = v; g.writeDescriptor(d) } }
                        }
                    }
                    if (!started) { r.err("operasi BLE gagal dimulai"); c.done() }
                }
            }
            else -> r.err("unknown ble.$cmd")
        }
    }

    override fun onDestroy() {
        scanCb?.let { cb -> runCatching { adapter?.bluetoothLeScanner?.stopScan(cb) } }
        gatts.values.forEach { c -> c.gatt?.let { runCatching { it.disconnect(); it.close() } } }
        gatts.clear()
        sockets.values.forEach { runCatching { it.close() } }
    }

    companion object {
        val SPP: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
        val CCCD: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
    }
}
