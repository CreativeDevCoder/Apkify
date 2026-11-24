// Menyiapkan proyek Android dari template + konfigurasi build:
// 1. ambil konfigurasi dari Worker
// 2. salin android-template -> work/
// 3. tulis apkify.json, strings, colors, manifest, ikon, splash, konten ZIP/HTML
// 4. pakai keystore lama untuk package ini, atau buat baru lalu simpan (terenkripsi) di Worker
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { api, download, mask, setEnv, reportFailure, BUILD_ID, extractZip } from './lib.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WORK = process.env.WORK_DIR || path.join(ROOT, 'work');
const TMP = process.env.RUNNER_TEMP || '/tmp';
const RES = path.join(WORK, 'app/src/main/res');
const ASSETS = path.join(WORK, 'app/src/main/assets');

const xml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "\\'" }[c]));

class UserError extends Error {}

async function main() {
  const cfgRes = await api(`/api/internal/builds/${BUILD_ID}/config`);
  const { config: c, versionCode, keystore, iconUrl, sourceUrl, splashUrl, errorPageUrl, fcmUrl, altIconUrls = [], appId, apiBase } = await cfgRes.json();
  console.log(`Build ${BUILD_ID}: ${c.name} (${c.packageName}) v${c.versionName}/${versionCode} sumber=${c.source.type}`);

  fs.rmSync(WORK, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, 'android-template'), WORK, { recursive: true });
  fs.mkdirSync(ASSETS, { recursive: true });

  // ---- Konfigurasi runtime untuk aplikasi (dibaca MainActivity) ----
  // konten lokal disajikan di root origin -> path absolut & BrowserRouter (history API) berjalan
  const LOCAL_URL = 'https://appassets.androidplatform.net/';
  const runtime = {
    name: c.name,
    packageName: c.packageName,
    versionName: c.versionName,
    versionCode,
    startUrl: c.source.type === 'url' ? c.source.url : LOCAL_URL,
    local: c.source.type !== 'url',
    colors: c.colors,
    features: c.features,
    sideMenu: c.sideMenu,
    admob: c.admob,
    onesignal: c.onesignal,
    userAgentSuffix: c.userAgentSuffix || '',
    appId, apiBase,
    exitText: c.exitText || 'Keluar dari aplikasi?',
    splashDurationMs: c.splash?.durationMs || 0,
    progress: c.progress || { style: 'bar' },
    tawk: c.features.tawk ? c.tawk : null,
    supabase: c.features.supabase ? c.supabase : null,
    bottomNav: c.bottomNav || { items: [] }, fab: c.fab || {}, shortcuts: c.shortcuts || [], linkRules: c.linkRules || [],
    customCss: c.customCss || '', customJs: c.customJs || '',
    // rilis 5: plugin native & iklan
    ads: c.ads || {}, google: c.google || {}, appLock: c.appLock || {}, widget: c.widget || {}, tile: c.tile || {},
    kiosk: c.kiosk || {}, integrity: c.integrity || {}, nfc: c.nfc || {},
    encrypted: c.source.type !== 'url' && c.features.encrypt !== false
  };
  fs.writeFileSync(path.join(ASSETS, 'apkify.json'), JSON.stringify(runtime, null, 2));

  // ---- strings & colors ----
  fs.writeFileSync(path.join(RES, 'values/strings.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <string name="app_name">${xml(c.name)}</string>\n</resources>\n`);
  fs.writeFileSync(path.join(RES, 'values/colors.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="primary">${c.colors.primary}</color>\n  <color name="accent">${c.colors.accent || c.colors.primary}</color>\n  <color name="status_bar">${c.colors.statusBar}</color>\n  <color name="splash_bg">${c.colors.splashBg}</color>\n  <color name="icon_bg">#FFFFFF</color>\n</resources>\n`);

  // ---- Manifest ----
  const perms = ['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE'];
  const F = c.features;
  if (F.geolocation) perms.push('android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION');
  if (F.camera) perms.push('android.permission.CAMERA');
  if (F.microphone) perms.push('android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS');
  if (F.onesignal || F.notifications || F.fcm) perms.push('android.permission.POST_NOTIFICATIONS');
  if (F.vibrate || F.jsApi) perms.push('android.permission.VIBRATE');
  if (F.keepAwake) perms.push('android.permission.WAKE_LOCK');
  if (F.downloads || F.saveGallery) perms.push('android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28');
  // ---- Rilis 5: izin plugin native (tanpa izin yang butuh persetujuan khusus Google Play) ----
  const feats = [];
  if (F.nfc) { perms.push('android.permission.NFC'); feats.push('android.hardware.nfc'); }
  if (F.nfc && F.nfcHce) feats.push('android.hardware.nfc.hce');
  if (F.bluetooth) {
    perms.push('android.permission.BLUETOOTH" android:maxSdkVersion="30', 'android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30',
      'android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation', 'android.permission.BLUETOOTH_CONNECT');
    if (!F.geolocation && !F.locationApi && !F.geofence) perms.push('android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30');
    feats.push('android.hardware.bluetooth', 'android.hardware.bluetooth_le');
  }
  if (F.usb) feats.push('android.hardware.usb.host');
  if (F.sensors || F.activityRecognition) perms.push('android.permission.ACTIVITY_RECOGNITION');
  if (F.activityRecognition) perms.push('com.google.android.gms.permission.ACTIVITY_RECOGNITION');
  if (F.infrared) { perms.push('android.permission.TRANSMIT_IR'); feats.push('android.hardware.consumerir'); }
  if (F.localNotifications || F.backgroundSync) perms.push('android.permission.POST_NOTIFICATIONS');
  if (F.localNotifications || F.autoStart) perms.push('android.permission.RECEIVE_BOOT_COMPLETED');
  if (F.backgroundAudio) perms.push('android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK', 'android.permission.POST_NOTIFICATIONS', 'android.permission.WAKE_LOCK');
  if (F.audioRecord) perms.push('android.permission.RECORD_AUDIO');
  if (F.contacts && F.contactsRead) perms.push('android.permission.READ_CONTACTS');
  if (F.phoneCall && F.directCall) { perms.push('android.permission.CALL_PHONE'); feats.push('android.hardware.telephony'); }
  if (F.locationApi || F.geofence) perms.push('android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION');
  if (F.kiosk) perms.push('android.permission.REORDER_TASKS');
  const permLines = [...new Set(perms)];
  const orientation = { portrait: 'portrait', landscape: 'landscape' }[c.orientation] || 'unspecified';
  let manifest = fs.readFileSync(path.join(WORK, 'app/src/main/AndroidManifest.xml'), 'utf8');
  manifest = manifest
    .replace('<!--PERMISSIONS-->', permLines.map((p) => `<uses-permission android:name="${p}" />`).join('\n    '))
    .replace('__ORIENTATION__', orientation)
    .replace('<!--ADMOB-->', adsMeta(c))
    .replace('<!--FEATURES-->', feats.map((f) => `<uses-feature android:name="${f}" android:required="false" />`).join('\n    ') + '\n    <!--FEATURES-->')
    .replace('__ACTIVITY_ATTRS__', F.pip ? 'android:supportsPictureInPicture="true"\n            android:resizeableActivity="true"' : '')
    .replace('<!--COMPONENTS-->', components(c) + '\n        <!--COMPONENTS-->')
    .replace('android:usesCleartextTraffic="false"', `android:usesCleartextTraffic="${F.httpsOnly ? 'false' : 'true'}"`);
  // Deep linking: tautan ke domain situs dibuka langsung di aplikasi
  if (F.deepLinking && c.source.type === 'url') {
    const host = new URL(c.source.url).hostname;
    manifest = manifest.replace('<!--DEEPLINK-->', `<!--DEEPLINK-->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="${xml(host)}" />
                <data android:scheme="http" android:host="${xml(host)}" />
            </intent-filter>`);
  }
  // Share target: aplikasi muncul di menu "Bagikan" Android
  if (F.shareTarget) {
    manifest = manifest.replace('<!--DEEPLINK-->', `<!--DEEPLINK-->
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="text/plain" />
            </intent-filter>`);
  }
  // Android TV: muncul di launcher TV + banner
  if (F.androidTv) {
    manifest = manifest
      .replace('<category android:name="android.intent.category.LAUNCHER" />', '<category android:name="android.intent.category.LAUNCHER" />\n                <category android:name="android.intent.category.LEANBACK_LAUNCHER" />')
      .replace('<!--FEATURES-->', '<uses-feature android:name="android.software.leanback" android:required="false" />\n    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />\n    <!--FEATURES-->')
      .replace('android:roundIcon="@mipmap/ic_launcher_round"', 'android:roundIcon="@mipmap/ic_launcher_round"\n        android:banner="@drawable/tv_banner"');
  }
  // Firebase Cloud Messaging
  if ((F.fcm || F.firebaseAnalytics || F.crashlytics) && fcmUrl) {
    await download(new URL(fcmUrl).pathname, path.join(WORK, 'app', 'google-services.json'));
    const gs = JSON.parse(fs.readFileSync(path.join(WORK, 'app', 'google-services.json'), 'utf8'));
    if (!(gs.client || []).some((x) => x.client_info?.android_client_info?.package_name === c.packageName)) {
      throw new UserError(`google-services.json tidak memuat package ${c.packageName}. Tambahkan aplikasi Android dengan package ini di Firebase Console.`);
    }
    if (F.fcm) manifest = manifest.replace('<!--ADMOB-->', `<!--ADMOB-->
        <service android:name=".FcmService" android:exported="false">
            <intent-filter><action android:name="com.google.firebase.MESSAGING_EVENT" /></intent-filter>
        </service>`);
  }
  // Kiosk sebagai launcher (HOME): perangkat langsung membuka aplikasi ini saat menyala
  if (F.kiosk && c.kiosk?.launcher) {
    manifest = manifest.replace('<category android:name="android.intent.category.LAUNCHER" />', '<category android:name="android.intent.category.LAUNCHER" />\n                <category android:name="android.intent.category.HOME" />\n                <category android:name="android.intent.category.DEFAULT" />');
  }
  // Ikon alternatif (ganti ikon dari JS): launcher dipindah ke activity-alias
  if (F.altIcons && altIconUrls.length) {
    const m = manifest.match(/            <intent-filter>\s*<action android:name="android.intent.action.MAIN" \/>[\s\S]*?<\/intent-filter>\n/);
    if (m) {
      manifest = manifest.replace(m[0], '');
      const filter = m[0].replace(/^ {12}/gm, '            ');
      const alias = (name, icon, enabled) => `        <activity-alias
            android:name=".${name}"
            android:enabled="${enabled}"
            android:exported="true"
            android:icon="@mipmap/${icon}"
            android:roundIcon="@mipmap/${icon}"
            android:targetActivity=".MainActivity">
${filter}        </activity-alias>`;
      const aliases = [alias('IconDefault', 'ic_launcher', true), ...altIconUrls.map((_, i) => alias(`IconAlt${i + 1}`, `ic_launcher_alt${i + 1}`, false))];
      manifest = manifest.replace('    </application>', aliases.join('\n') + '\n    </application>');
    }
  }
  // HCE: AID tambahan
  if (F.nfc && F.nfcHce && Array.isArray(c.nfc?.aids)) {
    const p = path.join(RES, 'xml/apduservice.xml');
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('<!--AIDS-->', c.nfc.aids.map((a) => `<aid-filter android:name="${xml(a)}" />`).join('\n        ')));
  }
  // Facebook Login: App ID & Client Token
  if (F.facebookLogin) {
    fs.writeFileSync(path.join(RES, 'values/strings.xml'), fs.readFileSync(path.join(RES, 'values/strings.xml'), 'utf8')
      .replace('</resources>', `  <string name="facebook_app_id">${xml(c.facebook?.appId || '')}</string>\n  <string name="facebook_client_token">${xml(c.facebook?.clientToken || '')}</string>\n</resources>`));
  }
  if (c.features.camera || F.nativeCamera) manifest = manifest.replace('<!--FEATURES-->', '<uses-feature android:name="android.hardware.camera" android:required="false" />\n    <!--FEATURES-->');
  fs.writeFileSync(path.join(WORK, 'app/src/main/AndroidManifest.xml'), manifest);

  // ---- Ikon launcher, adaptive icon, splash ----
  const iconPath = await download(new URL(iconUrl).pathname, path.join(TMP, 'icon.png'));
  const icon = sharp(iconPath).ensureAlpha();
  const meta = await icon.metadata();
  if ((meta.width || 0) < 192) throw new UserError('Ikon terlalu kecil (minimal 192×192 px).');
  const { data: px } = await sharp(iconPath).ensureAlpha().extract({ left: 1, top: 1, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  const bg = px[3] > 200 ? `#${[px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}` : '#FFFFFF';
  fs.writeFileSync(path.join(RES, 'values/colors.xml'), fs.readFileSync(path.join(RES, 'values/colors.xml'), 'utf8').replace('#FFFFFF', bg));

  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(dens)) {
    const dir = path.join(RES, `mipmap-${d}`);
    fs.mkdirSync(dir, { recursive: true });
    const s = Math.round(48 * k);
    await sharp(iconPath).resize(s, s, { fit: 'cover' }).png().toFile(path.join(dir, 'ic_launcher.png'));
    const r = s / 2;
    const circle = Buffer.from(`<svg width="${s}" height="${s}"><circle cx="${r}" cy="${r}" r="${r}"/></svg>`);
    await sharp(iconPath).resize(s, s, { fit: 'cover' }).composite([{ input: circle, blend: 'dest-in' }]).png().toFile(path.join(dir, 'ic_launcher_round.png'));
    // adaptive foreground: kanvas 108dp, ikon 72dp di tengah (safe zone ~66dp)
    const fg = Math.round(108 * k), inner = Math.round(72 * k);
    await sharp({ create: { width: fg, height: fg, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await sharp(iconPath).resize(inner, inner, { fit: 'cover' }).png().toBuffer(), gravity: 'center' }])
      .png().toFile(path.join(dir, 'ic_launcher_foreground.png'));
  }
  // Ikon alternatif
  if (F.altIcons) {
    for (const [i, u] of altIconUrls.entries()) {
      const p = await download(new URL(u).pathname, path.join(TMP, `alt${i + 1}.png`));
      for (const [d, k] of Object.entries(dens)) {
        const s = Math.round(48 * k);
        await sharp(p).resize(s, s, { fit: 'cover' }).png().toFile(path.join(RES, `mipmap-${d}`, `ic_launcher_alt${i + 1}.png`));
      }
    }
  }
  const nodpi = path.join(RES, 'drawable-nodpi');
  fs.mkdirSync(nodpi, { recursive: true });
  // Splash: gambar kustom (bila diunggah) atau ikon aplikasi
  const splashSrc = splashUrl ? await download(new URL(splashUrl).pathname, path.join(TMP, 'splash.png')) : iconPath;
  await sharp(splashSrc).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(nodpi, 'splash_logo.png'));

  // Banner Android TV (320x180)
  if (F.androidTv) {
    const ic = await sharp(iconPath).resize(140, 140, { fit: 'cover' }).png().toBuffer();
    await sharp({ create: { width: 320, height: 180, channels: 4, background: c.colors.primary } })
      .composite([{ input: ic, gravity: 'center' }]).png().toFile(path.join(RES, 'drawable-nodpi', 'tv_banner.png'));
  }

  // Halaman error kustom
  if (errorPageUrl) await download(new URL(errorPageUrl).pathname, path.join(ASSETS, 'error.html'));

  // ---- Konten lokal (ZIP / HTML) ----
  if (c.source.type !== 'url') {
    const www = path.join(ASSETS, 'www');
    fs.mkdirSync(www, { recursive: true });
    if (c.source.type === 'html') {
      await download(new URL(sourceUrl).pathname, path.join(www, 'index.html'));
    } else {
      const zip = await download(new URL(sourceUrl).pathname, path.join(TMP, 'source.zip'));
      // ZIP siap pakai (index.html) atau kode sumber React/Vite/Vue/Svelte (package.json -> di-build otomatis)
      try { await extractZip(zip, www, TMP); } catch (e) { throw e.user ? new UserError(e.message) : e; }
    }
  }

  // ---- Enkripsi konten lokal (AES-256-GCM, kunci acak per build di dalam kode ter-obfuscate) ----
  if (runtime.encrypted) encryptAssets();

  // ---- Keystore (sama untuk setiap build package yang sama) ----
  const ksFile = path.join(TMP, 'upload.jks');
  let ks = keystore;
  if (!ks) {
    fs.rmSync(ksFile, { force: true });
    const pass = crypto.randomBytes(24).toString('base64url');
    mask(pass);
    const cn = c.name.replace(/[,=+<>#;"\\]/g, ' ').trim() || 'App';
    execFileSync('keytool', ['-genkeypair', '-keystore', ksFile, '-storetype', 'PKCS12', '-alias', 'upload', '-keyalg', 'RSA', '-keysize', '2048',
      '-validity', '10000', '-storepass', pass, '-keypass', pass, '-dname', `CN=${cn}, O=${cn}, C=ID`], { stdio: 'inherit' });
    ks = { keystore: fs.readFileSync(ksFile).toString('base64'), storePass: pass, keyPass: pass, alias: 'upload' };
    try {
      await api('/api/internal/keystores', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ buildId: BUILD_ID, ...ks }) });
      console.log('Keystore baru dibuat & disimpan.');
    } catch (e) {
      if (e.status !== 409) throw e;
      // build paralel lain sudah membuat keystore -> pakai yang itu
      const again = await (await api(`/api/internal/builds/${BUILD_ID}/config`)).json();
      ks = again.keystore;
    }
  }
  mask(ks.storePass);
  mask(ks.keyPass);
  fs.writeFileSync(ksFile, Buffer.from(ks.keystore, 'base64'));
  if (ks.custom) {
    // keystore unggahan pengguna: pastikan password & alias benar sebelum Gradle
    try {
      execFileSync('keytool', ['-list', '-keystore', ksFile, '-storepass', ks.storePass, '-alias', ks.alias], { stdio: 'pipe' });
    } catch {
      throw new UserError('Keystore Anda tidak bisa dibuka: password atau alias salah. Unggah ulang keystore dengan data yang benar.');
    }
  }
  setEnv('KS_FILE', ksFile);
  setEnv('KS_STORE_PASS', ks.storePass);
  setEnv('KS_KEY_PASS', ks.keyPass);
  setEnv('KS_ALIAS', ks.alias);
  // Sidik jari SHA-256 sertifikat -> untuk assetlinks.json (Android App Links terverifikasi)
  try {
    const out = execFileSync('keytool', ['-list', '-v', '-keystore', ksFile, '-storepass', ks.storePass, '-alias', ks.alias], { encoding: 'utf8' });
    const sha = (out.match(/SHA256:\s*([0-9A-F:]{95})/i) || [])[1];
    if (sha) await api(`/api/internal/builds/${BUILD_ID}/meta`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sha256: sha }) });
  } catch (e) { console.warn('SHA-256 tidak terbaca:', e.message); }
  console.log('Proyek siap di', WORK);
}

/** meta-data jaringan iklan (wajib ada sebelum SDK diinisialisasi) */
function adsMeta(c) {
  const a = c.ads || {};
  const net = a.network || (c.features.admob ? 'admob' : '');
  const out = [];
  const appId = a.admob?.appId || c.admob?.appId;
  if (net === 'admob' && appId) out.push(`<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="${xml(appId)}" />`);
  if ((net === 'applovin' || (net === 'admob' && (a.mediation || []).includes('applovin'))) && a.applovin?.sdkKey) out.push(`<meta-data android:name="applovin.sdk.key" android:value="${xml(a.applovin.sdkKey)}" />`);
  return out.join('\n        ');
}

/** service/receiver/meta-data sesuai fitur */
function components(c) {
  const F = c.features, out = [];
  if (F.nfc && F.nfcHce) out.push(`<service android:name=".HceService" android:exported="true" android:permission="android.permission.BIND_NFC_SERVICE">
            <intent-filter><action android:name="android.nfc.cardemulation.action.HOST_APDU_SERVICE" /></intent-filter>
            <meta-data android:name="android.nfc.cardemulation.host_apdu_service" android:resource="@xml/apduservice" />
        </service>`);
  if (F.localNotifications || F.autoStart) out.push(`<receiver android:name=".NotifyReceiver" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.QUICKBOOT_POWERON" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>`);
  if (F.backgroundAudio) out.push(`<service android:name=".MediaService" android:exported="false" android:foregroundServiceType="mediaPlayback" />`);
  if (F.widget) out.push(`<receiver android:name=".AppWidget" android:exported="true" android:label="@string/app_name">
            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_info" />
        </receiver>`);
  if (F.quickTile) out.push(`<service android:name=".QsTile" android:exported="true" android:icon="@drawable/ic_nav_${xml(c.tile?.icon || 'apps')}" android:label="${xml(c.tile?.label || c.name)}" android:permission="android.permission.BIND_QUICK_SETTINGS_TILE">
            <intent-filter><action android:name="android.service.quicksettings.action.QS_TILE" /></intent-filter>
        </service>`);
  if (F.mdm) out.push('<meta-data android:name="android.content.APP_RESTRICTIONS" android:resource="@xml/app_restrictions" />');
  if (F.cast) out.push('<meta-data android:name="com.google.android.gms.cast.framework.OPTIONS_PROVIDER_CLASS_NAME" android:value="app.apkify.shell.mod.CastOptionsProvider" />');
  if (F.facebookLogin) out.push('<meta-data android:name="com.facebook.sdk.ApplicationId" android:value="@string/facebook_app_id" />\n        <meta-data android:name="com.facebook.sdk.ClientToken" android:value="@string/facebook_client_token" />');
  return out.join('\n        ');
}

function encryptAssets() {
  const www = path.join(ASSETS, 'www');
  const out = path.join(ASSETS, 'www_enc');
  const key = crypto.randomBytes(32);
  let n = 0;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      const rel = path.relative(www, p);
      const iv = crypto.randomBytes(12);
      const ci = crypto.createCipheriv('aes-256-gcm', key, iv);
      const ct = Buffer.concat([ci.update(fs.readFileSync(p)), ci.final()]);
      const dest = path.join(out, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      // format: iv(12) | ciphertext | tag(16)  — cocok dengan Cipher "AES/GCM/NoPadding" di Android
      fs.writeFileSync(dest, Buffer.concat([iv, ct, ci.getAuthTag()]));
      n++;
    }
  };
  walk(www);
  fs.rmSync(www, { recursive: true, force: true });
  // Kunci dipecah jadi dua array XOR agar tidak muncul utuh sebagai string di APK
  const mask = crypto.randomBytes(32);
  const sb = (v) => (v > 127 ? v - 256 : v); // representasi Byte bertanda Kotlin
  const a = [...key].map((v, i) => sb(v ^ mask[i]));
  const b = [...mask].map(sb);
  fs.writeFileSync(path.join(WORK, 'app/src/main/java/app/apkify/shell/K.kt'),
    `package app.apkify.shell\n\ninternal object K {\n    private val a = byteArrayOf(${a.join(', ')})\n    private val b = byteArrayOf(${b.join(', ')})\n    fun k(): ByteArray = ByteArray(a.size) { i -> (a[i].toInt() xor b[i].toInt()).toByte() }\n}\n`);
  console.log(`Enkripsi ${n} file konten.`);
}

main().catch(async (e) => {
  console.error(e);
  const msg = e instanceof UserError ? e.message : 'Gagal menyiapkan proyek (unduh konfigurasi/ikon/sumber).';
  await reportFailure('building', msg);
  fs.writeFileSync(path.join(process.env.RUNNER_TEMP || '/tmp', 'reported'), '1');
  process.exit(1);
});
