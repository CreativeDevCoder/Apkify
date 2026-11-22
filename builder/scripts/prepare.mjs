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
import { api, download, mask, setEnv, reportFailure, BUILD_ID } from './lib.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WORK = process.env.WORK_DIR || path.join(ROOT, 'work');
const TMP = process.env.RUNNER_TEMP || '/tmp';
const RES = path.join(WORK, 'app/src/main/res');
const ASSETS = path.join(WORK, 'app/src/main/assets');

const xml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": "\\'" }[c]));

class UserError extends Error {}

async function main() {
  const cfgRes = await api(`/api/internal/builds/${BUILD_ID}/config`);
  const { config: c, versionCode, keystore, iconUrl, sourceUrl, splashUrl, errorPageUrl, appId, apiBase } = await cfgRes.json();
  console.log(`Build ${BUILD_ID}: ${c.name} (${c.packageName}) v${c.versionName}/${versionCode} sumber=${c.source.type}`);

  fs.rmSync(WORK, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, 'android-template'), WORK, { recursive: true });
  fs.mkdirSync(ASSETS, { recursive: true });

  // ---- Konfigurasi runtime untuk aplikasi (dibaca MainActivity) ----
  const LOCAL_URL = 'https://appassets.androidplatform.net/assets/www/index.html';
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
  if (F.onesignal || F.notifications) perms.push('android.permission.POST_NOTIFICATIONS');
  if (F.vibrate || F.jsApi) perms.push('android.permission.VIBRATE');
  if (F.keepAwake) perms.push('android.permission.WAKE_LOCK');
  if (F.downloads) perms.push('android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28');
  const orientation = { portrait: 'portrait', landscape: 'landscape' }[c.orientation] || 'unspecified';
  let manifest = fs.readFileSync(path.join(WORK, 'app/src/main/AndroidManifest.xml'), 'utf8');
  manifest = manifest
    .replace('<!--PERMISSIONS-->', perms.map((p) => `<uses-permission android:name="${p}" />`).join('\n    '))
    .replace('__ORIENTATION__', orientation)
    .replace('<!--ADMOB-->', c.features.admob
      ? `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="${xml(c.admob.appId)}" />`
      : '')
    .replace('android:usesCleartextTraffic="false"', `android:usesCleartextTraffic="${F.httpsOnly ? 'false' : 'true'}"`);
  // Deep linking: tautan ke domain situs dibuka langsung di aplikasi
  if (F.deepLinking && c.source.type === 'url') {
    const host = new URL(c.source.url).hostname;
    manifest = manifest.replace('<!--DEEPLINK-->', `<intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="${xml(host)}" />
                <data android:scheme="http" android:host="${xml(host)}" />
            </intent-filter>`);
  }
  if (c.features.camera) manifest = manifest.replace('<!--FEATURES-->', '<uses-feature android:name="android.hardware.camera" android:required="false" />');
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
  const nodpi = path.join(RES, 'drawable-nodpi');
  fs.mkdirSync(nodpi, { recursive: true });
  // Splash: gambar kustom (bila diunggah) atau ikon aplikasi
  const splashSrc = splashUrl ? await download(new URL(splashUrl).pathname, path.join(TMP, 'splash.png')) : iconPath;
  await sharp(splashSrc).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(nodpi, 'splash_logo.png'));

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
      // unzip menolak path "../" (zip-slip) secara default
      execFileSync('unzip', ['-q', '-o', zip, '-d', www], { stdio: 'inherit' });
      // kasus umum: ZIP berisi satu folder (mis. dist/) -> naikkan isinya
      let entries = fs.readdirSync(www).filter((e) => !e.startsWith('__MACOSX') && e !== '.DS_Store');
      if (!fs.existsSync(path.join(www, 'index.html')) && entries.length === 1 && fs.statSync(path.join(www, entries[0])).isDirectory()) {
        const inner = path.join(www, entries[0]);
        for (const e of fs.readdirSync(inner)) fs.renameSync(path.join(inner, e), path.join(www, e));
        fs.rmSync(inner, { recursive: true, force: true });
      }
      fs.rmSync(path.join(www, '__MACOSX'), { recursive: true, force: true });
      if (!fs.existsSync(path.join(www, 'index.html'))) throw new UserError('ZIP tidak berisi index.html di folder utama.');
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
  console.log('Proyek siap di', WORK);
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
