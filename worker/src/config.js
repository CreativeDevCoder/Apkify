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
  remoteUpdate: false, encrypt: true
};

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
    userAgentSuffix: str(c.userAgentSuffix, 40).replace(/[^\w.\-/ ]/g, '')
  };
}
