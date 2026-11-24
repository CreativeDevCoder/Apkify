package app.apkify.shell.mod

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.util.Base64
import androidx.activity.result.IntentSenderRequest
import app.apkify.shell.AppFiles
import app.apkify.shell.MainActivity
import app.apkify.shell.Plugin
import app.apkify.shell.Reply
import app.apkify.shell.str
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.MultiFormatWriter
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream

/**
 * Visi on-device (ML Kit, tanpa internet): pemindai dokumen (auto-crop, multi-halaman, PDF),
 * OCR teks (KTP, struk, nota), deteksi wajah, dan pembuat gambar QR/barcode (ZXing).
 */
class VisionPlugin(host: MainActivity) : Plugin(host) {
    override val prefixes = setOf("docscan", "ocr", "face", "barcode")
    override fun enabled(prefix: String) = when (prefix) {
        "docscan" -> cfg.on("docScanner"); "ocr" -> cfg.on("ocr"); "face" -> cfg.on("faceDetection"); "barcode" -> cfg.on("qrGenerate"); else -> false
    }

    override fun handle(prefix: String, cmd: String, a: JSONObject, r: Reply) {
        when (prefix) {
            "docscan" -> scan(a, r)
            "ocr" -> r.bg { ocr(a, r) }
            "face" -> r.bg { face(a, r) }
            "barcode" -> r.bg { generate(a, r) }
        }
    }

    private fun bitmap(a: JSONObject): Bitmap {
        val f = AppFiles.resolve(host, a, "jpg")
        return BitmapFactory.decodeFile(f.absolutePath) ?: throw IllegalArgumentException("gambar tidak valid")
    }

    private fun scan(a: JSONObject, r: Reply) {
        val opts = GmsDocumentScannerOptions.Builder()
            .setGalleryImportAllowed(a.optBoolean("gallery", true))
            .setPageLimit(a.optInt("pages", 10).coerceIn(1, 100))
            .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG, GmsDocumentScannerOptions.RESULT_FORMAT_PDF)
            .setScannerMode(when (a.str("mode", "full")) { "base" -> GmsDocumentScannerOptions.SCANNER_MODE_BASE; "filter" -> GmsDocumentScannerOptions.SCANNER_MODE_BASE_WITH_FILTER; else -> GmsDocumentScannerOptions.SCANNER_MODE_FULL })
            .build()
        GmsDocumentScanning.getClient(opts).getStartScanIntent(host)
            .addOnSuccessListener { sender ->
                host.startSenderForResult(IntentSenderRequest.Builder(sender).build()) { code, data ->
                    val res = GmsDocumentScanningResult.fromActivityResultIntent(data)
                    if (code != Activity.RESULT_OK || res == null) return@startSenderForResult r.err("cancelled")
                    r.bg {
                        val pages = JSONArray(res.pages?.map { p ->
                            val f = AppFiles.newFile(host, "jpg")
                            host.contentResolver.openInputStream(p.imageUri)!!.use { i -> f.outputStream().use { i.copyTo(it) } }
                            AppFiles.describe(f, "image/jpeg", a.optBoolean("base64"))
                        } ?: emptyList<JSONObject>())
                        val out = JSONObject().put("pages", pages)
                        res.pdf?.let { pdf ->
                            val f = AppFiles.newFile(host, "pdf")
                            host.contentResolver.openInputStream(pdf.uri)!!.use { i -> f.outputStream().use { i.copyTo(it) } }
                            out.put("pdf", AppFiles.describe(f, "application/pdf", false).put("pageCount", pdf.pageCount))
                        }
                        r.ok(out)
                    }
                }
            }
            .addOnFailureListener { r.err(it.message ?: "pemindai dokumen tidak tersedia") }
    }

    private fun ocr(a: JSONObject, r: Reply) {
        val img = InputImage.fromBitmap(bitmap(a), 0)
        val t = Tasks.await(TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS).process(img))
        r.ok(JSONObject().put("text", t.text).put("blocks", JSONArray(t.textBlocks.map { b ->
            JSONObject().put("text", b.text).put("box", b.boundingBox?.let { JSONArray(listOf(it.left, it.top, it.right, it.bottom)) } ?: JSONObject.NULL)
                .put("lines", JSONArray(b.lines.map { it.text }))
        })))
    }

    private fun face(a: JSONObject, r: Reply) {
        val bmp = bitmap(a)
        val opts = FaceDetectorOptions.Builder().setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
            .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL).setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE).build()
        val faces = Tasks.await(FaceDetection.getClient(opts).process(InputImage.fromBitmap(bmp, 0)))
        r.ok(JSONObject().put("count", faces.size).put("width", bmp.width).put("height", bmp.height).put("faces", JSONArray(faces.map { f ->
            JSONObject().put("box", JSONArray(listOf(f.boundingBox.left, f.boundingBox.top, f.boundingBox.right, f.boundingBox.bottom)))
                .put("smiling", f.smilingProbability ?: JSONObject.NULL).put("leftEyeOpen", f.leftEyeOpenProbability ?: JSONObject.NULL)
                .put("rightEyeOpen", f.rightEyeOpenProbability ?: JSONObject.NULL).put("headYaw", f.headEulerAngleY).put("headRoll", f.headEulerAngleZ)
        })))
    }

    private fun generate(a: JSONObject, r: Reply) {
        val fmt = runCatching { BarcodeFormat.valueOf(a.str("format", "QR_CODE").uppercase()) }.getOrDefault(BarcodeFormat.QR_CODE)
        val size = a.optInt("size", 512).coerceIn(64, 2048)
        val h = if (fmt == BarcodeFormat.QR_CODE || fmt == BarcodeFormat.DATA_MATRIX || fmt == BarcodeFormat.AZTEC) size else a.optInt("height", size / 3)
        val m = MultiFormatWriter().encode(a.str("text", a.str("value")), fmt, size, h, mapOf(EncodeHintType.MARGIN to a.optInt("margin", 1), EncodeHintType.CHARACTER_SET to "UTF-8"))
        val fg = runCatching { Color.parseColor(a.str("color", "#000000")) }.getOrDefault(Color.BLACK)
        val bg = runCatching { Color.parseColor(a.str("background", "#FFFFFF")) }.getOrDefault(Color.WHITE)
        val px = IntArray(m.width * m.height) { i -> if (m.get(i % m.width, i / m.width)) fg else bg }
        val bmp = Bitmap.createBitmap(px, m.width, m.height, Bitmap.Config.ARGB_8888)
        val out = ByteArrayOutputStream(); bmp.compress(Bitmap.CompressFormat.PNG, 100, out)
        val b64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        r.ok(JSONObject().put("dataUrl", "data:image/png;base64,$b64").put("width", m.width).put("height", m.height))
    }
}
