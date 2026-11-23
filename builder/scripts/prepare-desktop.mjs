// Menyiapkan proyek Tauri (desktop) dari template: konfigurasi, ikon, konten lokal.
// ENV: JOB = windows | macos | linux
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { api, download, reportFailure, extractSource, semver, BUILD_ID } from './lib.mjs';

const JOB = process.env.JOB;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WORK = process.env.WORK_DIR || path.join(ROOT, 'work-desktop');
const TMP = process.env.RUNNER_TEMP || '/tmp';

async function main() {
  const { config: c, iconUrl, sourceUrl, appId } = await (await api(`/api/internal/builds/${BUILD_ID}/config?job=${JOB}`)).json();
  console.log(`Desktop ${JOB}: ${c.name} (${c.packageName}) v${c.versionName}`);
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.cpSync(path.join(ROOT, 'desktop-template'), WORK, { recursive: true, filter: (s) => !s.includes(`${path.sep}target`) });
  const TAURI = path.join(WORK, 'src-tauri');
  const local = c.source.type !== 'url';

  // Konten
  const dist = path.join(WORK, 'dist');
  if (local) {
    fs.rmSync(dist, { recursive: true, force: true });
    await extractSource(c.source.type, sourceUrl, dist, TMP);
  }

  // Konfigurasi runtime (disematkan ke binary)
  const D = c.desktop || {};
  const runtime = {
    name: c.name, startUrl: local ? 'tauri://localhost/' : c.source.url, local,
    width: D.width || 1200, height: D.height || 800, resizable: D.resizable !== false, fullscreen: !!D.fullscreen,
    alwaysOnTop: !!D.alwaysOnTop, maximized: !!D.maximized, externalLinksInBrowser: c.features.externalLinksInBrowser !== false,
    linkRules: c.features.linkRules ? c.linkRules || [] : [], customCss: c.customCss || '', customJs: c.customJs || '',
    appJson: JSON.stringify({ appId, name: c.name, packageName: c.packageName, versionName: c.versionName })
  };
  fs.writeFileSync(path.join(TAURI, 'apkify.json'), JSON.stringify(runtime));

  // tauri.conf.json
  const conf = JSON.parse(fs.readFileSync(path.join(TAURI, 'tauri.conf.json'), 'utf8'));
  conf.productName = c.name.replace(/[<>:"/\\|?*]/g, '').trim() || 'App';
  conf.version = semver(c.versionName);
  conf.identifier = c.packageName;
  conf.bundle.shortDescription = c.name;
  conf.bundle.publisher = c.name;
  conf.bundle.category = 'Utility';
  conf.bundle.windows = { nsis: { installMode: 'currentUser' }, webviewInstallMode: { type: 'downloadBootstrapper' } };
  conf.bundle.macOS = { minimumSystemVersion: '10.15' };
  fs.writeFileSync(path.join(TAURI, 'tauri.conf.json'), JSON.stringify(conf, null, 2));

  // Ikon semua ukuran (PNG/ICO/ICNS) dari ikon aplikasi
  const iconPath = await download(new URL(iconUrl).pathname, path.join(TMP, 'icon-src.png'));
  const big = path.join(TMP, 'icon-1024.png');
  await sharp(iconPath).resize(1024, 1024, { fit: 'cover' }).png().toFile(big);
  fs.rmSync(path.join(TAURI, 'icons'), { recursive: true, force: true });
  const win = process.platform === 'win32';
  execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: WORK, stdio: 'inherit', shell: win });
  execFileSync('npx', ['tauri', 'icon', big, '-o', path.join(TAURI, 'icons')], { cwd: WORK, stdio: 'inherit', shell: win });
  console.log('Proyek desktop siap di', WORK);
}

main().catch(async (e) => {
  console.error(e);
  await reportFailure('building', e.user ? e.message : `Gagal menyiapkan proyek ${JOB}.`, JOB);
  fs.writeFileSync(path.join(TMP, 'reported'), '1');
  process.exit(1);
});
