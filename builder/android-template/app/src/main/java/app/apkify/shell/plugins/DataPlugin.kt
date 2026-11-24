package app.apkify.shell

import android.Manifest
import android.app.Activity
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.net.Uri
import android.provider.CalendarContract
import android.provider.ContactsContract
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.documentfile.provider.DocumentFile
import org.json.JSONArray
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Data & sistem: kontak, kalender, telepon/SMS, kamera native (foto/video), pilih berkas,
 * bagikan berkas, buka berkas dengan aplikasi lain, akses folder pilihan pengguna (SAF),
 * penyimpanan terenkripsi (Android Keystore) dan SQLite native.
 */
class DataPlugin(host: MainActivity) : Plugin(host) {
    override val prefixes = setOf("contacts", "calendar", "phone", "sms", "camera", "files", "share", "fs", "secure", "db")
    override fun enabled(prefix: String) = when (prefix) {
        "contacts" -> cfg.on("contacts")
        "calendar" -> cfg.on("calendar")
        "phone" -> cfg.on("phoneCall")
        "sms" -> cfg.on("phoneCall") || cfg.on("smsOtp")
        "camera" -> cfg.on("nativeCamera")
        "files", "share" -> cfg.on("shareFiles")
        "fs" -> cfg.on("fileSystem")
        "secure" -> cfg.on("secureStorage")
        "db" -> cfg.on("sqlite")
        else -> false
    }

    override fun handle(prefix: String, cmd: String, a: JSONObject, r: Reply) {
        when (prefix) {
            "contacts" -> contacts(cmd, a, r)
            "calendar" -> calendar(a, r)
            "phone" -> phone(a, r)
            "sms" -> if (cmd == "otp") host.plugins.handle("play.smsOtp", a, r) else sms(a, r)
            "camera" -> camera(cmd, a, r)
            "files" -> files(cmd, a, r)
            "share" -> share(a, r)
            "fs" -> fs(cmd, a, r)
            "secure" -> secure(cmd, a, r)
            "db" -> db(cmd, a, r)
        }
    }

    // ---------------- Kontak ----------------
    private fun contacts(cmd: String, a: JSONObject, r: Reply) {
        when (cmd) {
            // pemilih kontak sistem: tidak perlu izin READ_CONTACTS
            "pick" -> host.startForResult(Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI)) { code, data ->
                val uri = data?.data
                if (code != Activity.RESULT_OK || uri == null) return@startForResult r.err("cancelled")
                host.contentResolver.query(uri, arrayOf(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER), null, null, null)?.use { c ->
                    if (c.moveToFirst()) r.ok(JSONObject().put("name", c.getString(0) ?: "").put("phone", c.getString(1) ?: "")) else r.err("kontak kosong")
                } ?: r.err("kontak tidak terbaca")
            }
            "list" -> {
                if (!cfg.on("contactsRead")) return r.err("aktifkan fitur 'Baca semua kontak'")
                host.requestPerms(listOf(Manifest.permission.READ_CONTACTS)) { ok ->
                    if (!ok) return@requestPerms r.err("izin kontak ditolak")
                    r.bg {
                        val q = a.str("query")
                        val out = LinkedHashMap<String, JSONObject>()
                        host.contentResolver.query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                            arrayOf(ContactsContract.CommonDataKinds.Phone.CONTACT_ID, ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER),
                            if (q.isNotEmpty()) "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ?" else null, if (q.isNotEmpty()) arrayOf("%$q%") else null,
                            "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC")?.use { c ->
                            while (c.moveToNext() && out.size < a.optInt("limit", 2000)) {
                                val id = c.getString(0)
                                val o = out.getOrPut(id) { JSONObject().put("id", id).put("name", c.getString(1) ?: "").put("phones", JSONArray()) }
                                o.getJSONArray("phones").put(c.getString(2) ?: "")
                            }
                        }
                        r.ok("contacts", JSONArray(out.values))
                    }
                }
            }
            else -> r.err("unknown contacts.$cmd")
        }
    }

    // ---------------- Kalender (lewat aplikasi kalender, tanpa izin) ----------------
    private fun calendar(a: JSONObject, r: Reply) {
        val i = Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI)
            .putExtra(CalendarContract.Events.TITLE, a.str("title"))
            .putExtra(CalendarContract.Events.DESCRIPTION, a.str("description"))
            .putExtra(CalendarContract.Events.EVENT_LOCATION, a.str("location"))
            .putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, a.optBoolean("allDay"))
        if (a.has("start")) i.putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, a.optLong("start"))
        if (a.has("end")) i.putExtra(CalendarContract.EXTRA_EVENT_END_TIME, a.optLong("end"))
        if (a.str("email").isNotEmpty()) i.putExtra(Intent.EXTRA_EMAIL, a.str("email"))
        runCatching { host.startActivity(i) }.onSuccess { r.ok() }.onFailure { r.err("aplikasi kalender tidak ada") }
    }

    // ---------------- Telepon & SMS ----------------
    private fun phone(a: JSONObject, r: Reply) {
        val num = a.str("number").replace(Regex("[^0-9+*#]"), "")
        if (num.isEmpty()) return r.err("nomor kosong")
        if (a.optBoolean("direct") && cfg.on("directCall")) {
            host.requestPerms(listOf(Manifest.permission.CALL_PHONE)) { ok ->
                if (ok) runCatching { host.startActivity(Intent(Intent.ACTION_CALL, Uri.parse("tel:" + Uri.encode(num)))) }.onSuccess { r.ok() }.onFailure { r.err(it.message ?: "gagal") }
                else r.err("izin telepon ditolak")
            }
        } else runCatching { host.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(num)))) }.onSuccess { r.ok() }.onFailure { r.err("tidak ada aplikasi telepon") }
    }

    private fun sms(a: JSONObject, r: Reply) {
        val i = Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(a.str("number")))).putExtra("sms_body", a.str("body"))
        runCatching { host.startActivity(i) }.onSuccess { r.ok() }.onFailure { r.err("tidak ada aplikasi SMS") }
    }

    // ---------------- Kamera native ----------------
    private fun camera(cmd: String, a: JSONObject, r: Reply) {
        val video = cmd == "video"
        val go = {
            val f = AppFiles.newFile(host, if (video) "mp4" else "jpg")
            val uri = AppFiles.uri(host, f)
            val i = Intent(if (video) MediaStore.ACTION_VIDEO_CAPTURE else MediaStore.ACTION_IMAGE_CAPTURE)
                .putExtra(MediaStore.EXTRA_OUTPUT, uri).addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            if (video && a.has("maxSeconds")) i.putExtra(MediaStore.EXTRA_DURATION_LIMIT, a.optInt("maxSeconds"))
            if (a.str("facing") == "front") i.putExtra("android.intent.extras.CAMERA_FACING", 1).putExtra("android.intent.extras.LENS_FACING_FRONT", 1).putExtra("android.intent.extra.USE_FRONT_CAMERA", true)
            host.startForResult(i) { code, _ ->
                if (code != Activity.RESULT_OK || f.length() == 0L) { f.delete(); return@startForResult r.err("cancelled") }
                r.bg {
                    if (!video) Images.shrink(f, a.optInt("maxWidth", 0), a.optInt("quality", 85))
                    val out = AppFiles.describe(f, if (video) "video/mp4" else "image/jpeg", a.optBoolean("base64"))
                    if (a.optBoolean("saveToGallery")) runCatching { out.put("gallery", MediaPlugin.saveToGallery(host, f, "", cfg.name)) }
                    r.ok(out)
                }
            }
        }
        // bila manifest mendeklarasikan CAMERA, intent kamera mewajibkan izin itu diberikan
        if (host.declares(Manifest.permission.CAMERA)) host.requestPerms(listOf(Manifest.permission.CAMERA)) { ok -> if (ok) go() else r.err("izin kamera ditolak") } else go()
    }

    // ---------------- Pilih / buka berkas ----------------
    private fun name(uri: Uri): String = runCatching {
        host.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c -> if (c.moveToFirst()) c.getString(0) else null }
    }.getOrNull() ?: uri.lastPathSegment ?: "file"

    private fun files(cmd: String, a: JSONObject, r: Reply) {
        when (cmd) {
            "pick" -> {
                val i = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(a.str("mime", "*/*"))
                    .putExtra(Intent.EXTRA_ALLOW_MULTIPLE, a.optBoolean("multiple"))
                a.optJSONArray("types")?.let { i.putExtra(Intent.EXTRA_MIME_TYPES, it.strings().toTypedArray()) }
                host.startForResult(i) { code, data ->
                    if (code != Activity.RESULT_OK || data == null) return@startForResult r.err("cancelled")
                    val uris = data.clipData?.let { c -> (0 until c.itemCount).map { c.getItemAt(it).uri } } ?: listOfNotNull(data.data)
                    r.bg {
                        r.ok("files", JSONArray(uris.map { u ->
                            val n = name(u)
                            val f = AppFiles.newFile(host, n.substringAfterLast('.', "bin"))
                            host.contentResolver.openInputStream(u)!!.use { i2 -> f.outputStream().use { i2.copyTo(it) } }
                            AppFiles.describe(f, host.contentResolver.getType(u) ?: EncryptedAssets.mimeOf(n), a.optBoolean("base64")).put("name", n).put("uri", u.toString())
                        }))
                    }
                }
            }
            "open" -> r.bg {
                val f = AppFiles.resolve(host, a)
                val mime = a.str("mime").ifBlank { EncryptedAssets.mimeOf(a.str("name").ifBlank { f.name }) }
                ui {
                    runCatching {
                        host.startActivity(Intent.createChooser(Intent(Intent.ACTION_VIEW).setDataAndType(AppFiles.uri(host, f), mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION), a.str("title").ifBlank { null }))
                    }.onSuccess { r.ok() }.onFailure { r.err("tidak ada aplikasi untuk membuka berkas ini") }
                }
            }
            else -> r.err("unknown files.$cmd")
        }
    }

    private fun share(a: JSONObject, r: Reply) = r.bg {
        val list = a.optJSONArray("files") ?: if (a.has("url") || a.has("base64")) JSONArray().put(a) else JSONArray()
        val uris = ArrayList<Uri>()
        var mime = ""
        for (i in 0 until list.length()) {
            val o = list.getJSONObject(i)
            val f = AppFiles.resolve(host, o)
            val named = o.str("name").takeIf { it.isNotBlank() }?.let { n -> java.io.File(f.parentFile, "${f.nameWithoutExtension}_${n.replace(Regex("[^\\w.\\- ]"), "_")}").also { f.renameTo(it) } } ?: f
            uris += AppFiles.uri(host, named)
            val m = o.str("mime").ifBlank { EncryptedAssets.mimeOf(named.name) }
            mime = if (mime.isEmpty() || mime == m) m else if (mime.substringBefore('/') == m.substringBefore('/')) mime.substringBefore('/') + "/*" else "*/*"
        }
        val i = if (uris.size > 1) Intent(Intent.ACTION_SEND_MULTIPLE).putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
            else Intent(Intent.ACTION_SEND).apply { uris.firstOrNull()?.let { putExtra(Intent.EXTRA_STREAM, it) } }
        i.type = if (uris.isEmpty()) "text/plain" else mime
        a.str("text").takeIf { it.isNotEmpty() }?.let { i.putExtra(Intent.EXTRA_TEXT, it) }
        a.str("subject").takeIf { it.isNotEmpty() }?.let { i.putExtra(Intent.EXTRA_SUBJECT, it) }
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        a.str("package").takeIf { it.isNotEmpty() }?.let { i.setPackage(it) }
        ui {
            runCatching { host.startActivity(if (i.`package` != null) i else Intent.createChooser(i, a.str("title").ifBlank { null })) }
                .onSuccess { r.ok() }.onFailure { r.err("aplikasi tujuan tidak tersedia") }
        }
    }

    // ---------------- Folder pilihan pengguna (Storage Access Framework) ----------------
    private fun doc(uri: String): DocumentFile? {
        val u = Uri.parse(uri)
        return if (DocumentsContract.isTreeUri(u)) DocumentFile.fromTreeUri(host, u) else DocumentFile.fromSingleUri(host, u)
    }

    private fun docJson(d: DocumentFile) = JSONObject().put("uri", d.uri.toString()).put("name", d.name ?: "").put("isDirectory", d.isDirectory)
        .put("size", d.length()).put("mime", d.type ?: "").put("modified", d.lastModified())

    private fun fs(cmd: String, a: JSONObject, r: Reply) {
        when (cmd) {
            // pengguna memilih folder (mis. Download/Struk) -> izin baca/tulis permanen
            "pickDirectory" -> {
                val i = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
                a.str("initial").takeIf { it.isNotEmpty() && android.os.Build.VERSION.SDK_INT >= 26 }?.let { i.putExtra(DocumentsContract.EXTRA_INITIAL_URI, Uri.parse(it)) }
                host.startForResult(i) { code, data ->
                    val u = data?.data
                    if (code != Activity.RESULT_OK || u == null) return@startForResult r.err("cancelled")
                    host.contentResolver.takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                    val d = DocumentFile.fromTreeUri(host, u)
                    r.ok(JSONObject().put("uri", u.toString()).put("name", d?.name ?: ""))
                }
            }
            "directories" -> r.ok("directories", JSONArray(host.contentResolver.persistedUriPermissions.map { JSONObject().put("uri", it.uri.toString()).put("write", it.isWritePermission).put("name", DocumentFile.fromTreeUri(host, it.uri)?.name ?: "") }))
            "release" -> { runCatching { host.contentResolver.releasePersistableUriPermission(Uri.parse(a.str("uri")), Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION) }; r.ok() }
            "list" -> r.bg {
                val d = doc(a.str("uri", a.str("dir"))) ?: throw IllegalStateException("folder tidak valid")
                r.ok("files", JSONArray(d.listFiles().map { docJson(it) }))
            }
            "stat" -> r.bg { r.ok(docJson(doc(a.str("uri"))?.takeIf { it.exists() } ?: throw IllegalStateException("tidak ditemukan"))) }
            "read" -> r.bg {
                val bytes = host.contentResolver.openInputStream(Uri.parse(a.str("uri")))!!.use { it.readBytes() }
                r.ok("data", if (a.str("encoding", "utf8") == "base64") Base64.encodeToString(bytes, Base64.NO_WRAP) else String(bytes, Charsets.UTF_8))
            }
            "write" -> r.bg {
                val bytes = if (a.str("encoding", "utf8") == "base64") Base64.decode(a.str("data"), Base64.DEFAULT) else a.str("data").toByteArray()
                val target: Uri = if (a.has("dir")) {
                    val dir = doc(a.str("dir")) ?: throw IllegalStateException("folder tidak valid")
                    val name = a.str("name").ifBlank { throw IllegalArgumentException("name wajib") }
                    (dir.findFile(name) ?: dir.createFile(a.str("mime").ifBlank { EncryptedAssets.mimeOf(name) }, name) ?: throw IllegalStateException("gagal membuat berkas")).uri
                } else Uri.parse(a.str("uri"))
                host.contentResolver.openOutputStream(target, if (a.optBoolean("append")) "wa" else "wt")!!.use { it.write(bytes) }
                r.ok("uri", target.toString())
            }
            "copy" -> r.bg {
                val src = AppFiles.resolve(host, a.optJSONObject("from") ?: JSONObject().put("url", a.str("url")))
                val dir = doc(a.str("dir")) ?: throw IllegalStateException("folder tidak valid")
                val name = a.str("name").ifBlank { src.name }
                val f = dir.findFile(name) ?: dir.createFile(a.str("mime").ifBlank { EncryptedAssets.mimeOf(name) }, name) ?: throw IllegalStateException("gagal membuat berkas")
                host.contentResolver.openOutputStream(f.uri, "wt")!!.use { o -> src.inputStream().use { it.copyTo(o) } }
                r.ok("uri", f.uri.toString())
            }
            "mkdir" -> r.bg {
                val dir = doc(a.str("dir")) ?: throw IllegalStateException("folder tidak valid")
                val n = a.str("name")
                r.ok("uri", (dir.findFile(n) ?: dir.createDirectory(n) ?: throw IllegalStateException("gagal")).uri.toString())
            }
            "delete" -> r.bg { r.ok("deleted", doc(a.str("uri"))?.delete() == true) }
            // simpan satu berkas ke lokasi pilihan pengguna (dialog "Simpan sebagai")
            "saveAs" -> {
                val name = a.str("name", "file")
                val i = Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(a.str("mime").ifBlank { EncryptedAssets.mimeOf(name) }).putExtra(Intent.EXTRA_TITLE, name)
                host.startForResult(i) { code, data ->
                    val u = data?.data
                    if (code != Activity.RESULT_OK || u == null) return@startForResult r.err("cancelled")
                    r.bg {
                        host.contentResolver.openOutputStream(u, "wt")!!.use { o ->
                            if (a.has("data")) o.write(if (a.str("encoding", "utf8") == "base64") Base64.decode(a.str("data"), Base64.DEFAULT) else a.str("data").toByteArray())
                            else AppFiles.resolve(host, a).inputStream().use { it.copyTo(o) }
                        }
                        r.ok("uri", u.toString())
                    }
                }
            }
            else -> r.err("unknown fs.$cmd")
        }
    }

    // ---------------- Penyimpanan terenkripsi (AES-GCM, kunci di Android Keystore) ----------------
    private val securePrefs by lazy { host.getSharedPreferences("apkify_secure", Context.MODE_PRIVATE) }

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        g.init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build())
        return g.generateKey()
    }

    private fun secure(cmd: String, a: JSONObject, r: Reply) {
        val k = a.str("key").take(200)
        when (cmd) {
            "set" -> {
                val c = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
                val ct = c.doFinal(a.str("value").toByteArray())
                securePrefs.edit().putString(k, Base64.encodeToString(c.iv + ct, Base64.NO_WRAP)).apply()
                r.ok()
            }
            "get" -> {
                val raw = securePrefs.getString(k, null) ?: return r.ok("value", null)
                val b = Base64.decode(raw, Base64.DEFAULT)
                val c = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, b, 0, 12)) }
                r.ok("value", String(c.doFinal(b, 12, b.size - 12)))
            }
            "remove" -> { securePrefs.edit().remove(k).apply(); r.ok() }
            "keys" -> r.ok("keys", JSONArray(securePrefs.all.keys.toList()))
            "clear" -> { securePrefs.edit().clear().apply(); r.ok() }
            else -> r.err("unknown secure.$cmd")
        }
    }

    // ---------------- SQLite native ----------------
    private val dbs = HashMap<String, SQLiteDatabase>()

    private fun open(name: String): SQLiteDatabase {
        val n = name.replace(Regex("[^\\w.-]"), "_").ifBlank { "app" }.let { if (it.endsWith(".db")) it else "$it.db" }
        return synchronized(dbs) { dbs.getOrPut(n) { host.openOrCreateDatabase(n, Context.MODE_PRIVATE, null) } }
    }

    private fun args(arr: JSONArray?): Array<Any?> = arr?.let { a -> Array(a.length()) { i -> a.opt(i).let { v -> if (v == JSONObject.NULL) null else v } } } ?: emptyArray()

    private fun rows(c: Cursor): JSONArray {
        val out = JSONArray()
        while (c.moveToNext()) {
            val o = JSONObject()
            for (i in 0 until c.columnCount) o.put(c.getColumnName(i), when (c.getType(i)) {
                Cursor.FIELD_TYPE_NULL -> JSONObject.NULL
                Cursor.FIELD_TYPE_INTEGER -> c.getLong(i)
                Cursor.FIELD_TYPE_FLOAT -> c.getDouble(i)
                Cursor.FIELD_TYPE_BLOB -> Base64.encodeToString(c.getBlob(i), Base64.NO_WRAP)
                else -> c.getString(i)
            })
            out.put(o)
        }
        return out
    }

    private fun exec(d: SQLiteDatabase, sql: String, params: JSONArray?): JSONObject {
        val s = sql.trimStart().lowercase()
        return if (s.startsWith("select") || s.startsWith("pragma") || s.startsWith("with") || s.contains(" returning ")) {
            val p = args(params).map { it?.toString() }.toTypedArray()
            d.rawQuery(sql, p).use { JSONObject().put("rows", rows(it)) }
        } else {
            d.execSQL(sql, args(params))
            val changes = d.rawQuery("SELECT changes(), last_insert_rowid()", null).use { c -> c.moveToFirst(); c.getLong(0) to c.getLong(1) }
            JSONObject().put("rows", JSONArray()).put("changes", changes.first).put("lastInsertId", changes.second)
        }
    }

    private fun db(cmd: String, a: JSONObject, r: Reply) = r.bg {
        val d = open(a.str("name", "app"))
        when (cmd) {
            "query", "exec", "run" -> r.ok(exec(d, a.str("sql"), a.optJSONArray("params")))
            "batch" -> {
                val list = a.optJSONArray("statements") ?: JSONArray()
                val res = JSONArray()
                d.beginTransaction()
                try {
                    for (i in 0 until list.length()) list.get(i).let { st ->
                        if (st is JSONObject) res.put(exec(d, st.str("sql"), st.optJSONArray("params"))) else res.put(exec(d, st.toString(), null))
                    }
                    d.setTransactionSuccessful()
                } finally { d.endTransaction() }
                r.ok("results", res)
            }
            "close" -> { synchronized(dbs) { dbs.values.forEach { it.close() }; dbs.clear() }; r.ok() }
            "delete" -> { synchronized(dbs) { dbs.values.forEach { it.close() }; dbs.clear() }; r.ok("deleted", host.deleteDatabase(a.str("name", "app").let { if (it.endsWith(".db")) it else "$it.db" })) }
            else -> r.err("unknown db.$cmd")
        }
    }

    override fun onDestroy() { synchronized(dbs) { dbs.values.forEach { runCatching { it.close() } }; dbs.clear() } }

    companion object { private const val ALIAS = "apkify_secure_v1" }
}

/** Utilitas gambar */
object Images {
    /** kecilkan foto (lebar maks) & kompres ulang JPEG, ikuti orientasi EXIF */
    fun shrink(f: java.io.File, maxWidth: Int, quality: Int) {
        if (maxWidth <= 0 && quality >= 95) return
        val opts = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
        android.graphics.BitmapFactory.decodeFile(f.absolutePath, opts)
        var sample = 1
        if (maxWidth > 0) while (opts.outWidth / (sample * 2) >= maxWidth) sample *= 2
        var bmp = android.graphics.BitmapFactory.decodeFile(f.absolutePath, android.graphics.BitmapFactory.Options().apply { inSampleSize = sample }) ?: return
        val rot = runCatching {
            when (androidx.exifinterface.media.ExifInterface(f.absolutePath).getAttributeInt(androidx.exifinterface.media.ExifInterface.TAG_ORIENTATION, 1)) {
                6 -> 90f; 3 -> 180f; 8 -> 270f; else -> 0f
            }
        }.getOrDefault(0f)
        if (maxWidth in 1 until bmp.width || rot != 0f) {
            val scale = if (maxWidth in 1 until bmp.width) maxWidth.toFloat() / bmp.width else 1f
            val m = android.graphics.Matrix().apply { postScale(scale, scale); postRotate(rot) }
            bmp = android.graphics.Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true)
        }
        f.outputStream().use { bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, quality.coerceIn(30, 100), it) }
    }
}
