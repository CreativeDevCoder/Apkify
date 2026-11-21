package app.apkify.shell

import android.app.Application
import com.onesignal.OneSignal
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

object Push {
    fun init(app: Application, appId: String) {
        OneSignal.initWithContext(app, appId)
    }

    fun requestPermission() {
        CoroutineScope(Dispatchers.IO).launch {
            runCatching { OneSignal.Notifications.requestPermission(true) }
        }
    }
}
