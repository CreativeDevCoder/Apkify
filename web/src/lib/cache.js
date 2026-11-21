// Cache data kecil di localStorage dengan pola stale-while-revalidate.
// Tujuan: hemat kuota baca Firebase RTDB & request Worker.
const PREFIX = 'apkify:c:';

export function readCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw); // { t: timestamp, v: value }
  } catch {
    return null;
  }
}

export function writeCache(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    /* penuh / mode privat: abaikan */
  }
}

export function clearCache(prefix = '') {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX + prefix))
      .forEach((k) => localStorage.removeItem(k));
  } catch { /* abaikan */ }
}

/**
 * swr(key, fetcher, { ttl, onData })
 * - langsung panggil onData dengan cache (jika ada)
 * - jika cache lebih tua dari ttl (ms) atau force, ambil data baru lalu panggil onData lagi
 */
export async function swr(key, fetcher, { ttl = 60_000, onData, force = false } = {}) {
  const cached = readCache(key);
  if (cached && onData) onData(cached.v, { stale: true });
  if (cached && !force && Date.now() - cached.t < ttl) return cached.v;
  const fresh = await fetcher();
  writeCache(key, fresh);
  if (onData) onData(fresh, { stale: false });
  return fresh;
}
