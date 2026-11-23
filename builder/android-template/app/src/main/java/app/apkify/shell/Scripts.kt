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
          if (B) {
            var cbs = {}, n = 0;
            window.__apkifyCb = function(id, res){ var c = cbs[id]; delete cbs[id]; if (c) c(res); };
            var call = function(cmd, args){ return new Promise(function(r){ var id = 'c' + (++n); cbs[id] = r; B.call(cmd, JSON.stringify(args || {}), id); }); };
            var A = window.Apkify = window.Apkify || {};
            A.scanQR = function(){ return call('scanQR'); };
            A.biometric = function(reason){ return call('biometric', { reason: reason }); };
            A.requestReview = function(){ return call('review'); };
            A.getPushToken = function(){ return call('pushToken'); };
            A.iap = {
              products: function(ids, type){ return call('iap.products', { ids: ids, type: type || 'inapp' }); },
              purchase: function(id, type){ return call('iap.purchase', { id: id, type: type || 'inapp' }); },
              restore: function(type){ return call('iap.restore', { type: type || 'inapp' }); },
              acknowledge: function(token){ return call('iap.acknowledge', { token: token }); },
              consume: function(token){ return call('iap.consume', { token: token }); }
            };
            A.storage = {
              get: function(k){ return B.storageGet(String(k)); },
              set: function(k, v){ B.storageSet(String(k), String(v)); },
              remove: function(k){ B.storageRemove(String(k)); },
              keys: function(){ return JSON.parse(B.storageKeys()); }
            };
            A.platform = 'android';
          }
          document.addEventListener('DOMContentLoaded', function(){ document.dispatchEvent(new Event('apkifyready')); });
        })();
    """.trimIndent()

    fun custom(cfg: AppConfig): String {
        val css = JSONObject.quote(cfg.customCss)
        return "(function(){ if (window.__apkifyCustom) return; window.__apkifyCustom = 1; " +
            "if ($css) { var s=document.createElement('style'); s.textContent=$css; (document.head||document.documentElement).appendChild(s); } " +
            "try { ${cfg.customJs} } catch(e) { console.error(e); } })();"
    }

    fun shareEvent(text: String): String =
        "document.dispatchEvent(new CustomEvent('apkifyshare', { detail: { text: ${JSONObject.quote(text)} } }));"

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
