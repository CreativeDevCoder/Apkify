package app.apkify.shell

import org.json.JSONObject

/** Potongan JavaScript yang disuntikkan ke halaman. */
object Scripts {
    fun apiShim(cfg: AppConfig): String = """
        (function(){
          if (window.Apkify) return;
          var B = window.ApkifyBridge;
          window.APKIFY = ${cfg.publicJson()};
          if (B && ${cfg.jsApi}) {
            window.Apkify = {
              toast: function(m){ B.toast(String(m)); },
              vibrate: function(ms){ B.vibrate((ms|0) || 50); },
              share: function(t){ B.share(String(t)); },
              copy: function(t){ B.copy(String(t)); },
              open: function(u){ B.openExternal(String(u)); },
              keepScreenOn: function(on){ B.keepScreenOn(!!on); },
              exit: function(){ B.exit(); },
              device: function(){ return JSON.parse(B.deviceInfo()); },
              app: function(){ return JSON.parse(B.appInfo()); }
            };
          }
          document.addEventListener('DOMContentLoaded', function(){ document.dispatchEvent(new Event('apkifyready')); });
        })();
    """.trimIndent()

    const val NO_SELECT = """
        (function(){ var s=document.createElement('style');
          s.textContent='*:not(input):not(textarea){-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}';
          (document.head||document.documentElement).appendChild(s); })();
    """

    fun tawk(propertyId: String, widgetId: String): String {
        val src = JSONObject.quote("https://embed.tawk.to/$propertyId/$widgetId")
        return """
            (function(){ if (window.Tawk_API || document.getElementById('apkify-tawk')) return;
              window.Tawk_API = window.Tawk_API || {}; window.Tawk_LoadStart = new Date();
              var s=document.createElement('script'); s.id='apkify-tawk'; s.async=true; s.src=$src; s.charset='UTF-8'; s.setAttribute('crossorigin','*');
              (document.head||document.documentElement).appendChild(s); })();
        """.trimIndent()
    }
}
