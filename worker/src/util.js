export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });
}

export function corsHeaders(env, req) {
  const origin = req.headers.get('origin') || '';
  const allowed = (env.APP_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    'access-control-allow-origin': ok ? origin : allowed[0] || '*',
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-max-age': '86400',
    vary: 'origin'
  };
}

const ALPHA = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomId(len = 20) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let s = '';
  for (const b of bytes) s += ALPHA[b % ALPHA.length];
  return s;
}

/** Kunci RTDB tidak boleh mengandung . # $ [ ] / */
export const pkgKey = (pkg) => pkg.replace(/\./g, ',');

export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10).replace(/-/g, '');
export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7).replace(/-/g, '');

export function safeFilename(name, fallback = 'file') {
  return (name || fallback).replace(/[^\w.\-]+/g, '_').slice(0, 120) || fallback;
}

export async function readJson(req, max = 1024 * 1024) {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > max) throw new HttpError(413, 'Payload terlalu besar');
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'JSON tidak valid');
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const b64 = {
  fromBytes(bytes) {
    let s = '';
    const u = new Uint8Array(bytes);
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(s);
  },
  toBytes(str) {
    const bin = atob(str);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
};
