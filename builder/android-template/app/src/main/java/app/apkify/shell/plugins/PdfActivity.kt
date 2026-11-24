package app.apkify.shell

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import java.io.File

/** Penampil PDF native (PdfRenderer) — tanpa aplikasi pihak ketiga. */
class PdfActivity : AppCompatActivity() {
    private var renderer: PdfRenderer? = null
    private var fd: ParcelFileDescriptor? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        setTheme(androidx.appcompat.R.style.Theme_AppCompat_DayNight_DarkActionBar)
        super.onCreate(savedInstanceState)
        title = intent.getStringExtra("title")?.ifBlank { null } ?: AppConfig.get(this).name
        val f = File(intent.getStringExtra("path") ?: "")
        try {
            fd = ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY)
            renderer = PdfRenderer(fd!!)
        } catch (e: Exception) {
            Toast.makeText(this, "PDF tidak bisa dibuka", Toast.LENGTH_SHORT).show(); finish(); return
        }
        val list = RecyclerView(this)
        list.setBackgroundColor(Color.parseColor("#525659"))
        list.layoutManager = LinearLayoutManager(this)
        val width = resources.displayMetrics.widthPixels
        list.adapter = object : RecyclerView.Adapter<RecyclerView.ViewHolder>() {
            override fun getItemCount() = renderer?.pageCount ?: 0
            override fun onCreateViewHolder(p: ViewGroup, t: Int) = object : RecyclerView.ViewHolder(ImageView(this@PdfActivity).apply {
                layoutParams = RecyclerView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = 12 }
                adjustViewBounds = true; setBackgroundColor(Color.WHITE)
            }) {}
            override fun onBindViewHolder(h: RecyclerView.ViewHolder, pos: Int) {
                val r = renderer ?: return
                synchronized(r) {
                    r.openPage(pos).use { page ->
                        val bmp = Bitmap.createBitmap(width, (width.toFloat() / page.width * page.height).toInt().coerceAtLeast(1), Bitmap.Config.ARGB_8888)
                        bmp.eraseColor(Color.WHITE)
                        page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        (h.itemView as ImageView).setImageBitmap(bmp)
                    }
                }
            }
        }
        setContentView(list)
    }

    override fun onDestroy() { renderer?.close(); fd?.close(); super.onDestroy() }
}
