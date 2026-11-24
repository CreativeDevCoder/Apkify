import fs from 'node:fs';

export const API = (process.env.API_BASE || '').replace(/\/$/, '');
export const BUILD_ID = process.env.BUILD_ID;
export const AUTH = { authorization: `Bearer ${process.env.BUILDER_SECRET}` };

export async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...AUTH, ...(init.headers || {}) } });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    const e = new Error(`${init.method || 'GET'} ${path} -> ${res.status} ${t.slice(0, 300)}`);
    e.status = res.status;
    throw e;
  }
  return res;
}

export async function download(path, dest) {
  const res = await api(path);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

/** Sembunyikan nilai rahasia dari log Actions */
export function mask(v) {
  if (v) console.log(`::add-mask::${v}`);
}

export function setEnv(name, value) {
  fs.appendFileSync(process.env.GITHUB_ENV, `${name}<<__EOF__\n${value}\n__EOF__\n`);
}

export async function reportFailure(stage, message, job = process.env.JOB || 'android') {
  await api(`/api/internal/builds/${BUILD_ID}/finish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ job, status: 'failed', failedAt: stage, error: message, logUrl: process.env.LOG_URL })
  }).catch((e) => console.error('reportFailure:', e.message));
}

/** Unduh & ekstrak sumber ZIP/HTML ke folder tujuan (index.html di root). Dipakai builder desktop & iOS. */
export async function extractSource(type, sourceUrl, dest, tmp) {
  const path = await import('node:path');
  fs.mkdirSync(dest, { recursive: true });
  // konten sudah disiapkan job "source" (ZIP diekstrak/di-build sekali di Linux)
  const pre = process.env.PREBUILT_SITE;
  if (pre && fs.existsSync(path.join(pre, 'index.html'))) { copySafe(pre, dest); return; }
  if (type === 'html') {
    await download(new URL(sourceUrl).pathname, path.join(dest, 'index.html'));
    return;
  }
  const zip = await download(new URL(sourceUrl).pathname, path.join(tmp, 'source.zip'));
  await extractZip(zip, dest, tmp);
}

const userError = (m) => Object.assign(new Error(m), { user: true });

/**
 * Ekstrak ZIP ke dest. Bila berisi kode sumber (package.json tanpa index.html hasil build),
 * proyek di-build otomatis (React/Vite/Vue/Svelte/CRA/Angular...) lalu hasilnya disalin ke dest.
 */
export async function extractZip(zip, dest, tmp) {
  const { execFileSync } = await import('node:child_process');
  const path = await import('node:path');
  const raw = path.join(tmp, 'src-raw');
  fs.rmSync(raw, { recursive: true, force: true });
  fs.mkdirSync(raw, { recursive: true });
  // unzip menolak path "../" (zip-slip) secara default
  execFileSync('unzip', ['-q', '-o', zip, '-d', raw], { stdio: 'inherit' });
  fs.rmSync(path.join(raw, '__MACOSX'), { recursive: true, force: true });
  // kasus umum: ZIP berisi satu folder (mis. dist/ atau nama-proyek/) -> pakai isinya
  let root = raw;
  const entries = fs.readdirSync(raw).filter((e) => e !== '.DS_Store');
  if (!fs.existsSync(path.join(raw, 'index.html')) && !fs.existsSync(path.join(raw, 'package.json')) && entries.length === 1 && fs.statSync(path.join(raw, entries[0])).isDirectory()) {
    root = path.join(raw, entries[0]);
  }
  let site = root;
  if (fs.existsSync(path.join(root, 'package.json')) && isSourceProject(root)) {
    site = buildProject(root, tmp);
  }
  if (!fs.existsSync(path.join(site, 'index.html'))) throw userError('ZIP tidak berisi index.html (atau package.json dengan skrip "build").');
  fs.mkdirSync(dest, { recursive: true });
  copySafe(site, dest);
}

/** package.json + index.html sumber (Vite) atau tanpa index.html sama sekali -> perlu di-build */
function isSourceProject(dir) {
  const pkg = JSON.parse(fs.readFileSync(`${dir}/package.json`, 'utf8'));
  if (!pkg.scripts?.build) return false;
  const html = fs.existsSync(`${dir}/index.html`) ? fs.readFileSync(`${dir}/index.html`, 'utf8') : '';
  // index.html Vite merujuk /src/main.(j|t)sx — bukan hasil build
  return !html || /<script[^>]+src=["']\/?src\//.test(html) || fs.existsSync(`${dir}/vite.config.js`) || fs.existsSync(`${dir}/vite.config.ts`);
}

/**
 * Build kode sumber di kontainer Docker terisolasi: tanpa variabel lingkungan/secret runner,
 * hanya folder proyek yang di-mount, batas memori & waktu. Kode pengguna tidak bisa membaca secret.
 */
function buildProject(dir, tmp) {
  const { execFileSync } = require_('node:child_process');
  try { execFileSync('docker', ['version'], { stdio: 'ignore' }); } catch {
    throw userError('Build kode sumber butuh Docker (tersedia di runner Linux). Unggah ZIP hasil build (folder dist) untuk platform ini.');
  }
  console.log('Kode sumber terdeteksi: menjalankan install + build di kontainer terisolasi…');
  for (const junk of ['node_modules', 'dist', 'build', '.git']) fs.rmSync(`${dir}/${junk}`, { recursive: true, force: true });
  const uid = typeof process.getuid === 'function' ? `${process.getuid()}:${process.getgid()}` : '1000:1000';
  const script = [
    'set -e',
    'if [ -f pnpm-lock.yaml ]; then npx -y pnpm@9 install --frozen-lockfile || npx -y pnpm@9 install;',
    'elif [ -f yarn.lock ]; then npx -y yarn@1 install --frozen-lockfile --non-interactive || npx -y yarn@1 install --non-interactive;',
    'elif [ -f bun.lockb ] || [ -f bun.lock ]; then npx -y bun install;',
    'elif [ -f package-lock.json ]; then npm ci --no-audit --no-fund || npm install --no-audit --no-fund;',
    'else npm install --no-audit --no-fund; fi',
    'npm run build'
  ].join('\n');
  try {
    execFileSync('docker', ['run', '--rm', '--user', uid, '--memory', '5g', '--pids-limit', '2048', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
      '-e', 'HOME=/tmp', '-e', 'CI=true', '-e', 'NODE_ENV=production', '-e', 'NODE_OPTIONS=--max-old-space-size=4096',
      '-e', 'npm_config_cache=/tmp/.npm', '-e', 'npm_config_production=false',
      '-v', `${dir}:/app`, '-w', '/app', 'node:20-bookworm', 'sh', '-c', script], { stdio: 'inherit', timeout: 15 * 60 * 1000 });
  } catch (e) {
    throw userError('Build kode sumber gagal (npm install / npm run build). Periksa log build, pastikan proyek bisa di-build dengan "npm run build".');
  }
  for (const out of ['dist', 'build', 'out', 'www', 'public_html', 'dist/browser']) {
    const p = `${dir}/${out}`;
    if (fs.existsSync(`${p}/index.html`)) { console.log(`Hasil build: ${out}/`); return p; }
  }
  // Angular: dist/<nama>/browser
  const d = `${dir}/dist`;
  if (fs.existsSync(d)) for (const e of fs.readdirSync(d)) for (const sub of ['', '/browser']) if (fs.existsSync(`${d}/${e}${sub}/index.html`)) return `${d}/${e}${sub}`;
  throw userError('Build selesai tetapi folder hasil (dist/build/out) dengan index.html tidak ditemukan.');
}

import { createRequire } from 'node:module';
const require_ = createRequire(import.meta.url);

/** salin folder tanpa mengikuti symlink (cegah symlink ke berkas runner) */
export function copySafe(src, dest) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.isSymbolicLink()) continue;
    const s = `${src}/${e.name}`, d = `${dest}/${e.name}`;
    if (e.isDirectory()) { if (e.name === 'node_modules') continue; fs.mkdirSync(d, { recursive: true }); copySafe(s, d); }
    else if (e.isFile()) fs.copyFileSync(s, d);
  }
}

/** Versi semver x.y.z dari versionName (desktop/iOS mensyaratkan format ini) */
export function semver(v) {
  const p = String(v || '1.0.0').split('.').map((n) => Math.min(65535, parseInt(n, 10) || 0));
  while (p.length < 3) p.push(0);
  return p.slice(0, 3).join('.');
}

export async function finishJob(job, status, extra = {}) {
  await api(`/api/internal/builds/${BUILD_ID}/finish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ job, status, logUrl: process.env.LOG_URL, ...extra })
  });
}

export async function uploadArtifact(type, file) {
  const buf = fs.readFileSync(file);
  console.log(`Mengunggah ${type} (${(buf.length / 1048576).toFixed(2)} MB)…`);
  for (let i = 1; ; i++) {
    try {
      await api(`/api/internal/builds/${BUILD_ID}/artifact?type=${type}`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: buf });
      return;
    } catch (e) {
      if (i >= 3) throw e;
      console.warn(`Gagal (${e.message}), coba lagi…`);
      await new Promise((r) => setTimeout(r, 3000 * i));
    }
  }
}
