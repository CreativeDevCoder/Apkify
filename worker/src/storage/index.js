// Rotasi 10 drive gratis:
// - pilih penyedia aktif dengan PERSENTASE pemakaian terendah (beban merata),
//   prioritas sebagai pemecah seri
// - lewati bila (terpakai + ukuran file) > 90% kapasitas atau file melebihi batas per-file penyedia
// - upload gagal -> jeda penyedia 10 menit, lanjut ke kandidat berikutnya
// - metadata file disimpan di RTDB /files/{fileId}; konten di drive
import { STORAGE_PROVIDERS, MAX_FILE } from './providers.js';
import { rtdb } from '../firebase.js';
import { memo, forget } from '../tokenCache.js';
import { randomId, HttpError } from '../util.js';

const SAFETY = 0.9;
const COOLDOWN_MS = 10 * 60 * 1000;

export async function listStorageProviders(env) {
  const state = await memo('storage-state', 30_000, async () => {
    const db = rtdb(env);
    const [config, usage] = await Promise.all([db.get('config/storage'), db.get('providerUsage/storage')]);
    return { config: config || {}, usage: usage || {} };
  });
  return STORAGE_PROVIDERS.map((p, i) => {
    const c = state.config[p.id] || {};
    const u = state.usage[p.id] || {};
    return {
      id: p.id, name: p.name, note: p.note,
      configured: p.configured(env),
      enabled: c.enabled !== false,
      priority: c.priority ?? i + 1,
      capacityBytes: c.capacityBytes ?? p.capacity,
      usedBytes: u.usedBytes || 0,
      files: u.files || 0,
      coolingUntil: u.coolingUntil || 0,
      lastError: u.lastError || ''
    };
  }).sort((a, b) => a.priority - b.priority);
}

function candidates(list, size) {
  return list
    .filter((p) => p.configured && p.enabled && p.coolingUntil <= Date.now())
    .filter((p) => p.usedBytes + size <= p.capacityBytes * SAFETY)
    .filter((p) => !MAX_FILE[p.id] || size <= MAX_FILE[p.id])
    .sort((a, b) => (a.usedBytes / a.capacityBytes) - (b.usedBytes / b.capacityBytes) || a.priority - b.priority);
}

/**
 * Simpan file. body: ArrayBuffer/Uint8Array (dibaca penuh agar bisa dicoba ulang di penyedia lain).
 * meta: { owner, kind, name, mime, public, buildId? }
 */
export async function putFile(env, body, meta) {
  const db = rtdb(env);
  const size = body.byteLength;
  const list = candidates(await listStorageProviders(env), size);
  if (!list.length) throw new HttpError(507, 'Semua penyimpanan penuh atau belum dikonfigurasi.');
  const fileId = randomId(24);
  const key = `${meta.kind || 'file'}/${new Date().toISOString().slice(0, 7)}/${fileId}`;
  const errors = [];
  for (const p of list) {
    const impl = STORAGE_PROVIDERS.find((x) => x.id === p.id);
    try {
      const ref = await impl.upload(env, { key, body, size, mime: meta.mime || 'application/octet-stream', name: meta.name });
      const record = {
        provider: p.id, ref, size, mime: meta.mime || 'application/octet-stream', name: meta.name || 'file',
        owner: meta.owner || null, kind: meta.kind || 'file', public: !!meta.public, createdAt: Date.now(),
        ...(meta.buildId ? { buildId: meta.buildId } : {})
      };
      await db.update('', {
        [`files/${fileId}`]: record,
        [`providerUsage/storage/${p.id}/usedBytes`]: db.inc(size),
        [`providerUsage/storage/${p.id}/files`]: db.inc(1)
      });
      forget('storage-state');
      return { fileId, provider: p.id, size };
    } catch (e) {
      errors.push(`${p.id}: ${e.message}`);
      await db.update(`providerUsage/storage/${p.id}`, { lastError: String(e.message).slice(0, 300), lastErrorAt: Date.now(), coolingUntil: Date.now() + COOLDOWN_MS }).catch(() => {});
      forget('storage-state');
    }
  }
  throw new HttpError(502, `Upload gagal di semua penyimpanan: ${errors.join(' | ')}`);
}

export async function getFileMeta(env, fileId) {
  if (!/^[A-Za-z0-9]{10,40}$/.test(fileId)) return null;
  // metadata file tidak berubah -> aman di-cache lama di memori
  return memo(`file:${fileId}`, 10 * 60_000, () => rtdb(env).get(`files/${fileId}`));
}

export async function openFile(env, meta) {
  const impl = STORAGE_PROVIDERS.find((x) => x.id === meta.provider);
  if (!impl) throw new HttpError(500, 'Penyedia tidak dikenal');
  return impl.download(env, meta.ref);
}

export async function deleteFile(env, fileId) {
  const db = rtdb(env);
  const meta = await db.get(`files/${fileId}`);
  if (!meta) return;
  const impl = STORAGE_PROVIDERS.find((x) => x.id === meta.provider);
  try { await impl?.remove(env, meta.ref); } catch { /* abaikan, tetap hapus metadata */ }
  await db.update('', {
    [`files/${fileId}`]: null,
    [`providerUsage/storage/${meta.provider}/usedBytes`]: db.inc(-meta.size),
    [`providerUsage/storage/${meta.provider}/files`]: db.inc(-1)
  });
  forget(`file:${fileId}`);
  forget('storage-state');
  if (typeof caches !== 'undefined') caches.default.delete(new Request(`https://files.internal/${fileId}`)).catch(() => {});
}
