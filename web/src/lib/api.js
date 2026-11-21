import { auth } from '../firebase';

const BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

export function apiUrl(path) {
  return `${BASE}${path}`;
}

async function request(path, { method = 'GET', body, headers = {}, auth: needAuth = true } = {}) {
  const h = { ...headers };
  if (needAuth) {
    const user = auth.currentUser;
    if (!user) throw new Error('Silakan masuk terlebih dahulu.');
    h.Authorization = `Bearer ${await user.getIdToken()}`;
  }
  let payload = body;
  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    h['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(apiUrl(path), { method, headers: h, body: payload });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = (data && data.error) || `Permintaan gagal (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  get: (p, o) => request(p, { ...o, method: 'GET' }),
  post: (p, body, o) => request(p, { ...o, method: 'POST', body }),
  put: (p, body, o) => request(p, { ...o, method: 'PUT', body }),
  del: (p, o) => request(p, { ...o, method: 'DELETE' }),

  /** Upload file dengan progress (XHR karena fetch belum punya progress upload) */
  upload(path, file, { kind = 'source', onProgress } = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error('Silakan masuk terlebih dahulu.');
        const fd = new FormData();
        fd.append('file', file, file.name || 'file.bin');
        fd.append('kind', kind);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', apiUrl(path));
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => {
          let data = {};
          try { data = JSON.parse(xhr.responseText); } catch { /* */ }
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new Error(data.error || `Upload gagal (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error('Koneksi terputus saat upload.'));
        xhr.send(fd);
      } catch (e) {
        reject(e);
      }
    });
  }
};

export function fileUrl(fileId, name) {
  return apiUrl(`/api/files/${fileId}${name ? `/${encodeURIComponent(name)}` : ''}`);
}
