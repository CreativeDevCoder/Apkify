// Menyiapkan proyek Xcode (XcodeGen + SwiftUI WKWebView) untuk iOS.
// Hasil: work-ios/ berisi project.yml, App/, www/ (bila lokal). Penandatanganan diatur lewat GITHUB_ENV.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { api, download, reportFailure, extractSource, semver, setEnv, mask, BUILD_ID } from './lib.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WORK = process.env.WORK_DIR || path.join(ROOT, 'work-ios');
const TMP = process.env.RUNNER_TEMP || '/tmp';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const hexRgb = (h) => [1, 3, 5].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3));

async function main() {
  const { config: c, versionCode, iconUrl, sourceUrl, splashUrl, appId, iosSigning } = await (await api(`/api/internal/builds/${BUILD_ID}/config?job=ios`)).json();
  console.log(`iOS: ${c.name} (${c.packageName}) v${c.versionName}/${versionCode} signed=${!!iosSigning}`);
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, 'ios-template'), WORK, { recursive: true });
  const APP = path.join(WORK, 'App');
  const local = c.source.type !== 'url';
  const F = c.features;

  if (local) await extractSource(c.source.type, sourceUrl, path.join(WORK, 'www'), TMP);

  // apkify.json (dibundel sebagai resource)
  fs.writeFileSync(path.join(APP, 'apkify.json'), JSON.stringify({
    name: c.name, startUrl: local ? '' : c.source.url, local, statusBar: c.colors.statusBar || '#000000', fullscreen: !!F.fullscreen,
    pullToRefresh: !!F.pullToRefresh, externalLinksInBrowser: F.externalLinksInBrowser !== false, zoom: !!F.zoom,
    userAgentSuffix: c.userAgentSuffix || '', customCss: c.customCss || '', customJs: c.customJs || '', jsApi: !!F.jsApi,
    linkRules: F.linkRules ? c.linkRules || [] : [],
    appJson: JSON.stringify({ appId, name: c.name, packageName: c.packageName, versionName: c.versionName, versionCode,
      ...(F.supabase ? { supabaseUrl: c.supabase.url, supabaseAnonKey: c.supabase.anonKey } : {}) }),
    errorHtml: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:-apple-system,system-ui;display:grid;place-items:center;min-height:90vh;text-align:center;color:#333}button{background:${c.colors.primary};color:#fff;border:0;border-radius:10px;padding:12px 22px;font-size:17px}</style></head><body><div><div style="font-size:52px">📡</div><h2>Tidak ada koneksi</h2><p>Periksa internet Anda, lalu coba lagi.</p><button onclick="window.webkit.messageHandlers.apkify.postMessage({cmd:'retry'})">Coba lagi</button></div></body></html>`
  }));

  // Info.plist
  const orient = { portrait: ['UIInterfaceOrientationPortrait'], landscape: ['UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'] }[c.orientation]
    || ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'];
  const arr = (a) => `<array>${a.map((x) => `<string>${x}</string>`).join('')}</array>`;
  const usage = [
    F.camera && ['NSCameraUsageDescription', 'Aplikasi membutuhkan kamera untuk fitur di halaman.'],
    F.microphone && ['NSMicrophoneUsageDescription', 'Aplikasi membutuhkan mikrofon untuk fitur di halaman.'],
    F.geolocation && ['NSLocationWhenInUseUsageDescription', 'Aplikasi membutuhkan lokasi Anda untuk fitur di halaman.'],
    F.fileUpload && ['NSPhotoLibraryUsageDescription', 'Aplikasi membutuhkan akses foto untuk mengunggah file.'],
    F.jsApi && ['NSFaceIDUsageDescription', 'Aplikasi memakai Face ID untuk verifikasi.']
  ].filter(Boolean);
  fs.writeFileSync(path.join(APP, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleDevelopmentRegion</key><string>id</string>
<key>CFBundleDisplayName</key><string>${esc(c.name)}</string>
<key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
<key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
<key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
<key>CFBundleName</key><string>$(PRODUCT_NAME)</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string>
<key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string>
<key>LSRequiresIPhoneOS</key><true/>
<key>ITSAppUsesNonExemptEncryption</key><false/>
<key>UILaunchScreen</key><dict><key>UIColorName</key><string>LaunchBg</string><key>UIImageName</key><string>LaunchLogo</string></dict>
<key>UIApplicationSceneManifest</key><dict><key>UIApplicationSupportsMultipleScenes</key><false/></dict>
<key>UISupportedInterfaceOrientations</key>${arr(orient)}
<key>UISupportedInterfaceOrientations~ipad</key>${arr(['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationPortraitUpsideDown', 'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'])}
${F.httpsOnly ? '' : '<key>NSAppTransportSecurity</key><dict><key>NSAllowsArbitraryLoads</key><true/></dict>'}
${usage.map(([k, v]) => `<key>${k}</key><string>${esc(v)}</string>`).join('\n')}
</dict></plist>
`);

  // Aset: ikon 1024 (tanpa alpha sesuai syarat App Store), logo & warna launch screen
  const A = path.join(APP, 'Assets.xcassets');
  const info = { info: { author: 'xcode', version: 1 } };
  fs.mkdirSync(path.join(A, 'AppIcon.appiconset'), { recursive: true });
  fs.mkdirSync(path.join(A, 'LaunchLogo.imageset'), { recursive: true });
  fs.mkdirSync(path.join(A, 'LaunchBg.colorset'), { recursive: true });
  fs.writeFileSync(path.join(A, 'Contents.json'), JSON.stringify(info));
  const iconPath = await download(new URL(iconUrl).pathname, path.join(TMP, 'ios-icon.png'));
  await sharp(iconPath).resize(1024, 1024, { fit: 'cover' }).flatten({ background: c.colors.splashBg || '#ffffff' }).png().toFile(path.join(A, 'AppIcon.appiconset', 'icon-1024.png'));
  fs.writeFileSync(path.join(A, 'AppIcon.appiconset', 'Contents.json'), JSON.stringify({ images: [{ filename: 'icon-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }], ...info }));
  const logoSrc = splashUrl ? await download(new URL(splashUrl).pathname, path.join(TMP, 'ios-splash.png')) : iconPath;
  await sharp(logoSrc).resize(240, 240, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(A, 'LaunchLogo.imageset', 'logo.png'));
  fs.writeFileSync(path.join(A, 'LaunchLogo.imageset', 'Contents.json'), JSON.stringify({ images: [{ filename: 'logo.png', idiom: 'universal', scale: '2x' }], ...info }));
  const [r, g, b] = hexRgb(c.colors.splashBg || '#ffffff');
  fs.writeFileSync(path.join(A, 'LaunchBg.colorset', 'Contents.json'), JSON.stringify({ colors: [{ color: { 'color-space': 'srgb', components: { red: r, green: g, blue: b, alpha: '1.000' } }, idiom: 'universal' }], ...info }));

  // project.yml
  let yml = fs.readFileSync(path.join(WORK, 'project.yml'), 'utf8');
  yml = yml.replace('__WWW__', local ? '      - path: www\n        type: folder\n        buildPhase: resources' : '')
    .replace('__BUNDLE__', c.packageName).replace('__VERSION__', semver(c.versionName)).replace('__BUILD__', String(versionCode))
    .replace('__TEAM__', iosSigning?.teamId || '').replace('__SIGNSTYLE__', iosSigning ? 'Manual' : 'Automatic');
  fs.writeFileSync(path.join(WORK, 'project.yml'), yml);

  // Penandatanganan (opsional): sertifikat .p12 + provisioning profile milik pengguna
  if (iosSigning) {
    const p12 = path.join(TMP, 'dist.p12');
    const prof = path.join(TMP, 'app.mobileprovision');
    fs.writeFileSync(p12, Buffer.from(iosSigning.p12, 'base64'));
    fs.writeFileSync(prof, Buffer.from(iosSigning.profile, 'base64'));
    mask(iosSigning.password);
    setEnv('IOS_SIGNED', '1');
    setEnv('IOS_P12', p12);
    setEnv('IOS_P12_PASS', iosSigning.password || '');
    setEnv('IOS_PROFILE', prof);
    setEnv('IOS_TEAM', iosSigning.teamId);
    setEnv('IOS_METHOD', iosSigning.method || 'app-store');
  } else setEnv('IOS_SIGNED', '0');
  setEnv('IOS_BUNDLE', c.packageName);
  console.log('Proyek iOS siap di', WORK);
}

main().catch(async (e) => {
  console.error(e);
  await reportFailure('building', e.user ? e.message : 'Gagal menyiapkan proyek iOS.', 'ios');
  fs.writeFileSync(path.join(TMP, 'reported'), '1');
  process.exit(1);
});
