import { zipSync, strToU8 } from 'fflate';
import { requireUser, rtdb } from '../firebase.js';
import { putFile, getFileMeta, deleteFile } from '../storage/index.js';
import { sanitizeConfig } from '../config.js';
import { decryptStr } from '../crypto.js';
import { dispatchBuild } from '../github.js';
import { getSettings } from './admin.js';
import { json, HttpError, randomId, pkgKey, dayKey, readJson, b64, ipKey } from '../util.js';

const ICON_MAX = 2 * 1024 * 1024;

// POST /api/uploads  (multipart: file, kind=icon|zip)
export async function upload(req, env) {
  const user = await requireUser(env, req);
  const maxMb = Number(env.MAX_UPLOAD_MB || 50);
  const len = Number(req.headers.get('content-length') || 0);
  if (len > (maxMb + 1) * 1024 * 1024) throw new HttpError(413, `File maksimal ${maxMb} MB`);
  const form = await req.formData();
  const file = form.get('file');
  const kind = form.get('kind');
  if (!file || typeof file === 'string') throw new HttpError(400, 'File tidak ditemukan');
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf.slice(0, 8));

  if (kind === 'icon' || kind === 'splash') {
    if (buf.byteLength > ICON_MAX) throw new HttpError(413, 'Ikon maksimal 2 MB');
    const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
    if (!isPng) throw new HttpError(400, 'Ikon harus PNG');
    const r = await putFile(env, buf, { owner: user.uid, kind, name: `${kind}.png`, mime: 'image/png', public: true });
    return json({ fileId: r.fileId });
  }
  if (kind === 'image') {
    // gambar publik: screenshot marketplace, cover artikel
    if (user.anonymous) throw new HttpError(403, 'Silakan daftar untuk mengunggah gambar.');
    if (buf.byteLength > ICON_MAX) throw new HttpError(413, 'Gambar maksimal 2 MB');
    const mime = head[0] === 0x89 && head[1] === 0x50 ? 'image/png'
      : head[0] === 0xff && head[1] === 0xd8 ? 'image/jpeg'
        : head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 ? 'image/webp' : null;
    if (!mime) throw new HttpError(400, 'Gambar harus PNG, JPG, atau WebP');
    const r = await putFile(env, buf, { owner: user.uid, kind: 'image', name: `image.${mime.split('/')[1]}`, mime, public: true });
    return json({ fileId: r.fileId });
  }
  if (kind === 'zip') {
    if (!(head[0] === 0x50 && head[1] === 0x4b)) throw new HttpError(400, 'File bukan ZIP yang valid');
    const r = await putFile(env, buf, { owner: user.uid, kind: 'source', name: 'source.zip', mime: 'application/zip', public: false });
    return json({ fileId: r.fileId });
  }
  throw new HttpError(400, 'Jenis upload tidak dikenal');
}

// POST /api/builds
export async function createBuild(req, env, ctx) {
  const user = await requireUser(env, req);
  const body = await readJson(req, 700 * 1024);
  const settings = await getSettings(env);
  if (settings.maintenance) throw new HttpError(503, 'Layanan build sedang dalam perawatan. Coba lagi nanti.');
  const cfg = sanitizeConfig(body.config);
  const db = rtdb(env);

  // Batas build harian per user (tamu lebih kecil + batas per IP)
  const today = dayKey();
  const limit = Number(user.anonymous ? settings.anonDailyLimit : settings.dailyBuildLimit);
  const used = (await db.get(`quota/${today}/${user.uid}`)) || 0;
  if (used >= limit) {
    throw new HttpError(429, user.anonymous
      ? `Batas ${limit} build tamu per hari tercapai. Daftar gratis untuk batas lebih besar.`
      : `Batas ${limit} build per hari tercapai. Coba lagi besok.`);
  }
  let ipk = null;
  if (user.anonymous) {
    ipk = await ipKey(req, env);
    const ipUsed = (await db.get(`quotaIp/${today}/${ipk}`)) || 0;
    if (ipUsed >= Number(settings.anonIpDailyLimit)) throw new HttpError(429, 'Batas build tamu dari jaringan ini tercapai. Daftar gratis untuk melanjutkan.');
  }

  // Kepemilikan app & package name
  const pk = pkgKey(cfg.packageName);
  let appId = body.appId ? String(body.appId) : null;
  let app = null;
  if (appId) {
    if (!/^[A-Za-z0-9]{10,40}$/.test(appId)) throw new HttpError(400, 'appId tidak valid');
    app = await db.get(`apps/${user.uid}/${appId}`);
    if (!app) throw new HttpError(404, 'Aplikasi tidak ditemukan');
    if (app.packageName !== cfg.packageName) throw new HttpError(400, 'Package name tidak boleh diubah');
  }
  const owner = await db.get(`packages/${pk}`);
  if (owner && owner !== user.uid) throw new HttpError(409, 'Package name sudah dipakai pengguna lain. Gunakan nama lain.');

  // Validasi file milik user
  for (const fid of [cfg.iconFileId, cfg.source.fileId, cfg.splash.fileId, cfg.errorPageFileId].filter(Boolean)) {
    const m = await getFileMeta(env, fid);
    if (!m || m.owner !== user.uid) throw new HttpError(403, 'File tidak valid');
  }
  if (!cfg.iconFileId) throw new HttpError(400, 'Ikon wajib ada');

  // HTML tempel -> simpan sebagai file (RTDB tetap ramping)
  // Halaman error kustom -> file privat
  if (cfg.errorPageHtml) {
    const r = await putFile(env, new TextEncoder().encode(cfg.errorPageHtml), { owner: user.uid, kind: 'source', name: 'error.html', mime: 'text/html', public: false });
    cfg.errorPageFileId = r.fileId;
    delete cfg.errorPageHtml;
  }

  if (cfg.source.type === 'html') {
    if (cfg.source.html) {
      const bytes = new TextEncoder().encode(cfg.source.html);
      const r = await putFile(env, bytes, { owner: user.uid, kind: 'source', name: 'index.html', mime: 'text/html', public: false });
      cfg.source.fileId = r.fileId;
      delete cfg.source.html;
    }
    if (!cfg.source.fileId) throw new HttpError(400, 'Kode HTML kosong');
  }
  if (cfg.source.type === 'zip' && !cfg.source.fileId) throw new HttpError(400, 'File ZIP belum diunggah');

  const now = Date.now();
  if (!appId) appId = randomId(20);
  const auto = (app?.versionCode || 0) + 1;
  if (cfg.versionCodeOverride && cfg.versionCodeOverride < auto) {
    throw new HttpError(400, `Kode versi harus ≥ ${auto} (lebih besar dari build sebelumnya).`);
  }
  const versionCode = cfg.versionCodeOverride || auto;
  const buildId = randomId(20);
  const summary = { name: cfg.name, packageName: cfg.packageName, versionName: cfg.versionName, versionCode };

  await db.update('', {
    [`apps/${user.uid}/${appId}`]: {
      ...summary, iconFileId: cfg.iconFileId, config: cfg, lastBuildId: buildId, lastStatus: 'queued',
      createdAt: app?.createdAt || now, updatedAt: now
    },
    [`builds/${buildId}`]: {
      uid: user.uid, appId, ...summary, status: 'queued', createdAt: now, updatedAt: now,
      iconFileId: cfg.iconFileId, ...(cfg.source.fileId ? { sourceFileId: cfg.source.fileId } : {})
    },
    [`buildConfigs/${buildId}`]: { uid: user.uid, appId, versionCode, email: user.email || '', config: cfg },
    [`userBuilds/${user.uid}/${buildId}`]: { appId, name: cfg.name, versionName: cfg.versionName, status: 'queued', createdAt: now },
    [`packages/${pk}`]: user.uid,
    [`quota/${today}/${user.uid}`]: db.inc(1),
    ...(ipk ? { [`quotaIp/${today}/${ipk}`]: db.inc(1) } : {}),
    'stats/public/totalBuilds': db.inc(1)
  });

  try {
    await dispatchBuild(env, buildId);
  } catch (e) {
    await db.update('', {
      [`builds/${buildId}/status`]: 'failed', [`builds/${buildId}/error`]: 'Gagal memulai build di cloud. Coba lagi beberapa saat.',
      [`builds/${buildId}/updatedAt`]: Date.now(), [`apps/${user.uid}/${appId}/lastStatus`]: 'failed',
      [`userBuilds/${user.uid}/${buildId}/status`]: 'failed', [`quota/${today}/${user.uid}`]: db.inc(-1)
    });
    console.error('dispatch', e);
    throw new HttpError(502, 'Gagal memulai build. Coba lagi beberapa saat.');
  }
  return json({ buildId, appId });
}

// GET /api/apps/:appId/keystore -> zip berisi keystore.jks + info.txt
export async function downloadKeystore(req, env, appId) {
  const user = await requireUser(env, req);
  const db = rtdb(env);
  const app = await db.get(`apps/${user.uid}/${appId}`);
  if (!app) throw new HttpError(404, 'Aplikasi tidak ditemukan');
  const ks = await db.get(`keystores/${pkgKey(app.packageName)}`);
  if (!ks || ks.owner !== user.uid) throw new HttpError(404, 'Keystore belum ada (lakukan build pertama hingga sukses).');
  const data = JSON.parse(await decryptStr(env, ks.data));
  const info = `Keystore ${app.name} (${app.packageName})\n\nAlias     : ${data.alias}\nStore pass: ${data.storePass}\nKey pass  : ${data.keyPass}\nDibuat    : ${new Date(ks.createdAt).toISOString()}\n\nSIMPAN FILE INI DI TEMPAT AMAN. Tanpa keystore ini Anda tidak bisa merilis update dengan package name yang sama (kecuali memakai Play App Signing + reset upload key).\n`;
  const zip = zipSync({ 'upload-keystore.jks': b64.toBytes(data.keystore), 'KEYSTORE-INFO.txt': strToU8(info) });
  return new Response(zip, {
    headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${app.packageName}-keystore.zip"`, 'cache-control': 'no-store' }
  });
}

// DELETE /api/apps/:appId  (package & keystore tetap dimiliki user agar bisa dipakai lagi)
export async function deleteApp(req, env, ctx, appId) {
  const user = await requireUser(env, req);
  const db = rtdb(env);
  const app = await db.get(`apps/${user.uid}/${appId}`);
  if (!app) throw new HttpError(404, 'Aplikasi tidak ditemukan');
  const ub = (await db.query(`userBuilds/${user.uid}`, { orderBy: 'appId', equalTo: appId })) || {};
  const patch = { [`apps/${user.uid}/${appId}`]: null };
  const fileIds = new Set([app.iconFileId, app.config?.source?.fileId].filter(Boolean));
  const builds = await Promise.all(Object.keys(ub).map((id) => db.get(`builds/${id}`)));
  Object.keys(ub).forEach((id, i) => {
    patch[`userBuilds/${user.uid}/${id}`] = null;
    patch[`builds/${id}`] = null;
    patch[`buildConfigs/${id}`] = null;
    const b = builds[i];
    if (b?.apkFileId) fileIds.add(b.apkFileId);
    if (b?.aabFileId) fileIds.add(b.aabFileId);
    if (b?.iconFileId) fileIds.add(b.iconFileId);
    if (b?.sourceFileId) fileIds.add(b.sourceFileId);
  });
  await db.update('', patch);
  ctx.waitUntil(Promise.all([...fileIds].map((f) => deleteFile(env, f).catch(() => {}))));
  return json({ ok: true });
}
