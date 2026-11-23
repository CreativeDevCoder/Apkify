// Rilis 4: auto-isi dari website, analitik aplikasi, penandatanganan iOS.
import { requireUser, rtdb } from '../firebase.js';
import { encryptStr } from '../crypto.js';
import { json, HttpError, readJson, dayKey, pkgKey, b64, ipKey } from '../util.js';

const str = (v, max) => String(v ?? '').trim().slice(0, max);

function publicUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new HttpError(400, 'URL tidak valid'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new HttpError(400, 'URL harus http/https');
  // tolak host lokal/privat (Workers memang tidak bisa menjangkau jaringan privat, ini lapisan tambahan)
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|169\.254\.|\[?::1\]?$)/i.test(u.hostname)) throw new HttpError(400, 'Host tidak diizinkan');
  return u;
}

async function fetchLimited(url, maxBytes, accept) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) ApkifyBot/1.0', accept }, redirect: 'follow', cf: { cacheTtl: 3600 } });
  if (!res.ok) throw new HttpError(502, `Situs merespons ${res.status}`);
  const reader = res.body.getReader();
  const chunks = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > maxBytes) { reader.cancel(); break; }
    chunks.push(value);
  }
  const buf = new Uint8Array(Math.min(n, maxBytes));
  let o = 0;
  for (const c of chunks) { const take = Math.min(c.byteLength, buf.length - o); buf.set(c.subarray(0, take), o); o += take; }
  return { res, buf };
}

// GET /api/public/site-meta?url=  -> { name, themeColor, icons[], manifest }
export async function siteMeta(req, env, ctx) {
  const target = publicUrl(new URL(req.url).searchParams.get('url') || '');
  const cache = caches.default;
  const key = new Request(`https://site-meta.internal/${encodeURIComponent(target.href)}`);
  const hit = await cache.match(key);
  if (hit) return hit;

  const { res, buf } = await fetchLimited(target.href, 512 * 1024, 'text/html');
  const html = new TextDecoder().decode(buf);
  const base = res.url || target.href;
  const attr = (tag, name) => (tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i')) || [])[1];
  const metas = html.match(/<meta[^>]+>/gi) || [];
  const meta = (n) => { const t = metas.find((m) => new RegExp(`(name|property)\\s*=\\s*["']${n}["']`, 'i').test(m)); return t ? attr(t, 'content') : ''; };
  const links = html.match(/<link[^>]+>/gi) || [];
  const abs = (h) => { try { return new URL(h, base).href; } catch { return ''; } };
  const icons = [];
  let manifest = null;
  const mLink = links.find((l) => /rel\s*=\s*["']manifest["']/i.test(l));
  if (mLink) {
    try {
      const mUrl = abs(attr(mLink, 'href'));
      const { buf: mb } = await fetchLimited(mUrl, 128 * 1024, 'application/manifest+json');
      manifest = JSON.parse(new TextDecoder().decode(mb));
      for (const ic of manifest.icons || []) icons.push({ src: new URL(ic.src, mUrl).href, size: parseInt(String(ic.sizes || '0').split('x')[0], 10) || 0, purpose: ic.purpose || '' });
    } catch { /* manifest opsional */ }
  }
  for (const l of links) {
    if (/rel\s*=\s*["'][^"']*(apple-touch-icon|icon)[^"']*["']/i.test(l)) {
      icons.push({ src: abs(attr(l, 'href')), size: parseInt(String(attr(l, 'sizes') || '0').split('x')[0], 10) || (/apple-touch/i.test(l) ? 180 : 32) });
    }
  }
  icons.push({ src: abs('/favicon.ico'), size: 16 });
  const title = (html.match(/<title[^>]*>([^<]{1,120})<\/title>/i) || [])[1] || '';
  const body = {
    url: base,
    name: str(manifest?.short_name || manifest?.name || meta('og:site_name') || meta('application-name') || title.split(/[|\-–—:]/)[0], 30).replace(/&amp;/g, '&'),
    description: str(manifest?.description || meta('description') || meta('og:description'), 300),
    themeColor: /^#[0-9a-f]{6}$/i.test(manifest?.theme_color || meta('theme-color')) ? (manifest?.theme_color || meta('theme-color')) : '',
    backgroundColor: /^#[0-9a-f]{6}$/i.test(manifest?.background_color || '') ? manifest.background_color : '',
    icons: icons.filter((i) => i.src).sort((a, b) => b.size - a.size).slice(0, 8),
    hasManifest: !!manifest,
    https: base.startsWith('https:'),
    frameBlocked: /deny|sameorigin/i.test(res.headers.get('x-frame-options') || '') || /frame-ancestors/i.test(res.headers.get('content-security-policy') || '')
  };
  const out = json(body, 200, { 'cache-control': 'public, max-age=3600, s-maxage=3600' });
  ctx.waitUntil(cache.put(key, out.clone()));
  return out;
}

// GET /api/public/site-icon?url= -> proxy gambar ikon (agar bisa digambar ke canvas tanpa masalah CORS)
export async function siteIcon(req, env) {
  const target = publicUrl(new URL(req.url).searchParams.get('url') || '');
  const { res, buf } = await fetchLimited(target.href, 1024 * 1024, 'image/*');
  const type = res.headers.get('content-type') || '';
  if (!/^image\//.test(type)) throw new HttpError(415, 'Bukan gambar');
  return new Response(buf, { headers: { 'content-type': type, 'cache-control': 'public, max-age=86400' } });
}

// POST /api/public/apps/:appId/ping  { first: bool } — dipanggil aplikasi maksimal sekali/hari/perangkat
export async function ping(req, env, appId) {
  if (!/^[A-Za-z0-9]{10,40}$/.test(appId)) throw new HttpError(404, 'not found');
  const b = await readJson(req, 1024).catch(() => ({}));
  const db = rtdb(env);
  const d = dayKey();
  // batas kasar anti-spam per IP per aplikasi per hari
  const ik = await ipKey(req, env);
  const seen = await db.get(`analyticsIp/${d}/${appId}_${ik}`);
  if ((seen || 0) >= 20) return json({ ok: true });
  await db.update('', {
    [`analytics/${appId}/days/${d}`]: db.inc(1),
    ...(b.first ? { [`analytics/${appId}/installs`]: db.inc(1) } : {}),
    [`analyticsIp/${d}/${appId}_${ik}`]: db.inc(1)
  });
  return json({ ok: true });
}

// GET /api/apps/:appId/analytics (pemilik)
export async function appAnalytics(req, env, appId) {
  const user = await requireUser(env, req);
  const db = rtdb(env);
  if (!(await db.get(`apps/${user.uid}/${appId}/name`))) throw new HttpError(404, 'Aplikasi tidak ditemukan');
  const a = (await db.get(`analytics/${appId}`)) || {};
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const k = dayKey(new Date(Date.now() - i * 86400000));
    days.push({ day: k, active: a.days?.[k] || 0 });
  }
  return json({ installs: a.installs || 0, days });
}

// POST/DELETE /api/apps/:appId/ios-signing  multipart: p12, password, profile
export async function iosSigning(req, env, appId) {
  const user = await requireUser(env, req);
  if (user.anonymous) throw new HttpError(403, 'Daftar untuk memakai penandatanganan iOS.');
  const db = rtdb(env);
  const app = await db.get(`apps/${user.uid}/${appId}`);
  if (!app) throw new HttpError(404, 'Aplikasi tidak ditemukan');
  const k = pkgKey(app.packageName);
  if (req.method === 'DELETE') { await db.remove(`iosSigning/${k}`); return json({ ok: true }); }
  if (req.method === 'GET') {
    const s = await db.get(`iosSigning/${k}`);
    return json({ configured: !!(s && s.owner === user.uid), updatedAt: s?.updatedAt || null, teamId: s?.teamId || '' });
  }
  const form = await req.formData();
  const p12 = form.get('p12');
  const profile = form.get('profile');
  if (!p12 || typeof p12 === 'string' || !profile || typeof profile === 'string') throw new HttpError(400, 'Unggah sertifikat .p12 dan provisioning profile');
  if (p12.size > 64 * 1024 || profile.size > 256 * 1024) throw new HttpError(413, 'File terlalu besar');
  const prof = new Uint8Array(await profile.arrayBuffer());
  const text = new TextDecoder('latin1').decode(prof);
  const teamId = (text.match(/<key>TeamIdentifier<\/key>\s*<array>\s*<string>([A-Z0-9]{10})<\/string>/) || [])[1] || '';
  const appIdent = (text.match(/<key>application-identifier<\/key>\s*<string>([^<]+)<\/string>/) || [])[1] || '';
  if (!teamId) throw new HttpError(400, 'Provisioning profile tidak valid (.mobileprovision)');
  const bundle = appIdent.split('.').slice(1).join('.');
  if (bundle && bundle !== '*' && bundle !== app.packageName) throw new HttpError(400, `Profile untuk bundle ID ${bundle}, bukan ${app.packageName}`);
  const method = ['app-store', 'ad-hoc', 'development', 'enterprise'].includes(form.get('method')) ? form.get('method')
    : /<key>ProvisionedDevices<\/key>/.test(text) ? 'ad-hoc' : /<key>ProvisionsAllDevices<\/key>/.test(text) ? 'enterprise' : 'app-store';
  const data = await encryptStr(env, JSON.stringify({
    p12: b64.fromBytes(new Uint8Array(await p12.arrayBuffer())), password: str(form.get('password'), 200),
    profile: b64.fromBytes(prof), teamId, method
  }));
  await db.set(`iosSigning/${k}`, { owner: user.uid, data, teamId, method, updatedAt: Date.now() });
  return json({ ok: true, teamId, method });
}
