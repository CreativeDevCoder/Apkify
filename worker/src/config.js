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

export function sanitizeConfig(c) {
  if (!c || typeof c !== 'object') throw new HttpError(400, 'Konfigurasi kosong');
  const name = str(c.name, 30);
  if (!name) throw new HttpError(400, 'Nama aplikasi wajib diisi');
  const packageName = str(c.packageName, 100).toLowerCase();
  if (!PKG.test(packageName) || packageName.split('.').some((p) => RESERVED.has(p))) throw new HttpError(400, 'Package name tidak valid');
  const versionName = /^\d+(\.\d+){0,3}$/.test(c.versionName) ? c.versionName : '1.0.0';

  const t = c.source?.type;
  if (!['url', 'zip', 'html'].includes(t)) throw new HttpError(400, 'Sumber tidak valid');
  const source = { type: t };
  if (t === 'url') source.url = url(c.source.url, true);
  if (t === 'zip' || t === 'html') source.fileId = str(c.source.fileId, 40);
  if (t === 'html' && typeof c.source.html === 'string') source.html = c.source.html.slice(0, 512 * 1024);

  const f = c.features || {};
  const features = {
    pullToRefresh: bool(f.pullToRefresh), fileUpload: bool(f.fileUpload), downloads: bool(f.downloads),
    externalLinksInBrowser: bool(f.externalLinksInBrowser), offlinePage: bool(f.offlinePage), geolocation: bool(f.geolocation),
    camera: bool(f.camera), zoom: bool(f.zoom), keepAwake: bool(f.keepAwake), fullscreen: bool(f.fullscreen),
    sideMenu: bool(f.sideMenu), admob: bool(f.admob), onesignal: bool(f.onesignal),
    cacheMode: ['default', 'cacheElseNetwork', 'noCache'].includes(f.cacheMode) ? f.cacheMode : 'default',
    encrypt: f.encrypt !== false
  };
  const admob = { appId: str(c.admob?.appId, 80), bannerId: str(c.admob?.bannerId, 80) };
  if (features.admob && !/^ca-app-pub-\d+~\d+$/.test(admob.appId)) throw new HttpError(400, 'AdMob App ID tidak valid');
  if (admob.bannerId && !/^ca-app-pub-\d+\/\d+$/.test(admob.bannerId)) admob.bannerId = '';
  const onesignal = { appId: str(c.onesignal?.appId, 36) };
  if (features.onesignal && !/^[0-9a-f-]{36}$/i.test(onesignal.appId)) throw new HttpError(400, 'OneSignal App ID tidak valid');

  const sm = c.sideMenu || {};
  const sideMenu = {
    about: str(sm.about, 1000),
    contactEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sm.contactEmail || '') ? str(sm.contactEmail, 120) : '',
    shareText: str(sm.shareText, 200),
    links: (Array.isArray(sm.links) ? sm.links : []).slice(0, 8)
      .map((l) => ({ label: str(l?.label, 40), url: url(l?.url) }))
      .filter((l) => l.label && l.url)
  };

  return {
    name, packageName, versionName, source,
    iconFileId: str(c.iconFileId, 40),
    colors: { primary: hex(c.colors?.primary, '#4f46e5'), statusBar: hex(c.colors?.statusBar, '#3730a3'), splashBg: hex(c.colors?.splashBg, '#ffffff') },
    orientation: ['unspecified', 'portrait', 'landscape'].includes(c.orientation) ? c.orientation : 'unspecified',
    features, admob, onesignal, sideMenu,
    userAgentSuffix: str(c.userAgentSuffix, 40).replace(/[^\w.\-/ ]/g, '')
  };
}
