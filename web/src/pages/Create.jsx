import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Container, Typography, Card, CardContent, Tabs, Tab, TextField, Grid, Stack, Button, Switch,
  FormControlLabel, Alert, Box, MenuItem, Divider, LinearProgress, Avatar, ToggleButtonGroup,
  ToggleButton, Accordion, AccordionSummary, AccordionDetails, IconButton, Chip, Slider, Tooltip, Link
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LanguageIcon from '@mui/icons-material/Language';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import CodeIcon from '@mui/icons-material/Code';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { ref, get } from 'firebase/database';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { clearCache } from '../lib/cache';
import { TEMPLATES } from '../lib/templates';
import { takeHandoff } from '../lib/handoff';
import FileDrop from '../components/FileDrop';
import ColorField from '../components/ColorField';
import PlatformPicker from '../components/create/PlatformPicker';
import LivePreview from '../components/create/LivePreview';
import { BottomNavSection, PluginsSection, CodeSection, DesktopSection } from '../components/create/NativeSections';
import { NativePluginsSection, AdsSection, NATIVE_GROUPS } from '../components/create/NativePlugins';
import JSZip from 'jszip';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { validatePackage, suggestPackage, normalizeUrl, validateUrl, isHex } from '../lib/validators';
import { generateLetterIcon, loadImage, fileToDataUrl, drawSquare, canvasToBlob } from '../lib/iconGen';

const DEFAULT = {
  name: '',
  packageName: '',
  versionName: '1.0.0',
  versionCodeOverride: '',
  source: { type: 'url', url: '' },
  colors: { primary: '#4f46e5', statusBar: '#3730a3', accent: '#06b6d4', splashBg: '#ffffff' },
  splash: { durationMs: 0 },
  progress: { style: 'bar' },
  orientation: 'unspecified',
  exitText: 'Keluar dari aplikasi?',
  features: {
    pullToRefresh: true, fileUpload: true, downloads: true, externalLinksInBrowser: true, offlinePage: true,
    geolocation: false, camera: false, microphone: false, vibrate: false,
    zoom: false, zoomButtons: false, scrollbars: true, textSelection: true, saveFormData: true,
    keepAwake: false, fullscreen: false, disallowScreenshot: false, confirmExit: false, popupBlocker: false,
    deepLinking: false, httpsOnly: true, allowFileAccess: false, crossOrigin: false,
    showToolbar: false, liveTitle: false, homeButton: false, sideMenu: false,
    hideWebViewUA: false, hideMobileUA: false, desktopMode: false,
    admob: false, interstitial: false, onesignal: false, tawk: false, jsApi: false, supabase: false,
    remoteUpdate: false, encrypt: true, cacheMode: 'default',
    bottomNav: false, fab: false, qrScanner: false, biometric: false, inAppReview: false, billing: false,
    nativeStorage: false, shareTarget: false, shortcuts: false, androidTv: false, analytics: false, fcm: false,
    customCode: false, linkRules: false,
    ads: false,
    ...Object.fromEntries(NATIVE_GROUPS.flatMap(([, l]) => l).map(([k]) => [k, false]))
  },
  ads: {
    network: 'admob', banner: 'bottom', bannerStyle: 'adaptive', interstitial: false, interstitialEvery: 4, minGapSec: 45, appOpen: false, mediation: [],
    admob: { appId: '', bannerId: '', interstitialId: '', rewardedId: '', rewardedInterstitialId: '', appOpenId: '', nativeId: '' },
    applovin: { sdkKey: '', bannerId: '', interstitialId: '', rewardedId: '', appOpenId: '' },
    unity: { gameId: '', bannerId: '', interstitialId: '', rewardedId: '', testMode: false },
    meta: { bannerId: '', interstitialId: '', rewardedId: '' },
    startio: { appId: '', testMode: false }
  },
  google: { webClientId: '' },
  facebook: { appId: '', clientToken: '' },
  appLock: { timeoutSec: 30 },
  widget: { title: '', text: '', url: '/' },
  tile: { label: '', url: '/', icon: 'apps' },
  kiosk: { autoStart: false, launcher: false },
  integrity: { cloudProjectNumber: '' },
  nfc: { aids: [] },
  altIconFileIds: [],
  platforms: { android: true, windows: false, macos: false, linux: false, ios: false },
  bottomNav: { items: [{ label: 'Beranda', icon: 'home', url: '/' }, { label: 'Akun', icon: 'user', url: '/akun' }] },
  fab: { icon: 'chat', action: 'url', url: '' },
  shortcuts: [],
  linkRules: [],
  customCss: '',
  customJs: '',
  fcmFileId: '',
  desktop: { width: 1200, height: 800, resizable: true, fullscreen: false, alwaysOnTop: false, maximized: false },
  sideMenu: { about: '', contactEmail: '', shareText: '', links: [] },
  admob: { appId: '', bannerId: '', interstitialId: '', interstitialEvery: 4 },
  onesignal: { appId: '' },
  tawk: { propertyId: '', widgetId: 'default' },
  supabase: { url: '', anonKey: '' },
  userAgentSuffix: ''
};

// [kunci, label, penjelasan, hanya untuk (url|local)?]
const GROUPS = [
  ['Navigasi & tampilan', [
    ['pullToRefresh', 'Tarik untuk refresh'],
    ['fullscreen', 'Layar penuh', 'Sembunyikan status bar & navigasi sistem'],
    ['keepAwake', 'Layar tetap menyala'],
    ['scrollbars', 'Scrollbar samping'],
    ['zoom', 'Pinch zoom'],
    ['zoomButtons', 'Tombol zoom (+/−)'],
    ['textSelection', 'Izinkan seleksi teks', 'Matikan agar konten tidak mudah disalin'],
    ['confirmExit', 'Konfirmasi saat keluar']
  ]],
  ['Link & jendela', [
    ['externalLinksInBrowser', 'Link domain lain dibuka di browser'],
    ['popupBlocker', 'Blokir pop-up', 'Bila mati, window.open/target=_blank dibuka di dalam aplikasi'],
    ['deepLinking', 'Deep linking', 'Link ke domain situs Anda di HP dibuka langsung di aplikasi', 'url'],
    ['downloads', 'Unduh file (Download Manager)'],
    ['fileUpload', 'Upload file dari form']
  ]],
  ['Keamanan & data', [
    ['httpsOnly', 'Hanya konten HTTPS', 'Matikan untuk situs http:// atau konten campuran'],
    ['disallowScreenshot', 'Larang screenshot & rekam layar'],
    ['saveFormData', 'Simpan isian formulir (autofill)'],
    ['offlinePage', 'Halaman error/offline'],
    ['allowFileAccess', 'Izinkan akses file', 'file:// dan content:// di WebView'],
    ['crossOrigin', 'Izinkan cross-origin (konten lokal)', 'Permintaan GET ke API luar dari aplikasi ZIP/HTML tanpa CORS', 'local'],
    ['encrypt', 'Enkripsi konten di APK (AES-GCM)', 'Mempersulit penyalinan HTML/JS', 'local']
  ]]
];
const PERMS = [
  ['camera', 'Kamera'], ['microphone', 'Mikrofon'], ['geolocation', 'Lokasi (GPS)'], ['vibrate', 'Getar']
];

const MAX_ZIP_MB = 50;
const MAX_HTML_KB = 500;

function Toggle({ k, label, hint, f, set }) {
  return (
    <FormControlLabel
      control={<Switch checked={!!f[k]} onChange={(e) => set(`features.${k}`, e.target.checked)} />}
      label={<Stack direction="row" alignItems="center" spacing={0.5}><span>{label}</span>{hint && <Tooltip title={hint}><HelpOutlineIcon sx={{ fontSize: 16, color: 'text.secondary' }} /></Tooltip>}</Stack>}
    />
  );
}

/** Konfigurasi iklan lama (admob + interstitial) -> format multi-jaringan rilis 5 */
function migrateAds(c) {
  const d = structuredClone(DEFAULT.ads);
  const a = c.ads || {};
  const out = { ...d, ...a };
  for (const n of ['admob', 'applovin', 'unity', 'meta', 'startio']) out[n] = { ...d[n], ...(a[n] || {}) };
  if (!a.network && c.features?.admob) {
    out.network = 'admob';
    out.admob = { ...out.admob, appId: c.admob?.appId || '', bannerId: c.admob?.bannerId || '', interstitialId: c.admob?.interstitialId || '' };
    out.interstitial = !!c.features?.interstitial;
    out.interstitialEvery = c.admob?.interstitialEvery || 4;
  }
  out.mediation = out.mediation || [];
  return out;
}

function Section({ title, children, defaultExpanded = false, chip }) {
  return (
    <Accordion defaultExpanded={defaultExpanded} disableGutters sx={{ mb: 1.5, border: 1, borderColor: 'divider', '&:before': { display: 'none' }, borderRadius: 2 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography fontWeight={700}>{title}</Typography>{chip && <Chip size="small" label={chip} sx={{ ml: 1 }} />}
      </AccordionSummary>
      <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
  );
}

export default function Create() {
  const { appId } = useParams();
  const [qs] = useSearchParams();
  const { user, isAnon, loading: authLoading, ensureUser } = useAuth();
  const nav = useNavigate();
  const [cfg, setCfg] = useState(() => ({
    ...structuredClone(DEFAULT),
    name: qs.get('name') || '',
    source: { type: qs.get('type') || 'url', url: qs.get('url') || '' }
  }));
  const [pkgTouched, setPkgTouched] = useState(false);
  const [zipFile, setZipFile] = useState(null);
  const [zipInfo, setZipInfo] = useState(null);
  // Periksa isi ZIP di browser: hasil build (index.html) atau kode sumber (package.json)?
  useEffect(() => {
    setZipInfo(null);
    if (!zipFile) return;
    let live = true;
    JSZip.loadAsync(zipFile).then((z) => {
      const names = Object.keys(z.files).filter((n) => !n.startsWith('__MACOSX'));
      const depth = (n) => n.replace(/\/$/, '').split('/').length;
      const top = (n) => names.some((x) => x.endsWith(n) && depth(x) <= 2 && !x.includes('node_modules/'));
      const nm = names.some((n) => n.includes('node_modules/'));
      let info;
      if (top('package.json') && names.some((n) => /(^|\/)src\/main\.(j|t)sx?$|vite\.config|angular\.json|svelte\.config/.test(n)))
        info = { type: 'success', text: `Kode sumber terdeteksi — Apkify menjalankan "npm install" + "npm run build" otomatis di cloud${names.some((n) => n.endsWith('vite.config.js') || n.endsWith('vite.config.ts')) ? ' (Vite, BrowserRouter didukung)' : ''}.` };
      else if (top('index.html')) info = { type: 'success', text: 'ZIP siap pakai: index.html ditemukan.' };
      else if (top('package.json')) info = { type: 'info', text: 'package.json ditemukan — proyek akan di-build dengan "npm run build".' };
      else info = { type: 'warning', text: 'index.html atau package.json tidak ditemukan di folder utama ZIP.' };
      if (nm) info = { type: 'warning', text: `${info.text} Hapus folder node_modules dari ZIP agar ukurannya kecil (dipasang ulang otomatis).` };
      if (live) setZipInfo(info);
    }).catch(() => live && setZipInfo({ type: 'error', text: 'File ZIP tidak valid.' }));
    return () => { live = false; };
  }, [zipFile]);
  const [html, setHtml] = useState('');
  const [iconMode, setIconMode] = useState('generate');
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState('');
  const [existingIconId, setExistingIconId] = useState('');
  const [splashMode, setSplashMode] = useState('icon');
  const [splashFile, setSplashFile] = useState(null);
  const [splashPreview, setSplashPreview] = useState('');
  const [errorMode, setErrorMode] = useState('default');
  const [errorHtml, setErrorHtml] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ label: '', value: 0 });
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);
  const [metaBusy, setMetaBusy] = useState(false);
  const genCanvas = useRef(null);

  useEffect(() => {
    if (appId && !authLoading && !user) nav(`/login?next=/create/${appId}`, { replace: true });
  }, [appId, authLoading, user, nav]);

  // Prefill: template, AI Studio, atau Media App Maker (ZIP)
  useEffect(() => {
    if (appId) return;
    const from = qs.get('from');
    let pre = null;
    const tid = qs.get('template');
    if (tid) pre = TEMPLATES.find((t) => t.id === tid);
    if (from === 'ai') { try { pre = JSON.parse(sessionStorage.getItem('apkify:ai') || 'null'); } catch { /* */ } }
    if (from === 'handoff') {
      const h = takeHandoff();
      if (h?.zip) { pre = { appName: h.name, source: 'zip', color: h.color }; setZipFile(h.zip); }
    }
    if (!pre) return;
    setCfg((c) => ({
      ...c,
      name: c.name || (pre.appName || pre.name || '').slice(0, 30),
      source: { type: pre.source || (pre.html ? 'html' : 'url'), url: c.source.url },
      colors: pre.color ? { ...c.colors, primary: pre.color, statusBar: pre.color } : c.colors,
      orientation: pre.preset?.orientation || c.orientation,
      features: { ...c.features, ...(pre.preset?.features || {}) }
    }));
    if (pre.html) setHtml(pre.html);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mode edit: muat konfigurasi app (1x baca RTDB)
  useEffect(() => {
    if (!appId || !user) return;
    get(ref(db, `apps/${user.uid}/${appId}`)).then((s) => {
      const a = s.val();
      if (!a?.config) return;
      const c = a.config;
      setCfg({
        ...structuredClone(DEFAULT), ...c, versionCodeOverride: '',
        colors: { ...DEFAULT.colors, ...c.colors }, features: { ...DEFAULT.features, ...c.features, ads: !!(c.features?.ads || c.features?.admob) },
        sideMenu: { ...DEFAULT.sideMenu, ...c.sideMenu }, admob: { ...DEFAULT.admob, ...c.admob },
        tawk: { ...DEFAULT.tawk, ...c.tawk }, supabase: { ...DEFAULT.supabase, ...c.supabase },
        splash: { ...DEFAULT.splash, ...c.splash }, progress: { ...DEFAULT.progress, ...c.progress },
        platforms: { ...DEFAULT.platforms, ...c.platforms }, bottomNav: { items: c.bottomNav?.items?.length ? c.bottomNav.items : DEFAULT.bottomNav.items },
        fab: { ...DEFAULT.fab, ...c.fab }, desktop: { ...DEFAULT.desktop, ...c.desktop },
        shortcuts: c.shortcuts || [], linkRules: c.linkRules || [],
        ads: migrateAds(c), google: { ...DEFAULT.google, ...c.google }, facebook: { ...DEFAULT.facebook, ...c.facebook },
        appLock: { ...DEFAULT.appLock, ...c.appLock }, widget: { ...DEFAULT.widget, ...c.widget }, tile: { ...DEFAULT.tile, ...c.tile },
        kiosk: { ...DEFAULT.kiosk, ...c.kiosk }, integrity: { ...DEFAULT.integrity, ...c.integrity }, nfc: { aids: c.nfc?.aids || [] },
        altIconFileIds: c.altIconFileIds || []
      });
      setPkgTouched(true);
      if (c.iconFileId) { setExistingIconId(c.iconFileId); setIconMode('keep'); }
      if (c.splash?.fileId) setSplashMode('keep');
      if (c.errorPageFileId) setErrorMode('keep');
    });
  }, [appId, user]);

  const set = (path, value) => setCfg((c) => {
    const n = structuredClone(c);
    const keys = path.split('.');
    let o = n;
    keys.slice(0, -1).forEach((k) => { o = o[k] ??= {}; });
    o[keys.at(-1)] = value;
    return n;
  });

  useEffect(() => {
    if (!pkgTouched) set('packageName', suggestPackage(cfg.name, cfg.source.type === 'url' ? normalizeUrl(cfg.source.url) : ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.name, cfg.source.url, cfg.source.type, pkgTouched]);

  useEffect(() => {
    if (iconMode === 'generate') {
      const c = generateLetterIcon({ text: cfg.name || 'A', bg1: cfg.colors.primary, bg2: cfg.colors.statusBar, size: 512, radius: 0 });
      genCanvas.current = c;
      setIconPreview(c.toDataURL('image/png'));
    } else if (iconMode === 'upload' && iconFile) fileToDataUrl(iconFile).then(setIconPreview);
    else if (iconMode === 'keep') setIconPreview('');
  }, [iconMode, iconFile, cfg.name, cfg.colors.primary, cfg.colors.statusBar]);

  useEffect(() => {
    if (splashMode === 'custom' && splashFile) fileToDataUrl(splashFile).then(setSplashPreview);
    else setSplashPreview('');
  }, [splashMode, splashFile]);

  const isLocal = cfg.source.type !== 'url';
  const f = cfg.features;
  const T = (p) => <Toggle {...p} f={f} set={set} />;
  const desktopOn = cfg.platforms.windows || cfg.platforms.macos || cfg.platforms.linux;

  /** Isi otomatis dari website: nama, warna tema, ikon (manifest/apple-touch-icon/favicon) */
  async function autoFill() {
    setMetaBusy(true);
    setError('');
    try {
      const url = normalizeUrl(cfg.source.url);
      const m = await api.get(`/api/public/site-meta?url=${encodeURIComponent(url)}`, { auth: false });
      setMeta(m);
      setCfg((c) => ({
        ...c,
        name: c.name || m.name,
        colors: m.themeColor ? { ...c.colors, primary: m.themeColor, statusBar: m.themeColor } : c.colors
      }));
      const best = m.icons.find((i) => i.size >= 128 && !/\.ico($|\?)/i.test(i.src) && !/\.svg($|\?)/i.test(i.src)) || m.icons.find((i) => !/\.ico($|\?)/i.test(i.src));
      if (best) {
        const res = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/public/site-icon?url=${encodeURIComponent(best.src)}`);
        if (res.ok) {
          const blob = await res.blob();
          const img = await loadImage(URL.createObjectURL(blob));
          if (img.width >= 96) { setIconFile(new File([blob], 'icon.png', { type: blob.type })); setIconMode('upload'); }
        }
      }
    } catch (e) {
      setError(`Isi otomatis gagal: ${e.message}`);
    } finally {
      setMetaBusy(false);
    }
  }

  const errors = useMemo(() => {
    const e = {};
    if (!cfg.name.trim()) e.name = 'Nama aplikasi wajib diisi';
    else if (cfg.name.length > 30) e.name = 'Maksimal 30 karakter';
    const pe = validatePackage(cfg.packageName);
    if (pe) e.packageName = pe;
    if (!/^\d+(\.\d+){0,3}$/.test(cfg.versionName)) e.versionName = 'Contoh: 1.0.0';
    if (cfg.versionCodeOverride && !/^\d{1,10}$/.test(String(cfg.versionCodeOverride))) e.versionCode = 'Kode versi harus angka';
    if (cfg.source.type === 'url') {
      const ue = validateUrl(cfg.source.url);
      if (ue) e.url = ue;
      else if (f.httpsOnly && /^http:\/\//i.test(cfg.source.url.trim())) e.url = 'Alamat http:// butuh opsi “Hanya konten HTTPS” dimatikan';
    }
    if (cfg.source.type === 'zip' && !zipFile && !cfg.source.fileId) e.zip = 'Pilih file ZIP';
    if (cfg.source.type === 'html' && !html.trim() && !cfg.source.fileId) e.html = 'Tempel kode HTML';
    if (Object.values(cfg.colors).some((c) => !isHex(c))) e.colors = 'Warna tidak valid';
    if (f.ads) {
      const a = cfg.ads, n = a.network;
      if (n === 'admob' && !/^ca-app-pub-\d+~\d+$/.test(a.admob.appId)) e.ads = 'AdMob App ID: ca-app-pub-xxx~yyy';
      if (n === 'applovin' && a.applovin.sdkKey.length < 20) e.ads = 'Isi SDK key AppLovin';
      if (n === 'unity' && !/^\d{5,12}$/.test(a.unity.gameId)) e.ads = 'Unity Game ID berupa angka';
      if (n === 'meta' && !Object.values(a.meta).some(Boolean)) e.ads = 'Isi minimal satu Placement ID Meta';
      if (n === 'startio' && !/^\d{6,12}$/.test(a.startio.appId)) e.ads = 'Start.io App ID berupa angka';
    }
    if (f.googleSignIn && !/\.apps\.googleusercontent\.com$/.test(cfg.google.webClientId)) e.native = 'Login Google: isi Web client ID';
    if (f.facebookLogin && (!/^\d{6,20}$/.test(cfg.facebook.appId) || !/^[a-f0-9]{32}$/i.test(cfg.facebook.clientToken))) e.native = 'Login Facebook: App ID & Client Token (32 karakter hex)';
    if (f.altIcons && !cfg.altIconFileIds.length) e.native = 'Unggah minimal satu ikon alternatif';
    if (f.onesignal && !/^[0-9a-f-]{36}$/i.test(cfg.onesignal.appId)) e.onesignal = 'OneSignal App ID (UUID)';
    if (f.tawk && !cfg.tawk.propertyId.trim()) e.tawk = 'Tawk Property ID wajib diisi';
    if (f.supabase && (!/\.supabase\.co\/?$/.test(cfg.supabase.url) || cfg.supabase.anonKey.length < 20)) e.supabase = 'URL (https://xxx.supabase.co) & anon key Supabase';
    if (iconMode === 'upload' && !iconFile) e.icon = 'Pilih gambar ikon';
    if (!Object.values(cfg.platforms).some(Boolean)) e.platforms = 'Pilih minimal satu platform';
    if (f.bottomNav && cfg.bottomNav.items.filter((i) => i.label && i.url).length < 2) e.bottomNav = 'Navigasi bawah butuh minimal 2 tab berisi label & URL';
    if (f.fab && cfg.fab.action === 'url' && !cfg.fab.url) e.fab = 'Isi URL tombol mengambang';
    if ((f.fcm || f.firebaseAnalytics || f.crashlytics) && !cfg.fcmFileId) e.fcm = 'Unggah google-services.json (Firebase)';
    if (splashMode === 'custom' && !splashFile) e.splash = 'Pilih gambar splash';
    if (errorMode === 'custom' && !errorHtml.trim()) e.errorPage = 'Isi HTML halaman error';
    return e;
  }, [cfg, f, zipFile, html, iconMode, iconFile, splashMode, splashFile, errorMode, errorHtml]);

  async function uploadPng(canvasOrFile, kind) {
    let canvas = canvasOrFile;
    if (canvasOrFile instanceof File) {
      const img = await loadImage(await fileToDataUrl(canvasOrFile));
      if (kind === 'icon' && (img.width < 192 || img.height < 192)) throw new Error('Ikon minimal 192×192 px (disarankan 512×512).');
      canvas = kind === 'icon' ? drawSquare(img, 512) : (() => {
        const c = document.createElement('canvas');
        const s = Math.min(1024, Math.max(img.width, img.height));
        c.width = c.height = s;
        const k = s / Math.max(img.width, img.height);
        c.getContext('2d').drawImage(img, (s - img.width * k) / 2, (s - img.height * k) / 2, img.width * k, img.height * k);
        return c;
      })();
    }
    const blob = await canvasToBlob(canvas);
    const label = kind === 'icon' ? 'Mengunggah ikon…' : 'Mengunggah splash…';
    setProgress({ label, value: 0 });
    const r = await api.upload('/api/uploads', new File([blob], `${kind}.png`, { type: 'image/png' }), { kind, onProgress: (v) => setProgress({ label, value: v }) });
    return r.fileId;
  }

  async function submit() {
    setError('');
    if (Object.keys(errors).length) { setError(Object.values(errors)[0]); return; }
    setBusy(true);
    try {
      const u = await ensureUser();
      const iconFileId = iconMode === 'keep' && existingIconId ? existingIconId
        : await uploadPng(iconMode === 'generate' ? genCanvas.current : iconFile, 'icon');
      const splash = { durationMs: cfg.splash.durationMs };
      if (splashMode === 'custom') splash.fileId = await uploadPng(splashFile, 'splash');
      if (splashMode === 'keep') splash.fileId = cfg.splash.fileId;

      const source = { type: cfg.source.type };
      if (source.type === 'url') source.url = /^https?:\/\//i.test(cfg.source.url.trim()) ? cfg.source.url.trim() : normalizeUrl(cfg.source.url);
      if (source.type === 'zip') {
        if (zipFile) {
          if (zipFile.size > MAX_ZIP_MB * 1048576) throw new Error(`ZIP maksimal ${MAX_ZIP_MB} MB`);
          const r = await api.upload('/api/uploads', zipFile, { kind: 'zip', onProgress: (v) => setProgress({ label: 'Mengunggah ZIP…', value: v }) });
          source.fileId = r.fileId;
        } else source.fileId = cfg.source.fileId;
      }
      if (source.type === 'html') {
        if (html.trim()) {
          if (new Blob([html]).size > MAX_HTML_KB * 1024) throw new Error(`HTML maksimal ${MAX_HTML_KB} KB`);
          source.html = html;
        } else source.fileId = cfg.source.fileId;
      }
      setProgress({ label: 'Mengirim ke antrean build…', value: 100 });
      const config = {
        ...cfg, source, iconFileId, splash,
        // iklan memakai blok "ads" (rilis 5); flag AdMob lama diturunkan dari situ
        features: { ...cfg.features, admob: cfg.features.ads && cfg.ads.network === 'admob', interstitial: false },
        ads: { ...cfg.ads, interstitial: cfg.ads.interstitial },
        versionCodeOverride: cfg.versionCodeOverride ? Number(cfg.versionCodeOverride) : null,
        errorPageFileId: errorMode === 'keep' ? cfg.errorPageFileId : '',
        ...(errorMode === 'custom' ? { errorPageHtml: errorHtml } : {})
      };
      const res = await api.post('/api/builds', { appId: appId || null, config });
      clearCache(`apps:${u.uid}`);
      nav(`/build/${res.buildId}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const splashImg = splashMode === 'custom' ? splashPreview : iconPreview;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>{appId ? 'Perbarui aplikasi' : 'Buat aplikasi Android'}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Isi data di bawah, lalu klik Build. Hasilnya APK (dipasang langsung) dan AAB (Google Play). Bagian lanjutan opsional — nilai bawaan sudah aman.</Typography>
      {(!user || isAnon) && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Anda bisa build tanpa akun (mode tamu, batas lebih kecil). <b>Daftar gratis</b> agar aplikasi, riwayat, dan keystore tersimpan permanen serta mendapat email saat build selesai.
        </Alert>
      )}

      {/* 1. SUMBER */}
      <Card sx={{ mb: 2 }}><CardContent>
        <Typography variant="h6" gutterBottom>1. Sumber konten</Typography>
        <Tabs value={cfg.source.type} onChange={(_, v) => set('source.type', v)} sx={{ mb: 2 }} variant="fullWidth">
          <Tab value="url" icon={<LanguageIcon />} iconPosition="start" label="Website" />
          <Tab value="zip" icon={<FolderZipIcon />} iconPosition="start" label="ZIP" />
          <Tab value="html" icon={<CodeIcon />} iconPosition="start" label="HTML" />
        </Tabs>
        {cfg.source.type === 'url' && (<>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }}>
            <TextField label="Alamat website" placeholder="https://tokoanda.com" value={cfg.source.url}
              onChange={(e) => set('source.url', e.target.value)} error={!!cfg.source.url && !!errors.url}
              helperText={(cfg.source.url && errors.url) || 'Situs harus bisa dibuka di HP. Konten aplikasi selalu mengikuti situs Anda.'} />
            <Button variant="outlined" startIcon={<AutoFixHighIcon />} disabled={metaBusy || !!errors.url} onClick={autoFill} sx={{ whiteSpace: 'nowrap', minWidth: 170 }}>
              {metaBusy ? 'Membaca situs…' : 'Isi otomatis'}
            </Button>
          </Stack>
          {meta && (
            <Alert severity={meta.https ? 'success' : 'warning'} sx={{ mt: 1 }}>
              Ditemukan: <b>{meta.name || '(tanpa nama)'}</b>{meta.themeColor ? `, warna ${meta.themeColor}` : ''}, {meta.icons.length} ikon{meta.hasManifest ? ', manifest PWA' : ''}.
              {!meta.https && ' Situs belum HTTPS — matikan opsi “Hanya konten HTTPS” atau pasang SSL.'}
            </Alert>
          )}
        </>)}
        {cfg.source.type === 'zip' && <>
          <FileDrop accept=".zip,application/zip" file={zipFile} onFile={setZipFile} hint={`ZIP hasil build (index.html) atau kode sumber React/Vite/Vue/Svelte/Angular (package.json) — di-build otomatis. Maks ${MAX_ZIP_MB} MB.`} />
          {zipInfo && <Alert severity={zipInfo.type} sx={{ mt: 1 }}>{zipInfo.text}</Alert>}
          {cfg.source.fileId && !zipFile && <Alert severity="info" sx={{ mt: 1 }}>ZIP sebelumnya dipakai lagi bila tidak memilih file baru.</Alert>}
          <Typography variant="body2" sx={{ mt: 1 }}>Punya foto, musik, video, atau PDF? Pakai <Link component={RouterLink} to="/media-app">Media App Maker</Link>.</Typography>
        </>}
        {cfg.source.type === 'html' && (
          <TextField multiline minRows={8} maxRows={20} label="Kode HTML" value={html} onChange={(e) => setHtml(e.target.value)}
            placeholder="<!doctype html><html>…</html>" helperText={`Satu halaman HTML (CSS/JS inline). Maks ${MAX_HTML_KB} KB.`}
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: 13 } }} />
        )}
      </CardContent></Card>

      {/* PLATFORM */}
      <Card sx={{ mb: 2 }}><CardContent>
        <Typography variant="h6" gutterBottom>Platform target</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Satu konfigurasi, banyak platform — semua dibangun paralel di cloud.</Typography>
        <PlatformPicker value={cfg.platforms} anon={!user || isAnon} onChange={(v) => set('platforms', v)} />
      </CardContent></Card>

      {/* 2. IDENTITAS */}
      <Card sx={{ mb: 2 }}><CardContent>
        <Typography variant="h6" gutterBottom>2. Identitas aplikasi</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField label="Nama aplikasi" value={cfg.name} onChange={(e) => set('name', e.target.value)} error={!!cfg.name && !!errors.name} helperText={errors.name || 'Tampil di bawah ikon HP'} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="Versi" value={cfg.versionName} onChange={(e) => set('versionName', e.target.value)} error={!!errors.versionName} helperText={errors.versionName || 'mis. 1.0.0'} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <TextField label="Kode versi" value={cfg.versionCodeOverride} onChange={(e) => set('versionCodeOverride', e.target.value.replace(/\D/g, ''))}
              error={!!errors.versionCode} helperText={errors.versionCode || 'Kosong = otomatis +1'} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Package name" value={cfg.packageName} disabled={!!appId}
              onChange={(e) => { setPkgTouched(true); set('packageName', e.target.value.toLowerCase()); }}
              error={!!errors.packageName} helperText={errors.packageName || (appId ? 'Tidak bisa diubah agar update terpasang di atas versi lama.' : 'ID unik di Play Store, tidak bisa diubah setelah terbit.')} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField select label="Orientasi layar" value={cfg.orientation} onChange={(e) => set('orientation', e.target.value)}>
              <MenuItem value="unspecified">Rotasi otomatis</MenuItem><MenuItem value="portrait">Potret</MenuItem><MenuItem value="landscape">Lanskap</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField select label="Mode cache" value={f.cacheMode} onChange={(e) => set('features.cacheMode', e.target.value)}>
              <MenuItem value="noCache">Tanpa cache (selalu terbaru)</MenuItem>
              <MenuItem value="default">Cache standar</MenuItem>
              <MenuItem value="cacheElseNetwork">Cache tinggi (paling cepat & hemat kuota)</MenuItem>
            </TextField>
          </Grid>
        </Grid>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Penandatanganan: keystore dibuat otomatis per package. Punya keystore sendiri? Unggah dari <Link component={RouterLink} to="/dashboard">Studio</Link> → ikon kunci (butuh akun).
        </Typography>
      </CardContent></Card>

      {/* 3. IKON, SPLASH, WARNA */}
      <Card sx={{ mb: 2 }}><CardContent>
        <Typography variant="h6" gutterBottom>3. Ikon, splash & warna</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={7}>
            <Typography fontWeight={600} gutterBottom>Ikon</Typography>
            <ToggleButtonGroup exclusive size="small" value={iconMode} onChange={(_, v) => v && setIconMode(v)} sx={{ mb: 1 }}>
              <ToggleButton value="generate">Buat otomatis</ToggleButton>
              <ToggleButton value="upload">Upload</ToggleButton>
              {existingIconId && <ToggleButton value="keep">Ikon lama</ToggleButton>}
            </ToggleButtonGroup>
            {iconMode === 'upload' && <FileDrop accept="image/png,image/jpeg,image/webp" file={iconFile} onFile={setIconFile} hint="PNG/JPG persegi, ideal 512×512" />}

            <Typography fontWeight={600} sx={{ mt: 2 }} gutterBottom>Splash screen</Typography>
            <ToggleButtonGroup exclusive size="small" value={splashMode} onChange={(_, v) => v && setSplashMode(v)} sx={{ mb: 1 }}>
              <ToggleButton value="icon">Pakai ikon</ToggleButton>
              <ToggleButton value="custom">Gambar sendiri</ToggleButton>
              {cfg.splash.fileId && <ToggleButton value="keep">Splash lama</ToggleButton>}
            </ToggleButtonGroup>
            {splashMode === 'custom' && <FileDrop accept="image/png,image/jpeg,image/webp" file={splashFile} onFile={setSplashFile} hint="Logo PNG transparan disarankan (ditampilkan dalam lingkaran)" />}
            <Typography variant="body2" sx={{ mt: 1 }}>Durasi minimum: {cfg.splash.durationMs ? `${cfg.splash.durationMs} ms` : 'Bawaan sistem'}</Typography>
            <Slider value={cfg.splash.durationMs} min={0} max={5000} step={250} onChange={(_, v) => set('splash.durationMs', v)} />
          </Grid>
          <Grid item xs={12} sm={5}>
            {/* Pratinjau splash */}
            <Box sx={{ mx: 'auto', width: 180, height: 340, border: '6px solid #111', borderRadius: 4, bgcolor: cfg.colors.splashBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
              <Avatar src={splashImg} sx={{ width: 96, height: 96, bgcolor: cfg.colors.primary }}>{iconMode === 'keep' && !splashImg ? '' : (cfg.name || 'A')[0]}</Avatar>
              <Typography variant="caption" sx={{ color: isHex(cfg.colors.splashBg) && parseInt(cfg.colors.splashBg.slice(1), 16) > 0x888888 ? '#333' : '#eee' }}>{cfg.name || 'Nama Aplikasi'}</Typography>
            </Box>
            <Typography variant="caption" display="block" textAlign="center" color="text.secondary">Pratinjau splash</Typography>
          </Grid>
        </Grid>
        <Divider sx={{ my: 2 }} />
        <Typography fontWeight={600} gutterBottom>Skema warna Material</Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}><ColorField label="Utama" value={cfg.colors.primary} onChange={(v) => set('colors.primary', v)} /></Grid>
          <Grid item xs={6} sm={3}><ColorField label="Status bar (gelap)" value={cfg.colors.statusBar} onChange={(v) => set('colors.statusBar', v)} /></Grid>
          <Grid item xs={6} sm={3}><ColorField label="Aksen" value={cfg.colors.accent} onChange={(v) => set('colors.accent', v)} /></Grid>
          <Grid item xs={6} sm={3}><ColorField label="Latar splash" value={cfg.colors.splashBg} onChange={(v) => set('colors.splashBg', v)} /></Grid>
        </Grid>
        <Stack direction="row" sx={{ mt: 1, borderRadius: 1, overflow: 'hidden', height: 16 }}>
          {[cfg.colors.statusBar, cfg.colors.primary, cfg.colors.accent].map((c, i) => <Box key={i} sx={{ flex: 1, bgcolor: isHex(c) ? c : '#ccc' }} />)}
        </Stack>
        <TextField select label="Indikator loading" value={cfg.progress.style} onChange={(e) => set('progress.style', e.target.value)} sx={{ mt: 2 }}>
          <MenuItem value="bar">Garis di atas</MenuItem><MenuItem value="spinner">Lingkaran di tengah</MenuItem><MenuItem value="none">Tanpa indikator</MenuItem>
        </TextField>
      </CardContent></Card>

      <Section title="Pratinjau langsung" defaultExpanded>
        <LivePreview cfg={cfg} html={html} iconPreview={iconPreview} frameBlocked={meta?.frameBlocked} />
      </Section>

      {/* 4. LANJUTAN */}
      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>4. Pengaturan lanjutan</Typography>

      <Section title="Navigasi bawah & tombol mengambang" chip="baru">
        <BottomNavSection cfg={cfg} set={set} Toggle={T} />
      </Section>

      <Section title="Plugin native dasar" chip="QR, biometrik, billing, FCM">
        <PluginsSection cfg={cfg} set={set} Toggle={T} onFcm={(id) => set('fcmFileId', id)} />
        {errors.fcm && <Alert severity="warning" sx={{ mt: 1 }}>{errors.fcm}</Alert>}
      </Section>

      <Section title="Fitur native lengkap (NFC, printer, OCR, lokasi, notifikasi…)" chip="60+ API">
        <NativePluginsSection cfg={cfg} set={set} Toggle={T} />
        {errors.native && <Alert severity="warning" sx={{ mt: 1 }}>{errors.native}</Alert>}
      </Section>

      <Section title="Kode kustom & aturan link">
        <CodeSection cfg={cfg} set={set} Toggle={T} />
      </Section>

      {desktopOn && (
        <Section title="Jendela desktop (Windows/macOS/Linux)" defaultExpanded>
          <DesktopSection cfg={cfg} set={set} />
        </Section>
      )}

      <Section title="Toolbar & menu samping">
        <Grid container>
          <Grid item xs={12} sm={4}><Toggle k="showToolbar" label="Tampilkan toolbar (judul)" f={f} set={set} /></Grid>
          <Grid item xs={12} sm={4}><Toggle k="liveTitle" label="Judul mengikuti halaman" f={f} set={set} /></Grid>
          <Grid item xs={12} sm={4}><Toggle k="homeButton" label="Tombol Home" f={f} set={set} /></Grid>
        </Grid>
        <Toggle k="sideMenu" label="Menu samping (navigation drawer)" f={f} set={set} />
        {f.sideMenu && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Teks dialog Tentang" multiline minRows={2} value={cfg.sideMenu.about} onChange={(e) => set('sideMenu.about', e.target.value)} />
            <TextField label="Email kontak" value={cfg.sideMenu.contactEmail} onChange={(e) => set('sideMenu.contactEmail', e.target.value)} />
            <TextField label="Teks bagikan aplikasi" value={cfg.sideMenu.shareText} onChange={(e) => set('sideMenu.shareText', e.target.value)} placeholder="Coba aplikasi ini!" />
            {cfg.sideMenu.links.map((l, i) => (
              <Stack direction="row" spacing={1} key={i}>
                <TextField label="Label" value={l.label} onChange={(e) => { const L = [...cfg.sideMenu.links]; L[i] = { ...l, label: e.target.value }; set('sideMenu.links', L); }} />
                <TextField label="URL" value={l.url} onChange={(e) => { const L = [...cfg.sideMenu.links]; L[i] = { ...l, url: e.target.value }; set('sideMenu.links', L); }} />
                <IconButton onClick={() => set('sideMenu.links', cfg.sideMenu.links.filter((_, j) => j !== i))}><DeleteIcon /></IconButton>
              </Stack>
            ))}
            {cfg.sideMenu.links.length < 8 && <Button startIcon={<AddIcon />} onClick={() => set('sideMenu.links', [...cfg.sideMenu.links, { label: '', url: '' }])}>Tambah link</Button>}
          </Stack>
        )}
      </Section>

      {GROUPS.map(([title, items]) => (
        <Section key={title} title={title}>
          <Grid container>
            {items.filter(([, , , only]) => !only || (only === 'url' ? !isLocal : isLocal)).map(([k, label, hint]) => (
              <Grid item xs={12} sm={6} key={k}><Toggle k={k} label={label} hint={hint} f={f} set={set} /></Grid>
            ))}
          </Grid>
          {title === 'Navigasi & tampilan' && f.confirmExit && (
            <TextField sx={{ mt: 1 }} label="Teks konfirmasi keluar" value={cfg.exitText} onChange={(e) => set('exitText', e.target.value.slice(0, 120))} />
          )}
          {title === 'Keamanan & data' && f.offlinePage && (
            <Box sx={{ mt: 1 }}>
              <ToggleButtonGroup exclusive size="small" value={errorMode} onChange={(_, v) => v && setErrorMode(v)}>
                <ToggleButton value="default">Halaman error bawaan</ToggleButton>
                <ToggleButton value="custom">HTML sendiri</ToggleButton>
                {cfg.errorPageFileId && <ToggleButton value="keep">Halaman lama</ToggleButton>}
              </ToggleButtonGroup>
              {errorMode === 'custom' && (
                <TextField sx={{ mt: 1 }} multiline minRows={5} label="HTML halaman error/offline" value={errorHtml} onChange={(e) => setErrorHtml(e.target.value)}
                  helperText='Tombol coba lagi: <button onclick="ApkifyBridge.retry()">Coba lagi</button>' InputProps={{ sx: { fontFamily: 'monospace', fontSize: 13 } }} />
              )}
            </Box>
          )}
        </Section>
      ))}

      <Section title="Izin aplikasi">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Hanya izin yang dicentang yang dimasukkan ke AndroidManifest. Izin diminta saat situs membutuhkannya.</Typography>
        <Grid container>{PERMS.map(([k, label]) => <Grid item xs={6} sm={3} key={k}><Toggle k={k} label={label} f={f} set={set} /></Grid>)}</Grid>
      </Section>

      <Section title="Browser & User-Agent">
        <Grid container>
          <Grid item xs={12} sm={4}><Toggle k="hideWebViewUA" label="Sembunyikan UA WebView" hint="Hapus penanda “wv” agar situs menganggapnya Chrome biasa" f={f} set={set} /></Grid>
          <Grid item xs={12} sm={4}><Toggle k="hideMobileUA" label="Sembunyikan UA Android/Mobile" f={f} set={set} /></Grid>
          <Grid item xs={12} sm={4}><Toggle k="desktopMode" label="Mode desktop" hint="Memuat versi desktop situs" f={f} set={set} /></Grid>
        </Grid>
        <TextField sx={{ mt: 1 }} label="Akhiran User-Agent (opsional)" value={cfg.userAgentSuffix} onChange={(e) => set('userAgentSuffix', e.target.value.slice(0, 40))}
          helperText="Mis. ApkifyApp — server Anda bisa mendeteksi pengunjung dari aplikasi" />
      </Section>

      <Section title="Monetisasi iklan" chip="AdMob · AppLovin · Unity · Meta · Start.io">
        <AdsSection cfg={cfg} set={set} Toggle={T} error={errors.ads} />
      </Section>

      <Section title="Push notification & live chat">
        <Toggle k="onesignal" label="Push notification (OneSignal)" f={f} set={set} />
        {f.onesignal && <TextField sx={{ mb: 2 }} label="OneSignal App ID" value={cfg.onesignal.appId} onChange={(e) => set('onesignal.appId', e.target.value.trim())} error={!!errors.onesignal} helperText={errors.onesignal || 'Dashboard OneSignal → Settings → Keys & IDs'} />}
        <Toggle k="tawk" label="Live chat Tawk.to" f={f} set={set} />
        {f.tawk && (
          <Stack direction="row" spacing={2}>
            <TextField label="Property ID" value={cfg.tawk.propertyId} onChange={(e) => set('tawk.propertyId', e.target.value.trim())} error={!!errors.tawk} helperText={errors.tawk || 'Dari link embed.tawk.to/PROPERTY/WIDGET'} />
            <TextField label="Widget ID" value={cfg.tawk.widgetId} onChange={(e) => set('tawk.widgetId', e.target.value.trim())} />
          </Stack>
        )}
      </Section>

      <Section title="Developer: JavaScript API, Supabase, Remote Update">
        <Toggle k="jsApi" label="JavaScript APIs (plugin native)" f={f} set={set} />
        {f.jsApi && (
          <Box component="pre" sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 2, fontSize: 12, overflow: 'auto', mt: 0 }}>{`document.addEventListener('apkifyready', async () => {
  Apkify.toast('Halo');          Apkify.vibrate(80);
  Apkify.share('Teks');          Apkify.copy('Teks');
  Apkify.open('https://...');    Apkify.keepScreenOn(true);
  Apkify.device(); Apkify.app(); Apkify.exit();
  // plugin (aktifkan di "Plugin native"):
  const { value } = await Apkify.scanQR();
  const { ok } = await Apkify.biometric('Masuk ke akun');
  await Apkify.requestReview();
  const { products } = await Apkify.iap.products(['premium']);
  const { purchases } = await Apkify.iap.purchase('premium');
  Apkify.storage.set('k', 'v');  const { token } = await Apkify.getPushToken();
  // rilis 5 — lihat /docs/api:
  const tag = await Apkify.nfc.read();            // {id, records:[{value}]}
  await Apkify.bt.print({ address, base64: Apkify.escpos().text('Halo').cut().base64() });
  const { text } = await Apkify.ocr.recognize({ url: foto.url });
  const r = await Apkify.ads.showRewarded();       // {rewarded, amount}
  Apkify.on('scan', (d) => console.log(d.data));  // scanner Zebra/Honeywell
});
document.addEventListener('apkifyshare', (e) => console.log(e.detail.text));`}</Box>
        )}
        <Toggle k="supabase" label="Backend Supabase" f={f} set={set} />
        {f.supabase && (
          <Stack spacing={2} sx={{ mb: 1 }}>
            <TextField label="Project URL" placeholder="https://xxxx.supabase.co" value={cfg.supabase.url} onChange={(e) => set('supabase.url', e.target.value.trim())} error={!!errors.supabase} helperText={errors.supabase} />
            <TextField label="Anon (public) key" value={cfg.supabase.anonKey} onChange={(e) => set('supabase.anonKey', e.target.value.trim())}
              helperText="Tersedia di halaman sebagai window.APKIFY.supabaseUrl & supabaseAnonKey. Lindungi data dengan Row Level Security. Jangan pernah memakai service_role key." />
          </Stack>
        )}
        <Toggle k="remoteUpdate" label="Remote Update" f={f} set={set} />
        {f.remoteUpdate && (
          <Typography variant="body2" color="text.secondary">
            Setelah build, kelola dari Studio: kirim pesan ke pengguna, paksa update versi lama{isLocal ? ', dan perbarui konten ZIP/HTML tanpa build ulang (OTA)' : ''}.
          </Typography>
        )}
      </Section>

      {error && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}
      {busy && (
        <Box sx={{ my: 2 }}>
          <Typography variant="body2" gutterBottom>{progress.label}</Typography>
          <LinearProgress variant={progress.value ? 'determinate' : 'indeterminate'} value={progress.value} />
        </Box>
      )}
      <Button size="large" variant="contained" fullWidth startIcon={<RocketLaunchIcon />} disabled={busy} onClick={submit} sx={{ mt: 2 }}>
        {busy ? 'Memproses…' : 'Build APK & AAB'}
      </Button>
    </Container>
  );
}
