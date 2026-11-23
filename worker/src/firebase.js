import { createRemoteJWKSet, jwtVerify, SignJWT, importPKCS8 } from 'jose';
import { cachedToken } from './tokenCache.js';
import { HttpError } from './util.js';

// ---------- Verifikasi Firebase ID token (tanpa Admin SDK) ----------
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'), {
  cacheMaxAge: 6 * 60 * 60 * 1000
});

export async function verifyIdToken(env, token) {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
      audience: env.FIREBASE_PROJECT_ID
    });
    if (!payload.sub) throw new Error('no sub');
    return {
      uid: payload.sub, email: payload.email || '', emailVerified: !!payload.email_verified, name: payload.name || '',
      anonymous: payload.firebase?.sign_in_provider === 'anonymous'
    };
  } catch {
    throw new HttpError(401, 'Sesi tidak valid, silakan masuk ulang.');
  }
}

export async function requireUser(env, req) {
  const h = req.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new HttpError(401, 'Silakan masuk terlebih dahulu.');
  return verifyIdToken(env, m[1]);
}

// ---------- Akses RTDB REST memakai service account ----------
async function saAccessToken(env) {
  return cachedToken('firebase-sa', async () => {
    const key = await importPKCS8(env.FIREBASE_SA_PRIVATE_KEY.replace(/\\n/g, '\n'), 'RS256');
    const now = Math.floor(Date.now() / 1000);
    const assertion = await new SignJWT({
      scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email'
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(env.FIREBASE_SA_EMAIL)
      .setSubject(env.FIREBASE_SA_EMAIL)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key);
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Token SA gagal: ${data.error_description || res.status}`);
    return { value: data.access_token, expiresIn: data.expires_in || 3600 };
  });
}

export function rtdb(env) {
  const base = env.FIREBASE_DB_URL.replace(/\/$/, '');
  async function call(method, path, body, params = {}) {
    const token = await saAccessToken(env);
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) qs.set(k, typeof v === 'string' && !['shallow', 'print'].includes(k) ? JSON.stringify(v) : String(v));
    const url = `${base}/${path.replace(/^\//, '')}.json${qs.toString() ? `?${qs}` : ''}`;
    const res = await fetch(url, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`RTDB ${method} ${path} gagal: ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  }
  return {
    get: (p, params) => call('GET', p, undefined, params),
    set: (p, v) => call('PUT', p, v),
    update: (p, v) => call('PATCH', p, v),
    remove: (p) => call('DELETE', p),
    /** Query: { orderBy: 'createdAt', limitToLast: 50, equalTo: 'x' } — butuh .indexOn di rules */
    query: (p, q) => call('GET', p, undefined, q),
    /** Klaim sekali-pakai berbasis ETag (compare-and-set): true hanya untuk pemanggil pertama */
    async claim(p) {
      const token = await saAccessToken(env);
      const url = `${base}/${p.replace(/^\//, '')}.json`;
      const g = await fetch(url, { headers: { authorization: `Bearer ${token}`, 'X-Firebase-ETag': 'true' } });
      if ((await g.json()) === true) return false;
      const etag = g.headers.get('etag');
      const put = await fetch(url, { method: 'PUT', headers: { authorization: `Bearer ${token}`, 'if-match': etag, 'content-type': 'application/json' }, body: 'true' });
      return put.ok;
    },
    inc: (n = 1) => ({ '.sv': { increment: n } }),
    now: { '.sv': 'timestamp' }
  };
}
