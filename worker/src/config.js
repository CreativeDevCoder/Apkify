// Validasi & sanitasi konfigurasi aplikasi di sisi server (jangan percaya klien).
import { HttpError } from './util.js';

const PKG = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const RESERVED = new Set(['abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package', 'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'try', 'void', 'volatile', 'while', 'true', 'false', 'null']);
const HEX = /^#[0-9a-fA-F]{6}$/;
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const bool = (v) => v === true;
const hex = (v, d) => (HEX.test(v) ? v.toLowerCase() : d);
function url(v, required = false) {
  const s = str(v, 2000);
  if (!s && !required) return '';
  try {
    const u = new URL(s);
    if (!['http:', 'https:'].includes(u.protocol)) throw 0;
    return u.toString();
  } catch {
    if (required) throw new HttpError(400, 'Alamat website tidak valid');
    return '';
  }
}

// Fitur boolean & nilai default-nya. Default true = aktif bila klien tidak mengirim apa-apa.
export const FEATURE_DEFAULTS = {
  pullToRefresh: true, fileUpload: true, downloads: true, externalLinksInBrowser: true, offlinePage: true,
  geolocation: false, camera: false, microphone: false, notifications: false, vibrate: false,
  zoom: false, zoomButtons: false, scrollbars: true, textSelection: true, saveFormData: true,
  keepAwake: false, fullscreen: false, disallowScreenshot: false, confirmExit: false, popupBlocker: false,
  deepLinking: false, httpsOnly: true, allowFileAccess: false, crossOrigin: false,
  showToolbar: false, liveTitle: false, homeButton: false, sideMenu: false,
  hideWebViewUA: false, hideMobileUA: false, desktopMode: false,
  admob: false, interstitial: false, onesignal: false, tawk: false, jsApi: false, supabase: false,
  remoteUpdate: false, encrypt: true,
  // plugin native (rilis 4)
  bottomNav: false, fab: false, qrScanner: false, biometric: false, inAppReview: false, billing: false,
  nativeStorage: false, shareTarget: false, shortcuts: false, androidTv: false, analytics: false, fcm: false,
  customCode: false, linkRules: false
};

export const NAV_ICONS = ['home', 'search', 'cart', 'user', 'heart', 'bell', 'apps', 'menu', 'info', 'chat', 'star', 'list', 'place', 'phone', 'play', 'qr', 'share', 'up'];
export const PLATFORMS = ['android', 'windows', 'macos', 'linux', 'ios'];

export function sanitizeConfig(c) {
  if (!c || typeof c !== 'object') throw new HttpError(400, 'Konfigurasi kosong');
  const name = str(c.name, 30);
  if (!name) throw new HttpError(400, 'Nama aplikasi wajib diisi');
  const packageName = str(c.packageName, 100).toLowerCase();
  if (!PKG.test(packageName) || packageName.split('.').some((p) => RESERVED.has(p))) throw new HttpError(400, 'Package name tidak valid');
  const versionName = /^\d+(\.\d+){0,3}$/.test(c.versionName) ? c.versionName : '1.0.0';
  const versionCodeOverride = Number.isInteger(Number(c.versionCodeOverride)) && Number(c.versionCodeOverride) > 0
    ? Math.min(2100000000, Number(c.versionCodeOverride)) : null;

  const f = c.features || {};
  const features = {};
  for (const [k, d] of Object.entries(FEATURE_DEFAULTS)) features[k] = typeof f[k] === 'boolean' ? f[k] : d;
  features.cacheMode = ['default', 'cacheElseNetwork', 'noCache'].includes(f.cacheMode) ? f.cacheMode : 'default';
  if (features.interstitial) features.admob = true;

  const t = c.source?.type;
  if (!['url', 'zip', 'html'].includes(t)) throw new HttpError(400, 'Sumber tidak valid');
  const source = { type: t };
  if (t === 'url') {
    source.url = url(c.source.url, true);
    if (features.httpsOnly && source.url.startsWith('http:')) throw new HttpError(400, 'Alamat http:// butuh opsi “Hanya HTTPS” dimatikan');
  }
  if (t === 'zip' || t === 'html') source.fileId = str(c.source.fileId, 40);
  if (t === 'html' && typeof c.source.html === 'string') source.html = c.source.html.slice(0, 512 * 1024);

  const admob = {
    appId: str(c.admob?.appId, 80), bannerId: str(c.admob?.bannerId, 80), interstitialId: str(c.admob?.interstitialId, 80),
    interstitialEvery: Math.min(20, Math.max(2, Math.round(Number(c.admob?.interstitialEvery) || 4)))
  };
  if (features.admob && !/^ca-app-pub-\d+~\d+$/.test(admob.appId)) throw new HttpError(400, 'AdMob App ID tidak valid');
  if (admob.bannerId && !/^ca-app-pub-\d+\/\d+$/.test(admob.bannerId)) admob.bannerId = '';
  if (features.interstitial && !/^ca-app-pub-\d+\/\d+$/.test(admob.interstitialId)) throw new HttpError(400, 'Interstitial Ad Unit ID tidak valid');
  const onesignal = { appId: str(c.onesignal?.appId, 36) };
  if (features.onesignal && !/^[0-9a-f-]{36}$/i.test(onesignal.appId)) throw new HttpError(400, 'OneSignal App ID tidak valid');
  const tawk = { propertyId: str(c.tawk?.propertyId, 40).replace(/[^\w]/g, ''), widgetId: str(c.tawk?.widgetId, 40).replace(/[^\w]/g, '') || 'default' };
  if (features.tawk && !tawk.propertyId) throw new HttpError(400, 'Tawk Property ID wajib diisi');
  const supabase = { url: url(c.supabase?.url), anonKey: str(c.supabase?.anonKey, 400).replace(/[^\w.\-]/g, '') };
  if (features.supabase && (!/\.supabase\.co\/?$/.test(supabase.url) || supabase.anonKey.length < 20)) throw new HttpError(400, 'URL/anon key Supabase tidak valid');

  const sm = c.sideMenu || {};
  const sideMenu = {
    about: str(sm.about, 1000),
    contactEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sm.contactEmail || '') ? str(sm.contactEmail, 120) : '',
    shareText: str(sm.shareText, 200),
    links: (Array.isArray(sm.links) ? sm.links : []).slice(0, 8)
      .map((l) => ({ label: str(l?.label, 40), url: url(l?.url) }))
      .filter((l) => l.label && l.url)
  };

  // ---------- Rilis 4: multi-platform & plugin native ----------
  const p = c.platforms || {};
  const platforms = Object.fromEntries(PLATFORMS.map((k) => [k, k === 'android' ? p.android !== false : p[k] === true]));
  if (!Object.values(platforms).some(Boolean)) throw new HttpError(400, 'Pilih minimal satu platform');
  const icon = (v, d) => (NAV_ICONS.includes(v) ? v : d);
  // URL absolut (http/https) atau path relatif terhadap halaman awal (mis. /keranjang, #/profil, about.html)
  const navUrl = (v) => { const s = str(v, 500); return url(s) || (/^[#/\w][\w\-./#?=&%~+:]*$/.test(s) && !/^[a-z]+:/i.test(s) ? s : ''); };
  const bottomNav = {
    items: (Array.isArray(c.bottomNav?.items) ? c.bottomNav.items : []).slice(0, 5)
      .map((it) => ({ label: str(it?.label, 16), icon: icon(it?.icon, 'home'), url: navUrl(it?.url) }))
      .filter((it) => it.label && it.url)
  };
  if (features.bottomNav && bottomNav.items.length < 2) throw new HttpError(400, 'Navigasi bawah butuh minimal 2 item (label + URL)');
  const fab = {
    icon: icon(c.fab?.icon, 'chat'),
    action: ['url', 'share', 'scan', 'top'].includes(c.fab?.action) ? c.fab.action : 'url',
    url: navUrl(c.fab?.url)
  };
  if (features.fab && fab.action === 'url' && !fab.url) throw new HttpError(400, 'Tombol mengambang butuh URL');
  if (features.fab && fab.action === 'scan') features.qrScanner = true;
  const shortcuts = (Array.isArray(c.shortcuts) ? c.shortcuts : []).slice(0, 4)
    .map((x) => ({ label: str(x?.label, 24), url: navUrl(x?.url) })).filter((x) => x.label && x.url);
  const linkRules = (Array.isArray(c.linkRules) ? c.linkRules : []).slice(0, 20)
    .map((x) => ({ pattern: str(x?.pattern, 200), action: ['internal', 'external', 'block'].includes(x?.action) ? x.action : 'external' }))
    .filter((x) => x.pattern);
  for (const rule of linkRules) { try { new RegExp(rule.pattern); } catch { throw new HttpError(400, `Pola link tidak valid: ${rule.pattern}`); } }
  const d = c.desktop || {};
  const desktop = {
    width: Math.min(3840, Math.max(400, Math.round(Number(d.width) || 1200))),
    height: Math.min(2160, Math.max(300, Math.round(Number(d.height) || 800))),
    resizable: d.resizable !== false, fullscreen: d.fullscreen === true, alwaysOnTop: d.alwaysOnTop === true,
    maximized: d.maximized === true
  };

  const durationMs = Math.min(5000, Math.max(0, Math.round(Number(c.splash?.durationMs) || 0)));
  return {
    name, packageName, versionName, versionCodeOverride, source,
    iconFileId: str(c.iconFileId, 40),
    splash: { fileId: str(c.splash?.fileId, 40), durationMs },
    colors: {
      primary: hex(c.colors?.primary, '#4f46e5'), statusBar: hex(c.colors?.statusBar, '#3730a3'),
      accent: hex(c.colors?.accent, hex(c.colors?.primary, '#4f46e5')), splashBg: hex(c.colors?.splashBg, '#ffffff')
    },
    progress: { style: ['bar', 'spinner', 'none'].includes(c.progress?.style) ? c.progress.style : 'bar' },
    orientation: ['unspecified', 'portrait', 'landscape'].includes(c.orientation) ? c.orientation : 'unspecified',
    exitText: str(c.exitText, 120) || 'Keluar dari aplikasi?',
    errorPageFileId: str(c.errorPageFileId, 40),
    ...(typeof c.errorPageHtml === 'string' && c.errorPageHtml.trim() ? { errorPageHtml: c.errorPageHtml.slice(0, 100 * 1024) } : {}),
    features, admob, onesignal, tawk, supabase, sideMenu,
    platforms, bottomNav, fab, shortcuts, linkRules, desktop,
    customCss: features.customCode ? String(c.customCss || '').slice(0, 20_000) : '',
    customJs: features.customCode ? String(c.customJs || '').slice(0, 50_000) : '',
    fcmFileId: features.fcm ? str(c.fcmFileId, 40) : '',
    userAgentSuffix: str(c.userAgentSuffix, 40).replace(/[^\w.\-/ ]/g, '')
  };
}
