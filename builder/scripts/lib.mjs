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
  const { execFileSync } = await import('node:child_process');
  const path = await import('node:path');
  fs.mkdirSync(dest, { recursive: true });
  if (type === 'html') {
    await download(new URL(sourceUrl).pathname, path.join(dest, 'index.html'));
    return;
  }
  const zip = await download(new URL(sourceUrl).pathname, path.join(tmp, 'source.zip'));
  execFileSync('unzip', ['-q', '-o', zip, '-d', dest], { stdio: 'inherit' });
  const entries = fs.readdirSync(dest).filter((e) => !e.startsWith('__MACOSX') && e !== '.DS_Store');
  if (!fs.existsSync(path.join(dest, 'index.html')) && entries.length === 1 && fs.statSync(path.join(dest, entries[0])).isDirectory()) {
    const inner = path.join(dest, entries[0]);
    for (const e of fs.readdirSync(inner)) fs.renameSync(path.join(inner, e), path.join(dest, e));
    fs.rmSync(inner, { recursive: true, force: true });
  }
  fs.rmSync(path.join(dest, '__MACOSX'), { recursive: true, force: true });
  if (!fs.existsSync(path.join(dest, 'index.html'))) throw Object.assign(new Error('ZIP tidak berisi index.html di folder utama.'), { user: true });
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
