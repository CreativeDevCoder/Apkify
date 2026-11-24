package app.apkify.shell

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import android.widget.RemoteViews
import androidx.annotation.RequiresApi
import org.json.JSONObject

/** Widget layar utama: judul + teks (diperbarui dari halaman lewat Apkify.widget.update), ketuk -> buka URL. */
class AppWidget : AppWidgetProvider() {
    override fun onUpdate(c: Context, m: AppWidgetManager, ids: IntArray) = ids.forEach { m.updateAppWidget(it, views(c)) }

    companion object {
        private fun data(c: Context): JSONObject {
            val cfg = AppConfig.get(c)
            val base = cfg.section("widget")
            val dyn = UiPlugin.prefs(c).getString("widget", null)?.let { runCatching { JSONObject(it) }.getOrNull() } ?: JSONObject()
            return JSONObject().put("title", dyn.str("title", base.str("title", cfg.name))).put("text", dyn.str("text", base.str("text")))
                .put("url", dyn.str("url", base.str("url")))
        }

        fun views(c: Context): RemoteViews {
            val d = data(c)
            val v = RemoteViews(c.packageName, R.layout.widget)
            v.setTextViewText(R.id.widgetTitle, d.optString("title"))
            v.setTextViewText(R.id.widgetText, d.optString("text"))
            v.setOnClickPendingIntent(R.id.widgetRoot, Notifier.openIntent(c, d.optString("url"), 880001))
            return v
        }

        fun refresh(c: Context) {
            val m = AppWidgetManager.getInstance(c)
            val ids = m.getAppWidgetIds(ComponentName(c, AppWidget::class.java))
            if (ids.isNotEmpty()) m.updateAppWidget(ids, views(c))
        }
    }
}

/** Tombol di Quick Settings (tarik panel notifikasi) untuk membuka halaman tertentu. */
@RequiresApi(24)
class QsTile : TileService() {
    private fun data(): JSONObject {
        val cfg = AppConfig.get(this)
        val base = cfg.section("tile")
        val dyn = UiPlugin.prefs(this).getString("tile", null)?.let { runCatching { JSONObject(it) }.getOrNull() } ?: JSONObject()
        return JSONObject().put("label", dyn.str("label", base.str("label", cfg.name))).put("url", dyn.str("url", base.str("url")))
            .put("active", dyn.optBoolean("active", false))
    }

    override fun onStartListening() {
        val t = qsTile ?: return
        val d = data()
        t.label = d.optString("label")
        t.state = if (d.optBoolean("active")) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
        t.updateTile()
    }

    override fun onClick() {
        val url = data().optString("url")
        val i = Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (url.isNotBlank()) { i.action = Intent.ACTION_VIEW; i.data = Uri.parse(AppConfig.get(this).resolve(url)) }
        if (Build.VERSION.SDK_INT >= 34) startActivityAndCollapse(PendingIntent.getActivity(this, 0, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
        else @Suppress("DEPRECATION") startActivityAndCollapse(i)
    }

    companion object {
        fun refresh(c: Context) { if (Build.VERSION.SDK_INT >= 24) runCatching { requestListeningState(c, ComponentName(c, QsTile::class.java)) } }
    }
}
