package app.apkify.shell

import org.json.JSONObject

/** Potongan JavaScript yang disuntikkan ke halaman. */
object Scripts {
    /**
     * window.Apkify: API dasar (sinkron) + plugin native asinkron (Promise) + event.
     * Semua plugin dipanggil lewat Apkify.call('prefix.aksi', args) atau namespace, mis. Apkify.nfc.read().
     */
    fun apiShim(cfg: AppConfig, features: org.json.JSONArray = org.json.JSONArray()): String = """
        (function(){
          if (window.Apkify && window.Apkify.__v) return;
          var B = window.ApkifyBridge;
          window.APKIFY = ${cfg.publicJson()};
          var A = window.Apkify = window.Apkify || {};
          A.__v = 5;
          A.platform = 'android';
          A.features = $features;
          A.has = function(f){ return A.features.indexOf(f) >= 0; };
          if (B && ${cfg.jsApi}) {
            A.toast = function(m){ B.toast(String(m)); };
            A.vibrate = function(ms){ if (Array.isArray(ms)) return A.call('device.vibrate', { pattern: ms }); B.vibrate((ms|0) || 50); };
            A.share = function(t){ B.share(String(t)); };
            A.copy = function(t){ B.copy(String(t)); };
            A.open = function(u){ B.openExternal(String(u)); };
            A.keepScreenOn = function(on){ B.keepScreenOn(!!on); };
            A.exit = function(){ B.exit(); };
            A.device = function(){ return JSON.parse(B.deviceInfo()); };
            A.app = function(){ return JSON.parse(B.appInfo()); };
          }
          if (!B) return;
          var cbs = {}, n = 0, ls = {};
          window.__apkifyCb = function(id, res){ var c = cbs[id]; delete cbs[id]; if (c) c(res); };
          window.__apkifyEmit = function(name, data){
            (ls[name] || []).slice().forEach(function(f){ try { f(data); } catch (e) { console.error(e); } });
            document.dispatchEvent(new CustomEvent('apkify:' + name, { detail: data }));
          };
          A.on = function(name, fn){ (ls[name] = ls[name] || []).push(fn); return function(){ A.off(name, fn); }; };
          A.off = function(name, fn){ ls[name] = (ls[name] || []).filter(function(f){ return f !== fn; }); };
          // Promise selalu resolve dengan {ok:true,...} atau {ok:false,error}; pakai A.call.strict untuk reject saat gagal
          var call = A.call = function(cmd, args){ return new Promise(function(r){ var id = 'c' + (++n); cbs[id] = r; B.call(cmd, JSON.stringify(args || {}), id); }); };
          A.call.strict = function(cmd, args){ return call(cmd, args).then(function(r){ if (!r.ok) throw new Error(r.error); return r; }); };
          var ns = function(p, list){ var o = A[p] || {}; list.split(' ').forEach(function(m){ o[m] = function(a){ return call(p + '.' + m, a); }; }); return A[p] = o; };
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
          // ---- Rilis 5: plugin native ----
          ns('device', 'info battery network brightness volume flashlight vibrate haptic security');
          ns('sensor', 'list start stop'); ns('ir', 'available transmit');
          ns('permission', 'check request'); ns('settings', 'open');
          A.settings.open = function(a){ return call('settings.open', typeof a === 'string' ? { type: a } : a); };
          ns('nfc', 'status read watch write stop emulate emulateApdu emulateStop');
          ns('bt', 'status enable paired discover print send close'); ns('ble', 'scan stopScan connect disconnect read write notify');
          ns('usb', 'list requestPermission open write print read close');
          ns('notify', 'requestPermission show schedule cancel cancelAll pending createChannel');
          A.badge = { set: function(n){ return call('badge.set', { count: n|0 }); }, clear: function(){ return call('badge.set', { count: 0 }); } };
          ns('tts', 'speak stop languages'); ns('stt', 'listen'); ns('recorder', 'start stop');
          A.print = function(a){ return call('print.page', a || {}); };
          ns('pdf', 'open'); ns('gallery', 'save'); ns('download', 'start cancel'); ns('pip', 'enter auto'); ns('media', 'start update stop');
          ns('contacts', 'pick list'); ns('calendar', 'add'); ns('phone', 'call'); ns('sms', 'compose otp');
          ns('camera', 'photo video'); ns('files', 'pick open'); A.shareFiles = function(a){ return call('share.files', a); };
          ns('fs', 'pickDirectory directories release list stat read write copy mkdir delete saveAs');
          ns('secure', 'get set remove keys clear'); ns('db', 'query exec run batch close delete');
          ns('update', 'check start complete'); ns('integrity', 'token'); ns('referrer', 'get'); ns('pay', 'open');
          ns('dialog', 'alert confirm prompt actionSheet toast'); ns('picker', 'date time');
          ns('ui', 'statusBar fullscreen orientation theme toolbar refresh');
          ns('icon', 'list set'); ns('widget', 'update'); ns('tile', 'update'); ns('kiosk', 'start stop status'); ns('lock', 'now status');
          ns('mdm', 'config'); ns('scanner', 'start stop trigger');
          ns('ads', 'showInterstitial showRewarded showRewardedInterstitial showAppOpen hideBanner showBanner network');
          ns('docscan', 'start'); ns('ocr', 'recognize'); ns('face', 'detect'); ns('barcode', 'generate');
          ns('location', 'current watch stop distance'); ns('geofence', 'check watch stop'); ns('activity', 'start stop');
          ns('sync', 'register runNow cancel last'); ns('cast', 'load select play pause stop seek status');
          ns('google', 'signIn signOut'); ns('facebook', 'login logout');
          ns('analytics', 'log screen setUserId setUserProperty setEnabled'); ns('crashlytics', 'log recordError setUserId setKey crash');
          if (A.has('print')) window.print = function(){ A.print(); };
          // Utilitas ESC/POS untuk printer thermal: Apkify.escpos().align('center').bold(true).text('TOKO').feed(3).cut().base64()
          A.escpos = function(){
            var b = [], enc = new TextEncoder(), self = {
              raw: function(arr){ b.push.apply(b, arr); return self; },
              init: function(){ return self.raw([27, 64]); },
              text: function(t){ b.push.apply(b, Array.from(enc.encode(String(t) + '\n'))); return self; },
              align: function(a){ return self.raw([27, 97, { left: 0, center: 1, right: 2 }[a] || 0]); },
              bold: function(on){ return self.raw([27, 69, on ? 1 : 0]); },
              size: function(w, h){ return self.raw([29, 33, (((w || 1) - 1) << 4) | ((h || 1) - 1)]); },
              line: function(c, w){ return self.text(new Array((w || 32) + 1).join(c || '-')); },
              feed: function(n){ return self.raw([27, 100, n || 1]); },
              cut: function(){ return self.raw([29, 86, 66, 0]); },
              qr: function(t, s){ var d = Array.from(enc.encode(String(t))), l = d.length + 3;
                return self.raw([29, 40, 107, 4, 0, 49, 65, 50, 0, 29, 40, 107, 3, 0, 49, 67, s || 6, 29, 40, 107, 3, 0, 49, 69, 48, 29, 40, 107, l & 255, l >> 8, 49, 80, 48]).raw(d).raw([29, 40, 107, 3, 0, 49, 81, 48]); },
              bytes: function(){ return b.slice(); },
              base64: function(){ var s = ''; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i] & 255); return btoa(s); }
            };
            return self.init();
          };
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
