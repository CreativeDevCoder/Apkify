// GET /api/files/:fileId/:name?
// Strategi cache unduhan:
// - File bersifat immutable (fileId unik per konten) -> Cache-Control 1 tahun + immutable
// - Edge Cache API (per data center) menyimpan salinan: unduhan berikutnya tidak
//   menyentuh RTDB maupun drive penyedia (hemat kuota API & bandwidth drive)
// - File privat (sumber ZIP/HTML) tidak pernah di-cache dan hanya untuk pemilik
import { getFileMeta, openFile } from '../storage/index.js';
import { requireUser } from '../firebase.js';
import { HttpError, safeFilename } from '../util.js';

const IMMUTABLE = 'public, max-age=31536000, immutable';

function withHeaders(res, meta, name, extra = {}) {
  const h = new Headers();
  h.set('content-type', meta.mime || 'application/octet-stream');
  const len = res.headers.get('content-length') || (meta.size ? String(meta.size) : null);
  if (len) h.set('content-length', len);
  const fname = safeFilename(name || meta.name);
  const inline = (meta.mime || '').startsWith('image/');
  h.set('content-disposition', `${inline ? 'inline' : 'attachment'}; filename="${fname}"`);
  if (fname.endsWith('.apk')) h.set('content-type', 'application/vnd.android.package-archive');
  h.set('x-content-type-options', 'nosniff');
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return new Response(res.body, { status: 200, headers: h });
}

export async function serveFile(req, env, ctx, fileId, name) {
  const cache = caches.default;
  const cacheKey = new Request(`https://files.internal/${fileId}`);

  const hit = await cache.match(cacheKey);
  if (hit) {
    const meta = JSON.parse(hit.headers.get('x-meta') || '{}');
    return withHeaders(hit, meta, name, { 'cache-control': IMMUTABLE, 'x-cache': 'HIT' });
  }

  const meta = await getFileMeta(env, fileId);
  if (!meta) throw new HttpError(404, 'File tidak ditemukan');

  if (!meta.public) {
    const user = await requireUser(env, req);
    if (user.uid !== meta.owner) throw new HttpError(403, 'Tidak diizinkan');
    const res = await openFile(env, meta);
    return withHeaders(res, meta, name, { 'cache-control': 'private, no-store' });
  }

  const upstream = await openFile(env, meta);
  const slim = { mime: meta.mime, name: meta.name, size: meta.size };
  // Simpan ke edge cache tanpa menahan respons ke user (stream di-tee)
  const [a, b] = upstream.body.tee();
  ctx.waitUntil(cache.put(cacheKey, new Response(b, {
    headers: { 'cache-control': IMMUTABLE, 'content-type': meta.mime, 'content-length': String(meta.size), 'x-meta': JSON.stringify(slim) }
  })).catch(() => {}));
  return withHeaders(new Response(a, { headers: upstream.headers }), meta, name, { 'cache-control': IMMUTABLE, 'x-cache': 'MISS' });
}
