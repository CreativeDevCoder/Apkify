// Endpoint khusus builder (GitHub Actions). Auth: Authorization: Bearer BUILDER_SECRET
import { rtdb } from '../firebase.js';
import { safeEqual, encryptStr, decryptStr } from '../crypto.js';
import { putFile, getFileMeta, openFile } from '../storage/index.js';
import { sendEmail, renderEmail } from '../email/index.js';
import { json, HttpError, pkgKey, readJson, escapeHtml } from '../util.js';

export function requireBuilder(req, env) {
  const h = req.headers.get('authorization') || '';
  if (!env.BUILDER_SECRET || !safeEqual(h, `Bearer ${env.BUILDER_SECRET}`)) throw new HttpError(401, 'unauthorized');
}

async function loadBuild(env, buildId) {
  if (!/^[A-Za-z0-9]{10,40}$/.test(buildId)) throw new HttpError(400, 'buildId tidak valid');
  const db = rtdb(env);
  const [b, bc] = await Promise.all([db.get(`builds/${buildId}`), db.get(`buildConfigs/${buildId}`)]);
  if (!b || !bc) throw new HttpError(404, 'Build tidak ditemukan');
  return { db, b, bc };
}

async function setStatus(db, b, buildId, status, extra = {}) {
  const now = Date.now();
  const patch = {
    [`builds/${buildId}/status`]: status, [`builds/${buildId}/updatedAt`]: now,
    [`userBuilds/${b.uid}/${buildId}/status`]: status, [`apps/${b.uid}/${b.appId}/lastStatus`]: status
  };
  for (const [k, v] of Object.entries(extra)) patch[`builds/${buildId}/${k}`] = v;
  await db.update('', patch);
}

// GET /api/internal/builds/:id/config
export async function getConfig(req, env, buildId) {
  requireBuilder(req, env);
  const { db, b, bc } = await loadBuild(env, buildId);
  if (['success', 'failed'].includes(b.status)) throw new HttpError(409, 'Build sudah selesai');
  await setStatus(db, b, buildId, 'building', { startedAt: Date.now() });
  let keystore = null;
  const ks = await db.get(`keystores/${pkgKey(bc.config.packageName)}`);
  if (ks && ks.owner === b.uid) keystore = JSON.parse(await decryptStr(env, ks.data));
  const origin = new URL(req.url).origin;
  return json({
    buildId, versionCode: bc.versionCode, config: bc.config, keystore,
    iconUrl: `${origin}/api/internal/files/${bc.config.iconFileId}`,
    sourceUrl: bc.config.source.fileId ? `${origin}/api/internal/files/${bc.config.source.fileId}` : null,
    splashUrl: bc.config.splash?.fileId ? `${origin}/api/internal/files/${bc.config.splash.fileId}` : null,
    errorPageUrl: bc.config.errorPageFileId ? `${origin}/api/internal/files/${bc.config.errorPageFileId}` : null,
    appId: b.appId,
    apiBase: (env.PUBLIC_API_BASE || origin).replace(/\/$/, '')
  });
}

// GET /api/internal/files/:id  (termasuk file privat)
export async function getFile(req, env, fileId) {
  requireBuilder(req, env);
  const meta = await getFileMeta(env, fileId);
  if (!meta) throw new HttpError(404, 'File tidak ditemukan');
  const res = await openFile(env, meta);
  return new Response(res.body, { headers: { 'content-type': meta.mime, 'cache-control': 'no-store' } });
}

// POST /api/internal/keystores  { buildId, keystore(b64), storePass, keyPass, alias }
export async function saveKeystore(req, env) {
  requireBuilder(req, env);
  const body = await readJson(req, 64 * 1024);
  const { db, b, bc } = await loadBuild(env, body.buildId);
  const key = pkgKey(bc.config.packageName);
  const existing = await db.get(`keystores/${key}`);
  if (existing) throw new HttpError(409, 'Keystore sudah ada untuk package ini');
  const data = await encryptStr(env, JSON.stringify({ keystore: body.keystore, storePass: body.storePass, keyPass: body.keyPass, alias: body.alias }));
  await db.set(`keystores/${key}`, { owner: b.uid, data, createdAt: Date.now() });
  return json({ ok: true });
}

// POST /api/internal/builds/:id/artifact?type=apk|aab   (body: file biner)
export async function uploadArtifact(req, env, buildId) {
  requireBuilder(req, env);
  const type = new URL(req.url).searchParams.get('type');
  if (!['apk', 'aab'].includes(type)) throw new HttpError(400, 'type harus apk/aab');
  const { db, b } = await loadBuild(env, buildId);
  if (b.status !== 'uploading') await setStatus(db, b, buildId, 'uploading');
  const buf = await req.arrayBuffer();
  if (!buf.byteLength) throw new HttpError(400, 'File kosong');
  const r = await putFile(env, buf, {
    owner: b.uid, kind: type, name: `${b.packageName}-${b.versionName}.${type}`,
    mime: type === 'apk' ? 'application/vnd.android.package-archive' : 'application/octet-stream', public: true, buildId
  });
  await db.update(`builds/${buildId}`, { [`${type}FileId`]: r.fileId, [`${type}Size`]: r.size });
  return json({ fileId: r.fileId });
}

// POST /api/internal/builds/:id/finish  { status: 'success'|'failed', error?, logUrl?, failedAt? }
export async function finish(req, env, ctx, buildId) {
  requireBuilder(req, env);
  const body = await readJson(req);
  const { db, b, bc } = await loadBuild(env, buildId);
  const ok = body.status === 'success';
  if (ok) {
    const fresh = await db.get(`builds/${buildId}`);
    if (!fresh.apkFileId || !fresh.aabFileId) throw new HttpError(400, 'Artefak belum lengkap');
  }
  await setStatus(db, b, buildId, ok ? 'success' : 'failed', {
    finishedAt: Date.now(),
    ...(body.logUrl ? { logUrl: String(body.logUrl).slice(0, 300) } : {}),
    ...(!ok ? { error: String(body.error || 'Build gagal').slice(0, 500), failedAt: body.failedAt || 'building' } : {})
  });
  // Konfigurasi lengkap tidak dibutuhkan lagi
  ctx.waitUntil(db.remove(`buildConfigs/${buildId}`).catch(() => {}));

  if (bc.email) {
    const link = `${(env.APP_ORIGIN || '').split(',')[0]}/build/${buildId}`;
    const mail = ok
      ? renderEmail(env, {
        title: `${b.name} v${b.versionName} siap diunduh`,
        intro: `Build <b>${escapeHtml(b.name)}</b> (${escapeHtml(b.packageName)}) berhasil. File APK dan AAB sudah tersedia.`,
        buttonText: 'Unduh APK & AAB', buttonUrl: link
      })
      : renderEmail(env, {
        title: `Build ${b.name} gagal`,
        intro: `Maaf, build <b>${escapeHtml(b.name)}</b> gagal: ${escapeHtml(body.error || 'kesalahan tidak diketahui')}. Periksa konfigurasi lalu coba lagi.`,
        buttonText: 'Lihat detail', buttonUrl: link
      });
    ctx.waitUntil(sendEmail(env, { to: bc.email, subject: ok ? `✅ ${b.name} siap diunduh` : `❌ Build ${b.name} gagal`, ...mail })
      .catch((e) => console.error('email', e.message)));
  }
  return json({ ok: true });
}
