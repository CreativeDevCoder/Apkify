import { requireUser, rtdb } from '../firebase.js';
import { listEmailProviders, sendEmail, renderEmail } from '../email/index.js';
import { listStorageProviders } from '../storage/index.js';
import { EMAIL_PROVIDERS } from '../email/providers.js';
import { STORAGE_PROVIDERS } from '../storage/providers.js';
import { memo, forget } from '../tokenCache.js';
import { json, HttpError, readJson } from '../util.js';

export async function requireAdmin(req, env) {
  const user = await requireUser(env, req);
  const isAdmin = await memo(`admin:${user.uid}`, 60_000, () => rtdb(env).get(`admins/${user.uid}`));
  if (isAdmin !== true) throw new HttpError(403, 'Khusus admin');
  return user;
}

export async function getSettings(env) {
  return memo('settings', 60_000, async () => ({
    dailyBuildLimit: Number(env.DEFAULT_DAILY_BUILD_LIMIT || 10),
    anonDailyLimit: 2, // build per tamu per hari
    anonIpDailyLimit: 5, // build tamu per IP per hari (anti-abuse)
    aiDailyLimit: 5, // generate AI Studio per user per hari
    aiGlobalDailyLimit: 60, // total generate AI per hari (jaga kuota gratis Workers AI)
    marketAutoApprove: false,
    maintenance: false,
    ...((await rtdb(env).get('config/settings')) || {})
  }));
}

export async function handleAdmin(req, env, path) {
  await requireAdmin(req, env);
  const db = rtdb(env);
  const m = req.method;

  if (path === '/api/admin/providers' && m === 'GET') {
    const [email, storage] = await Promise.all([listEmailProviders(env), listStorageProviders(env)]);
    return json({ email, storage });
  }

  const pm = path.match(/^\/api\/admin\/providers\/(email|storage)\/([a-z0-9]+)$/);
  if (pm && m === 'PUT') {
    const [, kind, id] = pm;
    const known = (kind === 'email' ? EMAIL_PROVIDERS : STORAGE_PROVIDERS).some((p) => p.id === id);
    if (!known) throw new HttpError(404, 'Penyedia tidak dikenal');
    const b = await readJson(req);
    const patch = {};
    if (typeof b.enabled === 'boolean') patch.enabled = b.enabled;
    if (Number.isFinite(b.priority)) patch.priority = Math.round(b.priority);
    if (kind === 'email') {
      if ('daily' in b) patch.daily = b.daily === null ? null : Math.max(0, Math.round(b.daily));
      if ('monthly' in b) patch.monthly = b.monthly === null ? null : Math.max(0, Math.round(b.monthly));
    } else if (Number.isFinite(b.capacityBytes)) patch.capacityBytes = Math.max(0, Math.round(b.capacityBytes));
    await db.update(`config/${kind}/${id}`, patch);
    // reset jeda error saat admin menyimpan
    await db.update(`providerUsage/${kind}/${id}`, { coolingUntil: 0 });
    forget(`${kind}-state`);
    return json({ ok: true });
  }

  if (path === '/api/admin/test-email' && m === 'POST') {
    const b = await readJson(req);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.to || '')) throw new HttpError(400, 'Email tujuan tidak valid');
    const mail = renderEmail(env, { title: 'Email uji', intro: 'Jika Anda menerima email ini, rotasi penyedia email berfungsi.' });
    const r = await sendEmail(env, { to: b.to, subject: `Uji email ${env.APP_NAME || 'Apkify'}`, ...mail }, { only: b.provider });
    return json(r);
  }

  if (path === '/api/admin/builds' && m === 'GET') {
    const data = (await db.query('builds', { orderBy: 'createdAt', limitToLast: 50 })) || {};
    const builds = Object.entries(data).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.createdAt - a.createdAt);
    return json({ builds });
  }

  if (path === '/api/admin/settings') {
    if (m === 'GET') return json(await getSettings(env));
    if (m === 'PUT') {
      const b = await readJson(req);
      const n = (v, d) => Math.max(0, Math.round(Number.isFinite(Number(v)) ? Number(v) : d));
      const s = {
        dailyBuildLimit: n(b.dailyBuildLimit, 10), anonDailyLimit: n(b.anonDailyLimit, 2), anonIpDailyLimit: n(b.anonIpDailyLimit, 5),
        aiDailyLimit: n(b.aiDailyLimit, 5), aiGlobalDailyLimit: n(b.aiGlobalDailyLimit, 60), marketAutoApprove: !!b.marketAutoApprove, maintenance: !!b.maintenance
      };
      await db.set('config/settings', s);
      forget('settings');
      return json(s);
    }
  }
  throw new HttpError(404, 'Tidak ditemukan');
}
