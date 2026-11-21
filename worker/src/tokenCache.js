// Cache token OAuth/akses dua lapis:
// 1) memori isolate (gratis, paling cepat, hilang saat isolate mati)
// 2) Cache API per data center (bertahan antar isolate; tidak memakai kuota tulis KV)
// Token tidak pernah keluar ke klien — key cache memakai host internal fiktif.
const mem = new Map();
const inflight = new Map();

export async function cachedToken(key, fetcher, { minTtl = 60 } = {}) {
  const now = Date.now();
  const m = mem.get(key);
  if (m && m.exp - minTtl * 1000 > now) return m.value;

  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    const cacheKey = new Request(`https://token-cache.internal/${encodeURIComponent(key)}`);
    const cache = typeof caches !== 'undefined' ? caches.default : null;
    if (cache) {
      const hit = await cache.match(cacheKey).catch(() => null);
      if (hit) {
        const v = await hit.json();
        if (v.exp - minTtl * 1000 > now) {
          mem.set(key, v);
          return v.value;
        }
      }
    }
    const { value, expiresIn } = await fetcher(); // expiresIn detik
    const v = { value, exp: now + expiresIn * 1000 };
    mem.set(key, v);
    if (cache) {
      await cache.put(cacheKey, new Response(JSON.stringify(v), {
        headers: { 'cache-control': `max-age=${Math.max(60, expiresIn - minTtl)}` }
      })).catch(() => {});
    }
    return value;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function invalidateToken(key) {
  mem.delete(key);
  if (typeof caches !== 'undefined') {
    caches.default.delete(new Request(`https://token-cache.internal/${encodeURIComponent(key)}`)).catch(() => {});
  }
}

/** Cache memori sederhana untuk data kecil (konfigurasi, metadata file) */
const small = new Map();
export async function memo(key, ttlMs, fn) {
  const h = small.get(key);
  if (h && h.exp > Date.now()) return h.v;
  const v = await fn();
  small.set(key, { v, exp: Date.now() + ttlMs });
  if (small.size > 500) small.delete(small.keys().next().value);
  return v;
}
export const forget = (key) => small.delete(key);
