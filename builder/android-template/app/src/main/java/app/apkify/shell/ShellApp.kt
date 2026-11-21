package app.apkify.shell

import android.app.Application

class ShellApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val cfg = AppConfig.get(this)
        if (cfg.onesignal && cfg.onesignalAppId.isNotBlank()) Push.init(this, cfg.onesignalAppId)
    }
}
