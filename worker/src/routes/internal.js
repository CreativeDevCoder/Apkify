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

// GET /api/internal/builds/:id/config?job=android|windows|macos|linux|ios
export async function getConfig(req, env, buildId) {
  requireBuilder(req, env);
  const job = new URL(req.url).searchParams.get('job') || 'android';
  const { db, b, bc } = await loadBuild(env, buildId);
  if (FINAL.includes(b.status)) throw new HttpError(409, 'Build sudah selesai');
  await db.update('', {
    [`builds/${buildId}/jobs/${job}`]: 'building', [`builds/${buildId}/status`]: 'building', [`builds/${buildId}/updatedAt`]: Date.now(),
    [`userBuilds/${b.uid}/${buildId}/status`]: 'building', [`apps/${b.uid}/${b.appId}/lastStatus`]: 'building',
    ...(b.startedAt ? {} : { [`builds/${buildId}/startedAt`]: Date.now() })
  });
  const k = pkgKey(bc.config.packageName);
  let keystore = null;
  let iosSigning = null;
  if (job === 'android') {
    const ks = await db.get(`keystores/${k}`);
    if (ks && ks.owner === b.uid) keystore = JSON.parse(await decryptStr(env, ks.data));
  }
  if (job === 'ios') {
    const sg = await db.get(`iosSigning/${k}`);
    if (sg && sg.owner === b.uid) iosSigning = JSON.parse(await decryptStr(env, sg.data));
  }
  const origin = new URL(req.url).origin;
  const f = (id) => (id ? `${origin}/api/internal/files/${id}` : null);
  return json({
    buildId, job, versionCode: bc.versionCode, config: bc.config, keystore, iosSigning,
    iconUrl: f(bc.config.iconFileId),
    sourceUrl: f(bc.config.source.fileId),
    splashUrl: f(bc.config.splash?.fileId),
    errorPageUrl: f(bc.config.errorPageFileId),
    fcmUrl: f(bc.config.fcmFileId),
    altIconUrls: (bc.config.altIconFileIds || []).map(f),
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

// Jenis artefak per platform
export const ARTIFACTS = {
  apk: { job: 'android', mime: 'application/vnd.android.package-archive' },
  aab: { job: 'android', mime: 'application/octet-stream' },
  exe: { job: 'windows', mime: 'application/vnd.microsoft.portable-executable' },
  msi: { job: 'windows', mime: 'application/x-msi' },
  dmg: { job: 'macos', mime: 'application/x-apple-diskimage' },
  appimage: { job: 'linux', mime: 'application/octet-stream', ext: 'AppImage' },
  deb: { job: 'linux', mime: 'application/vnd.debian.binary-package' },
  ipa: { job: 'ios', mime: 'application/octet-stream' },
  xcode: { job: 'ios', mime: 'application/zip', ext: 'xcode.zip' }
};
const FINAL = ['success', 'failed', 'partial'];

// POST /api/internal/builds/:id/artifact?type=apk|aab|exe|msi|dmg|appimage|deb|ipa|xcode   (body: file biner)
export async function uploadArtifact(req, env, buildId) {
  requireBuilder(req, env);
  const type = new URL(req.url).searchParams.get('type');
  const spec = ARTIFACTS[type];
  if (!spec) throw new HttpError(400, 'Jenis artefak tidak dikenal');
  const { db, b } = await loadBuild(env, buildId);
  const buf = await req.arrayBuffer();
  if (!buf.byteLength) throw new HttpError(400, 'File kosong');
  const name = `${b.packageName}-${b.versionName}.${spec.ext || type}`;
  const r = await putFile(env, buf, { owner: b.uid, kind: type, name, mime: spec.mime, public: true, buildId });
  await db.update(`builds/${buildId}`, {
    [`artifacts/${type}`]: { fileId: r.fileId, size: r.size, name },
    ...(type === 'apk' || type === 'aab' ? { [`${type}FileId`]: r.fileId, [`${type}Size`]: r.size } : {}),
    updatedAt: Date.now()
  });
  return json({ fileId: r.fileId });
}

// POST /api/internal/builds/:id/meta  { sha256 } — sidik jari sertifikat untuk assetlinks.json
export async function buildMeta(req, env, buildId) {
  requireBuilder(req, env);
  const body = await readJson(req);
  const { db, b } = await loadBuild(env, buildId);
  const sha = String(body.sha256 || '').toUpperCase();
  if (!/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(sha)) throw new HttpError(400, 'SHA-256 tidak valid');
  await db.update('', { [`apps/${b.uid}/${b.appId}/signingSha256`]: sha, [`builds/${buildId}/signingSha256`]: sha });
  return json({ ok: true });
}

// POST /api/internal/builds/:id/finish  { job, status: 'success'|'failed', error?, logUrl?, failedAt? }
export async function finish(req, env, ctx, buildId) {
  requireBuilder(req, env);
  const body = await readJson(req);
  const job = String(body.job || 'android');
  const { db, b, bc } = await loadBuild(env, buildId);
  const ok = body.status === 'success';
  if (ok) {
    const fresh = await db.get(`builds/${buildId}`);
    const need = Object.entries(ARTIFACTS).filter(([, v]) => v.job === job).map(([k]) => k);
    const has = (t) => fresh.artifacts?.[t] || fresh[`${t}FileId`];
    if (job === 'android' && (!has('apk') || !has('aab'))) throw new HttpError(400, 'Artefak Android belum lengkap');
    if (job !== 'android' && !need.some(has)) throw new HttpError(400, `Artefak ${job} belum ada`);
  }
  await db.update(`builds/${buildId}`, {
    [`jobs/${job}`]: ok ? 'success' : 'failed',
    ...(!ok ? { [`jobErrors/${job}`]: String(body.error || 'Build gagal').slice(0, 500) } : {}),
    ...(body.logUrl ? { [`logs/${job}`]: String(body.logUrl).slice(0, 300), logUrl: String(body.logUrl).slice(0, 300) } : {}),
    updatedAt: Date.now()
  });

  // Hitung status keseluruhan setelah semua job platform selesai
  const fresh = await db.get(`builds/${buildId}`);
  const jobs = fresh.jobs || { android: ok ? 'success' : 'failed' };
  const states = Object.values(jobs);
  if (states.some((s) => s === 'queued' || s === 'building')) return json({ ok: true, pending: true });
  if (!(await db.claim(`builds/${buildId}/finalized`))) return json({ ok: true, duplicate: true });

  const succeeded = Object.keys(jobs).filter((j) => jobs[j] === 'success');
  const overall = succeeded.length === states.length ? 'success' : succeeded.length ? 'partial' : 'failed';
  const firstError = Object.values(fresh.jobErrors || {})[0] || body.error || 'Build gagal';
  await setStatus(db, b, buildId, overall, {
    finishedAt: Date.now(),
    ...(overall !== 'success' ? { error: String(firstError).slice(0, 500), failedAt: body.failedAt || 'building' } : {})
  });
  ctx.waitUntil(db.remove(`buildConfigs/${buildId}`).catch(() => {}));

  if (bc.email) {
    const link = `${(env.APP_ORIGIN || '').split(',')[0]}/build/${buildId}`;
    const LABEL = { android: 'Android', windows: 'Windows', macos: 'macOS', linux: 'Linux', ios: 'iOS' };
    const list = Object.entries(jobs).map(([j, s]) => `${LABEL[j] || j}: ${s === 'success' ? '✅' : '❌'}`).join('<br>');
    const mail = overall !== 'failed'
      ? renderEmail(env, {
        title: `${b.name} v${b.versionName} siap diunduh`,
        intro: `Build <b>${escapeHtml(b.name)}</b> (${escapeHtml(b.packageName)}) selesai.<br><br>${list}`,
        buttonText: 'Unduh aplikasi', buttonUrl: link
      })
      : renderEmail(env, {
        title: `Build ${b.name} gagal`,
        intro: `Maaf, build <b>${escapeHtml(b.name)}</b> gagal: ${escapeHtml(firstError)}.<br><br>${list}`,
        buttonText: 'Lihat detail', buttonUrl: link
      });
    ctx.waitUntil(sendEmail(env, { to: bc.email, subject: overall !== 'failed' ? `✅ ${b.name} siap diunduh` : `❌ Build ${b.name} gagal`, ...mail })
      .catch((e) => console.error('email', e.message)));
  }
  return json({ ok: true, status: overall });
}
