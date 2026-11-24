package app.apkify.shell

import android.content.Intent
import android.content.res.Configuration
import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject
import kotlin.concurrent.thread

/** Balasan satu panggilan JS (Promise di sisi halaman). */
class Reply(private val host: MainActivity, val id: String) {
    @Volatile private var done = false
    fun ok(data: JSONObject = JSONObject()) { if (done) return; done = true; host.jsCallback(id, data.put("ok", true).toString()) }
    fun ok(key: String, value: Any?) = ok(JSONObject().put(key, value ?: JSONObject.NULL))
    fun err(msg: String) { if (done) return; done = true; host.jsCallback(id, JSONObject().put("ok", false).put("error", msg).toString()) }
    /** jalankan pekerjaan berat di thread latar; exception -> err */
    fun bg(block: () -> Unit) { thread(name = "apkify-$id") { try { block() } catch (e: Throwable) { err(e.message ?: e.javaClass.simpleName) } } }
}

/**
 * Plugin native. Perintah JS berbentuk "<prefix>.<aksi>", mis. "nfc.read".
 * Plugin inti ada di source set main; modul opsional (ML Kit, lokasi, iklan, dll.)
 * hanya ikut ter-compile bila fiturnya dipilih dan dimuat lewat refleksi.
 */
abstract class Plugin(val host: MainActivity) {
    val cfg: AppConfig get() = AppConfig.get(host)
    abstract val prefixes: Set<String>
    /** fitur yang harus aktif agar prefix boleh dipakai (null = selalu) */
    open fun enabled(prefix: String): Boolean = true
    abstract fun handle(prefix: String, cmd: String, a: JSONObject, r: Reply)
    open fun onResume() {}
    open fun onPause() {}
    open fun onDestroy() {}
    open fun onNewIntent(intent: Intent) {}
    open fun onConfigurationChanged(c: Configuration) {}
    open fun onPipChanged(inPip: Boolean) {}
    fun emit(event: String, data: Any? = null) = host.emit(event, data)
    val main = Handler(Looper.getMainLooper())
    fun ui(block: () -> Unit) = host.runOnUiThread(block)
}

class Plugins(private val host: MainActivity) {
    private val all = mutableListOf<Plugin>()
    private val byPrefix = HashMap<String, Plugin>()

    init {
        val core = listOf<(MainActivity) -> Plugin>(
            ::DevicePlugin, ::NfcPlugin, ::BluetoothPlugin, ::UsbPlugin, ::NotifyPlugin, ::MediaPlugin,
            ::DataPlugin, ::PlayPlugin, ::UiPlugin, ::AdsPlugin
        )
        core.forEach { add(it(host)) }
        OPTIONAL.forEach { cls ->
            runCatching { Class.forName(cls).getConstructor(MainActivity::class.java).newInstance(host) as Plugin }.getOrNull()?.let { add(it) }
        }
    }

    private fun add(p: Plugin) { all += p; p.prefixes.forEach { byPrefix[it] = p } }

    fun handle(cmd: String, a: JSONObject, r: Reply) {
        val prefix = cmd.substringBefore('.')
        val p = byPrefix[prefix] ?: return r.err("unknown command: $cmd (fitur belum diaktifkan saat build?)")
        if (!p.enabled(prefix)) return r.err("disabled: aktifkan fitur '$prefix' di Apkify lalu build ulang")
        try { p.handle(prefix, cmd.substringAfter('.', ""), a, r) } catch (e: Throwable) { r.err(e.message ?: e.javaClass.simpleName) }
    }

    /** daftar prefix yang tersedia di build ini -> Apkify.features */
    fun available(): JSONArray = JSONArray(byPrefix.filter { it.value.enabled(it.key) }.keys.sorted())

    fun each(block: (Plugin) -> Unit) = all.forEach { runCatching { block(it) } }

    inline fun <reified T : Plugin> get(): T? = list.firstOrNull { it is T } as T?
    val list: List<Plugin> get() = all

    companion object {
        val OPTIONAL = listOf(
            "app.apkify.shell.mod.VisionPlugin", "app.apkify.shell.mod.LocationPlugin", "app.apkify.shell.mod.SyncPlugin",
            "app.apkify.shell.mod.CastPlugin", "app.apkify.shell.mod.GoogleAuthPlugin", "app.apkify.shell.mod.FacebookPlugin",
            "app.apkify.shell.mod.FirebasePlugin"
        )
    }
}

/** Utilitas JSON kecil */
fun JSONObject.str(k: String, d: String = ""): String = if (has(k) && !isNull(k)) optString(k, d) else d
fun JSONArray.strings(): List<String> = (0 until length()).map { optString(it) }
fun jsonOf(vararg pairs: Pair<String, Any?>) = JSONObject().apply { pairs.forEach { (k, v) -> put(k, v ?: JSONObject.NULL) } }
