// Konten publik: berita/blog, marketplace, formulir kontak.
// Daftar publik di-cache di edge (Cache API) dengan TTL pendek; admin menghapus cache saat mengubah data.
import { requireUser, rtdb } from '../firebase.js';
import { getFileMeta } from '../storage/index.js';
import { sendEmail, renderEmail } from '../email/index.js';
import { getSettings, requireAdmin } from './admin.js';
import { json, HttpError, readJson, randomId, dayKey, ipKey, escapeHtml } from '../util.js';

const cacheKey = (req, path) => new Request(new URL(path, req.url).toString());

async function edgeCached(req, ctx, path, ttl, producer) {
  const cache = caches.default;
  const key = cacheKey(req, path);
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = json(await producer(), 200, { 'cache-control': `public, max-age=${ttl}, s-maxage=${ttl}` });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}
export async function purge(req, paths) {
  await Promise.all(paths.map((p) => caches.default.delete(cacheKey(req, p)).catch(() => {})));
}

const str = (v, max) => String(v ?? '').trim().slice(0, max);

// ================= BERITA =================
export function listPosts(req, env, ctx) {
  return edgeCached(req, ctx, '/api/public/posts', 300, async () => {
    const all = (await rtdb(env).query('posts', { orderBy: 'status', equalTo: 'published' })) || {};
    const posts = Object.entries(all).map(([slug, p]) => ({
      slug, title: p.title, excerpt: p.excerpt, category: p.category, coverFileId: p.coverFileId || null, publishedAt: p.publishedAt
    })).sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 60);
    return { posts };
  });
}

export async function getPost(req, env, ctx, slug) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) throw new HttpError(404, 'Artikel tidak ditemukan');
  return edgeCached(req, ctx, `/api/public/posts/${slug}`, 600, async () => {
    const p = await rtdb(env).get(`posts/${slug}`);
    if (!p || p.status !== 'published') throw new HttpError(404, 'Artikel tidak ditemukan');
    return { slug, ...p };
  });
}

export async function adminPosts(req, env, path) {
  await requireAdmin(req, env);
  const db = rtdb(env);
  if (path === '/api/admin/posts' && req.method === 'GET') {
    const all = (await db.get('posts')) || {};
    return json({ posts: Object.entries(all).map(([slug, p]) => ({ slug, ...p })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)) });
  }
  const m = path.match(/^\/api\/admin\/posts\/([a-z0-9-]{1,80})$/);
  if (!m) throw new HttpError(404, 'Tidak ditemukan');
  const slug = m[1];
  if (req.method === 'DELETE') {
    await db.remove(`posts/${slug}`);
  } else if (req.method === 'PUT') {
    const b = await readJson(req, 200 * 1024);
    const prev = (await db.get(`posts/${slug}`)) || {};
    const status = b.status === 'published' ? 'published' : 'draft';
    const post = {
      title: str(b.title, 140), excerpt: str(b.excerpt, 300), body: str(b.body, 60_000), category: str(b.category, 40) || 'Berita',
      coverFileId: str(b.coverFileId, 40) || null, status, updatedAt: Date.now(),
      publishedAt: status === 'published' ? prev.publishedAt || Date.now() : prev.publishedAt || null
    };
    if (!post.title) throw new HttpError(400, 'Judul wajib diisi');
    await db.set(`posts/${slug}`, post);
  } else throw new HttpError(405, 'Metode tidak didukung');
  await purge(req, ['/api/public/posts', `/api/public/posts/${slug}`]);
  return json({ ok: true });
}

// ================= MARKETPLACE =================
const CATS = ['Toko online', 'Konten & berita', 'Edukasi', 'Utilitas', 'Game', 'Bisnis & jasa', 'Lainnya'];

async function sanitizeListing(env, uid, b) {
  const title = str(b.title, 80);
  if (title.length < 5) throw new HttpError(400, 'Judul minimal 5 karakter');
  const description = str(b.description, 5000);
  if (description.length < 30) throw new HttpError(400, 'Deskripsi minimal 30 karakter');
  const price = Math.round(Number(b.price));
  if (!Number.isFinite(price) || price < 0 || price > 10_000_000_000) throw new HttpError(400, 'Harga tidak valid');
  const url = (v) => { const s = str(v, 300); try { const u = new URL(s); return ['http:', 'https:'].includes(u.protocol) ? u.toString() : ''; } catch { return ''; } };
  const whatsapp = str(b.whatsapp, 20).replace(/[^\d]/g, '');
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email || '') ? str(b.email, 120) : '';
  if (!whatsapp && !email) throw new HttpError(400, 'Isi minimal satu kontak (WhatsApp atau email)');
  const imageFileIds = (Array.isArray(b.imageFileIds) ? b.imageFileIds : []).slice(0, 6).map((x) => str(x, 40)).filter(Boolean);
  for (const fid of imageFileIds) {
    const meta = await getFileMeta(env, fid);
    if (!meta || meta.owner !== uid || !meta.public) throw new HttpError(403, 'Gambar tidak valid');
  }
  const includes = ['source', 'apk', 'playAccount', 'domain', 'content', 'support'].filter((k) => b.includes?.[k] === true);
  return {
    title, description, price, category: CATS.includes(b.category) ? b.category : 'Lainnya',
    tech: str(b.tech, 120), monthlyUsers: Math.max(0, Math.round(Number(b.monthlyUsers) || 0)),
    monthlyRevenue: Math.max(0, Math.round(Number(b.monthlyRevenue) || 0)),
    demoUrl: url(b.demoUrl), playUrl: url(b.playUrl), whatsapp, email, imageFileIds,
    includes: Object.fromEntries(includes.map((k) => [k, true]))
  };
}

const publicListing = (id, l) => ({
  id, title: l.title, description: l.description, price: l.price, category: l.category, tech: l.tech, monthlyUsers: l.monthlyUsers,
  monthlyRevenue: l.monthlyRevenue, demoUrl: l.demoUrl, playUrl: l.playUrl, imageFileIds: l.imageFileIds || [], includes: l.includes || {},
  sellerName: l.sellerName, createdAt: l.createdAt, updatedAt: l.updatedAt, status: l.status
});

export function listMarket(req, env, ctx) {
  return edgeCached(req, ctx, '/api/public/market', 60, async () => {
    const all = (await rtdb(env).query('market', { orderBy: 'status', equalTo: 'approved' })) || {};
    const items = Object.entries(all).map(([id, l]) => {
      const p = publicListing(id, l);
      p.description = p.description.slice(0, 200);
      return p;
    }).sort((a, b) => b.updatedAt - a.updatedAt);
    return { items, categories: CATS };
  });
}

export async function getListing(req, env, id) {
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) throw new HttpError(404, 'Listing tidak ditemukan');
  const l = await rtdb(env).get(`market/${id}`);
  if (!l) throw new HttpError(404, 'Listing tidak ditemukan');
  let viewer = null;
  if (req.headers.get('authorization')) viewer = await requireUser(env, req).catch(() => null);
  const isOwner = viewer && viewer.uid === l.sellerUid;
  if (l.status !== 'approved' && !isOwner) throw new HttpError(404, 'Listing tidak ditemukan');
  // kontak penjual hanya untuk pengguna yang masuk (mengurangi scraping/spam)
  const contact = viewer && !viewer.anonymous ? { whatsapp: l.whatsapp, email: l.email } : null;
  return json({ ...publicListing(id, l), contact, isOwner: !!isOwner, note: isOwner ? l.moderationNote || '' : undefined });
}

export async function myListings(req, env) {
  const user = await requireUser(env, req);
  const db = rtdb(env);
  const ids = Object.keys((await db.get(`userMarket/${user.uid}`)) || {});
  const rows = await Promise.all(ids.map(async (id) => [id, await db.get(`market/${id}`)]));
  return json({ items: rows.filter(([, l]) => l).map(([id, l]) => ({ ...publicListing(id, l), whatsapp: l.whatsapp, email: l.email, note: l.moderationNote || '' })) });
}

export async function saveListing(req, env, id) {
  const user = await requireUser(env, req);
  if (user.anonymous) throw new HttpError(403, 'Daftar untuk menjual aplikasi.');
  const db = rtdb(env);
  const settings = await getSettings(env);
  const data = await sanitizeListing(env, user.uid, await readJson(req, 64 * 1024));
  const now = Date.now();
  const status = settings.marketAutoApprove ? 'approved' : 'pending';
  if (id) {
    const prev = await db.get(`market/${id}`);
    if (!prev || prev.sellerUid !== user.uid) throw new HttpError(404, 'Listing tidak ditemukan');
    await db.update(`market/${id}`, { ...data, status: prev.status === 'sold' ? 'sold' : status, updatedAt: now, moderationNote: null });
  } else {
    const count = Object.keys((await db.get(`userMarket/${user.uid}`)) || {}).length;
    if (count >= 10) throw new HttpError(429, 'Maksimal 10 listing per akun');
    id = randomId(20);
    await db.update('', {
      [`market/${id}`]: { ...data, sellerUid: user.uid, sellerName: user.name || (user.email || '').split('@')[0] || 'Penjual', status, createdAt: now, updatedAt: now },
      [`userMarket/${user.uid}/${id}`]: true
    });
  }
  await purge(req, ['/api/public/market']);
  return json({ id, status });
}

export async function markSold(req, env, id) {
  const user = await requireUser(env, req);
  const db = rtdb(env);
  const l = await db.get(`market/${id}`);
  if (!l || l.sellerUid !== user.uid) throw new HttpError(404, 'Listing tidak ditemukan');
  await db.update(`market/${id}`, { status: 'sold', updatedAt: Date.now() });
  await purge(req, ['/api/public/market']);
  return json({ ok: true });
}

export async function deleteListing(req, env, id) {
  const user = await requireUser(env, req);
  const db = rtdb(env);
  const l = await db.get(`market/${id}`);
  if (!l || l.sellerUid !== user.uid) throw new HttpError(404, 'Listing tidak ditemukan');
  await db.update('', { [`market/${id}`]: null, [`userMarket/${user.uid}/${id}`]: null });
  await purge(req, ['/api/public/market']);
  return json({ ok: true });
}

export async function adminMarket(req, env, path) {
  await requireAdmin(req, env);
  const db = rtdb(env);
  if (path === '/api/admin/market' && req.method === 'GET') {
    const status = new URL(req.url).searchParams.get('status') || 'pending';
    const all = (await db.query('market', { orderBy: 'status', equalTo: status })) || {};
    return json({ items: Object.entries(all).map(([id, l]) => ({ ...publicListing(id, l), sellerUid: l.sellerUid, whatsapp: l.whatsapp, email: l.email })) });
  }
  const m = path.match(/^\/api\/admin\/market\/([A-Za-z0-9]{10,40})$/);
  if (m && req.method === 'PUT') {
    const b = await readJson(req);
    if (!['approved', 'rejected', 'pending', 'sold'].includes(b.status)) throw new HttpError(400, 'Status tidak valid');
    await db.update(`market/${m[1]}`, { status: b.status, moderationNote: str(b.note, 300) || null, updatedAt: Date.now() });
    await purge(req, ['/api/public/market']);
    return json({ ok: true });
  }
  throw new HttpError(404, 'Tidak ditemukan');
}

// ================= KONTAK =================
export async function contact(req, env, ctx) {
  const b = await readJson(req, 16 * 1024);
  if (b.website) return json({ ok: true }); // honeypot terisi = bot, pura-pura sukses
  const name = str(b.name, 80), email = str(b.email, 120), topic = str(b.topic, 40), message = str(b.message, 3000);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10) throw new HttpError(400, 'Lengkapi nama, email valid, dan pesan (min. 10 karakter).');
  const db = rtdb(env);
  const ik = await ipKey(req, env);
  const d = dayKey();
  const used = (await db.get(`contactQuota/${d}/${ik}`)) || 0;
  if (used >= 5) throw new HttpError(429, 'Terlalu banyak pesan hari ini. Coba lagi besok.');
  const id = randomId(16);
  await db.update('', {
    [`messages/${id}`]: { name, email, topic, message, createdAt: Date.now(), read: false },
    [`contactQuota/${d}/${ik}`]: db.inc(1)
  });
  if (env.ADMIN_EMAIL) {
    const mail = renderEmail(env, {
      title: `[Kontak] ${topic} — ${name}`,
      intro: `<b>Dari:</b> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;<br><b>Topik:</b> ${escapeHtml(topic)}<br><br>${escapeHtml(message).replace(/\n/g, '<br>')}`,
      footer: `Balas langsung ke ${email}`
    });
    ctx.waitUntil(sendEmail(env, { to: env.ADMIN_EMAIL, subject: `[Kontak ${env.APP_NAME || 'Apkify'}] ${topic} dari ${name}`, ...mail }).catch((e) => console.error('contact mail', e.message)));
  }
  return json({ ok: true });
}

export async function adminMessages(req, env, path) {
  await requireAdmin(req, env);
  const db = rtdb(env);
  if (req.method === 'GET') {
    const all = (await db.query('messages', { orderBy: 'createdAt', limitToLast: 100 })) || {};
    return json({ messages: Object.entries(all).map(([id, m]) => ({ id, ...m })).sort((a, b) => b.createdAt - a.createdAt) });
  }
  const m = path.match(/^\/api\/admin\/messages\/([A-Za-z0-9]+)$/);
  if (m && req.method === 'DELETE') { await db.remove(`messages/${m[1]}`); return json({ ok: true }); }
  if (m && req.method === 'PUT') { await db.update(`messages/${m[1]}`, { read: true }); return json({ ok: true }); }
  throw new HttpError(404, 'Tidak ditemukan');
}
