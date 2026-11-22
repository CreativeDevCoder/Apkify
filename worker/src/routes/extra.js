// Fitur rilis 3:
//  - Keystore sendiri (Keystore & Signing)
//  - Remote Update: pesan, paksa update, dan update konten OTA tanpa build ulang
//  - Hosting subdomain gratis (namaanda.HOSTING_DOMAIN) di Cloudflare R2
import { requireUser, rtdb } from '../firebase.js';
import { putFile, deleteFile } from '../storage/index.js';
import { encryptStr } from '../crypto.js';
import { memo, forget } from '../tokenCache.js';
import { json, HttpError, pkgKey, readJson, b64, randomId } from '../util.js';

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const PKG = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

// ================= KEYSTORE SENDIRI =================
// POST /api/keystores  multipart: packageName, file, storePass, keyPass, alias, replace
export async function uploadKeystore(req, env) {
  const user = await requireUser(env, req);
  if (user.anonymous) throw new HttpError(403, 'Daftar untuk memakai keystore sendiri.');
  const form = await req.formData();
  const pkg = str(form.get('packageName'), 100).toLowerCase();
  if (!PKG.test(pkg)) throw new HttpError(400, 'Package name tidak valid');
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new HttpError(400, 'File keystore tidak ditemukan');
  if (file.size > 64 * 1024) throw new HttpError(413, 'File keystore terlalu besar');
  const buf = new Uint8Array(await file.arrayBuffer());
  const isJks = buf[0] === 0xfe && buf[1] === 0xed && buf[2] === 0xfe && buf[3] === 0xed;
  const isP12 = buf[0] === 0x30 && (buf[1] === 0x82 || buf[1] === 0x80 || buf[1] === 0x83);
  if (!isJks && !isP12) throw new HttpError(400, 'Format tidak dikenali. Gunakan .jks atau .keystore/.p12 (PKCS12).');
  const storePass = str(form.get('storePass'), 200);
  const keyPass = str(form.get('keyPass'), 200) || storePass;
  const alias = str(form.get('alias'), 100);
  if (!storePass || !alias) throw new HttpError(400, 'Password keystore dan alias wajib diisi');

  const db = rtdb(env);
  const k = pkgKey(pkg);
  const [owner, existing] = await Promise.all([db.get(`packages/${k}`), db.get(`keystores/${k}`)]);
  if (owner && owner !== user.uid) throw new HttpError(409, 'Package name milik pengguna lain.');
  if (existing && form.get('replace') !== 'true') {
    throw new HttpError(409, 'Package ini sudah punya keystore. Centang “ganti keystore” bila Anda yakin (aplikasi yang sudah terbit tidak bisa di-update dengan kunci berbeda, kecuali lewat reset upload key Play App Signing).');
  }
  const data = await encryptStr(env, JSON.stringify({ keystore: b64.fromBytes(buf), storePass, keyPass, alias, custom: true }));
  await db.update('', {
    [`packages/${k}`]: user.uid,
    [`keystores/${k}`]: { owner: user.uid, data, custom: true, createdAt: Date.now() }
  });
  return json({ ok: true, note: 'Keystore tersimpan terenkripsi. Password diverifikasi saat build berikutnya.' });
}

// ================= REMOTE UPDATE =================
async function ownApp(env, uid, appId) {
  if (!/^[A-Za-z0-9]{10,40}$/.test(appId)) throw new HttpError(404, 'Aplikasi tidak ditemukan');
  const app = await rtdb(env).get(`apps/${uid}/${appId}`);
  if (!app) throw new HttpError(404, 'Aplikasi tidak ditemukan');
  return app;
}

// GET publik (dipanggil aplikasi Android saat dibuka). Edge cache 60 dtk.
export async function getRemote(req, env, ctx, appId) {
  if (!/^[A-Za-z0-9]{10,40}$/.test(appId)) throw new HttpError(404, 'not found');
  const cache = caches.default;
  const key = new Request(new URL(`/api/public/apps/${appId}/remote`, req.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  const r = (await rtdb(env).get(`remote/${appId}`)) || {};
  const origin = new URL(req.url).origin;
  const body = {
    message: r.message || '', messageId: r.messageId || '', minVersionCode: r.minVersionCode || 0, updateUrl: r.updateUrl || '',
    bundle: r.bundleFileId ? { version: r.bundleVersion, url: `${origin}/api/files/${r.bundleFileId}/bundle.zip` } : null
  };
  const res = json(body, 200, { 'cache-control': 'public, max-age=60, s-maxage=60' });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

async function purgeRemote(req, appId) {
  await caches.default.delete(new Request(new URL(`/api/public/apps/${appId}/remote`, req.url).toString())).catch(() => {});
}

// GET/PUT /api/apps/:appId/remote (pemilik)
export async function ownerRemote(req, env, appId) {
  const user = await requireUser(env, req);
  await ownApp(env, user.uid, appId);
  const db = rtdb(env);
  if (req.method === 'GET') return json((await db.get(`remote/${appId}`)) || {});
  const b = await readJson(req);
  const prev = (await db.get(`remote/${appId}`)) || {};
  let updateUrl = str(b.updateUrl, 300);
  try { if (updateUrl && !/^https:/.test(new URL(updateUrl).protocol)) updateUrl = ''; } catch { updateUrl = ''; }
  const message = str(b.message, 500);
  await db.update(`remote/${appId}`, {
    uid: user.uid, message, messageId: message && message !== prev.message ? randomId(8) : prev.messageId || '',
    minVersionCode: Math.max(0, Math.round(Number(b.minVersionCode) || 0)), updateUrl, updatedAt: Date.now()
  });
  await purgeRemote(req, appId);
  return json({ ok: true });
}

// POST /api/apps/:appId/bundle (multipart zip) — konten baru untuk aplikasi ZIP/HTML tanpa build ulang
export async function uploadBundle(req, env, ctx, appId) {
  const user = await requireUser(env, req);
  const app = await ownApp(env, user.uid, appId);
  if (app.config?.source?.type === 'url') throw new HttpError(400, 'Update konten OTA hanya untuk aplikasi ZIP/HTML. Aplikasi website otomatis mengikuti situs Anda.');
  if (!app.config?.features?.remoteUpdate) throw new HttpError(400, 'Aktifkan “Remote Update” lalu build ulang sekali agar aplikasi bisa menerima update OTA.');
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new HttpError(400, 'File tidak ditemukan');
  const buf = await file.arrayBuffer();
  const h = new Uint8Array(buf.slice(0, 2));
  if (!(h[0] === 0x50 && h[1] === 0x4b)) throw new HttpError(400, 'File harus ZIP');
  if (buf.byteLength > Number(env.MAX_UPLOAD_MB || 50) * 1048576) throw new HttpError(413, 'ZIP terlalu besar');
  const db = rtdb(env);
  const prev = (await db.get(`remote/${appId}`)) || {};
  const r = await putFile(env, buf, { owner: user.uid, kind: 'bundle', name: 'bundle.zip', mime: 'application/zip', public: true });
  await db.update(`remote/${appId}`, { uid: user.uid, bundleFileId: r.fileId, bundleVersion: (prev.bundleVersion || 0) + 1, updatedAt: Date.now() });
  if (prev.bundleFileId) ctx.waitUntil(deleteFile(env, prev.bundleFileId).catch(() => {}));
  await purgeRemote(req, appId);
  return json({ ok: true, bundleVersion: (prev.bundleVersion || 0) + 1 });
}

// ================= HOSTING SUBDOMAIN (R2) =================
const RESERVED = new Set(['www', 'api', 'app', 'apps', 'admin', 'mail', 'smtp', 'ftp', 'cdn', 'static', 'assets', 'dashboard', 'login', 'support', 'help', 'status', 'blog', 'docs', 'dev', 'test', 'staging']);
const NAME = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
const MAX_FILES = 300;
const MAX_BYTES = 25 * 1048576;
const MIME = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8', json: 'application/json', map: 'application/json', svg: 'image/svg+xml', png: 'image/png',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', mp3: 'audio/mpeg', mp4: 'video/mp4', webm: 'video/webm',
  wasm: 'application/wasm', txt: 'text/plain; charset=utf-8', xml: 'application/xml', webmanifest: 'application/manifest+json', pdf: 'application/pdf'
};
const mimeOf = (p) => MIME[p.split('.').pop().toLowerCase()] || 'application/octet-stream';
const siteHost = (env, name) => `${name}.${env.HOSTING_DOMAIN}`;

function requireHosting(env) {
  if (!env.HOSTING_DOMAIN || !env.R2) throw new HttpError(503, 'Hosting belum diaktifkan di server.');
}

export async function mySites(req, env) {
  const user = await requireUser(env, req);
  const db = rtdb(env);
  const names = Object.keys((await db.get(`userSites/${user.uid}`)) || {});
  const sites = (await Promise.all(names.map(async (n) => ({ name: n, ...((await db.get(`sites/${n}`)) || {}) })))).filter((s) => s.owner === user.uid);
  return json({ enabled: !!(env.HOSTING_DOMAIN && env.R2), domain: env.HOSTING_DOMAIN || '', sites: sites.map((s) => ({ ...s, url: `https://${siteHost(env, s.name)}` })) });
}

// POST /api/sites/:name  multipart: banyak field "f" (nama file = path relatif) ATAU field "html"
export async function publishSite(req, env, ctx, name) {
  requireHosting(env);
  const user = await requireUser(env, req);
  if (user.anonymous) throw new HttpError(403, 'Daftar untuk memakai hosting.');
  name = String(name).toLowerCase();
  if (!NAME.test(name) || RESERVED.has(name)) throw new HttpError(400, 'Nama subdomain 3–32 karakter: huruf kecil, angka, tanda minus.');
  const db = rtdb(env);
  const existing = await db.get(`sites/${name}`);
  if (existing && existing.owner !== user.uid) throw new HttpError(409, 'Nama subdomain sudah dipakai.');
  if (!existing && Object.keys((await db.get(`userSites/${user.uid}`)) || {}).length >= 3) throw new HttpError(429, 'Maksimal 3 situs per akun.');

  const form = await req.formData();
  const files = [];
  const html = form.get('html');
  if (typeof html === 'string' && html.trim()) files.push(['index.html', new TextEncoder().encode(html)]);
  for (const f of form.getAll('f')) {
    if (typeof f === 'string') continue;
    const p = f.name.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!p || p.split('/').some((seg) => seg === '..' || seg === '') || p.length > 200) continue;
    files.push([p, new Uint8Array(await f.arrayBuffer())]);
  }
  if (!files.length) throw new HttpError(400, 'Tidak ada file.');
  if (files.length > MAX_FILES) throw new HttpError(413, `Maksimal ${MAX_FILES} file.`);
  const bytes = files.reduce((s, [, b]) => s + b.byteLength, 0);
  if (bytes > MAX_BYTES) throw new HttpError(413, 'Total ukuran situs maksimal 25 MB.');
  if (!files.some(([p]) => p === 'index.html')) throw new HttpError(400, 'Harus ada index.html di folder utama.');

  const version = Date.now().toString(36);
  // Operasi binding R2 tidak memakai kuota subrequest fetch
  for (const [p, b] of files) await env.R2.put(`sites/${name}/${version}/${p}`, b, { httpMetadata: { contentType: mimeOf(p) } });
  const title = (new TextDecoder().decode(files.find(([p]) => p === 'index.html')[1]).match(/<title>([^<]{1,80})<\/title>/i) || [])[1] || name;
  await db.update('', {
    [`sites/${name}`]: { owner: user.uid, version, files: files.length, bytes, title, createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now() },
    [`userSites/${user.uid}/${name}`]: true
  });
  forget(`site:${name}`);
  if (existing?.version) ctx.waitUntil(removePrefix(env, `sites/${name}/${existing.version}/`));
  return json({ ok: true, url: `https://${siteHost(env, name)}`, version });
}

async function removePrefix(env, prefix) {
  let cursor;
  do {
    const list = await env.R2.list({ prefix, cursor });
    if (list.objects.length) await env.R2.delete(list.objects.map((o) => o.key));
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
}

export async function deleteSite(req, env, ctx, name) {
  requireHosting(env);
  const user = await requireUser(env, req);
  const db = rtdb(env);
  const s = await db.get(`sites/${name}`);
  if (!s || s.owner !== user.uid) throw new HttpError(404, 'Situs tidak ditemukan');
  await db.update('', { [`sites/${name}`]: null, [`userSites/${user.uid}/${name}`]: null });
  forget(`site:${name}`);
  ctx.waitUntil(removePrefix(env, `sites/${name}/`));
  return json({ ok: true });
}

/** Melayani namaanda.HOSTING_DOMAIN/* — dipanggil dari index.js berdasarkan Host */
export async function serveSite(req, env, ctx) {
  const url = new URL(req.url);
  const name = url.hostname.slice(0, -(env.HOSTING_DOMAIN.length + 1));
  const notFound = () => new Response('<!doctype html><meta charset=utf-8><title>404</title><h1>Situs tidak ditemukan</h1>', { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
  if (!NAME.test(name)) return notFound();
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const site = await memo(`site:${name}`, 30_000, () => rtdb(env).get(`sites/${name}`));
  if (!site) return notFound();

  // Edge cache per versi: konten tidak berubah dalam satu versi
  let path = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (!path || path.endsWith('/')) path += 'index.html';
  const cacheKey = new Request(`https://${url.hostname}/__v/${site.version}/${path}`);
  const hit = await caches.default.match(cacheKey);
  if (hit) return hit;

  let obj = await env.R2.get(`sites/${name}/${site.version}/${path}`);
  if (!obj && !/\.[a-z0-9]{1,6}$/i.test(path)) {
    obj = await env.R2.get(`sites/${name}/${site.version}/${path}/index.html`)
      || await env.R2.get(`sites/${name}/${site.version}/index.html`); // fallback SPA
    path = 'index.html';
  }
  if (!obj) return notFound();
  const isHtml = path.endsWith('.html');
  const res = new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || mimeOf(path),
      'cache-control': isHtml ? 'public, max-age=0, s-maxage=300, must-revalidate' : 'public, max-age=3600, s-maxage=86400',
      'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin'
    }
  });
  ctx.waitUntil(caches.default.put(cacheKey, res.clone()));
  return res;
}
