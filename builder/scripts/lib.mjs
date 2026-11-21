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

export async function reportFailure(stage, message) {
  await api(`/api/internal/builds/${BUILD_ID}/finish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'failed', failedAt: stage, error: message, logUrl: process.env.LOG_URL })
  }).catch((e) => console.error('reportFailure:', e.message));
}
