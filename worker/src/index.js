import { json, corsHeaders, HttpError } from './util.js';
import { rtdb } from './firebase.js';
import { upload, createBuild, downloadKeystore, deleteApp } from './routes/user.js';
import { serveFile } from './routes/files.js';
import { getConfig, getFile, saveKeystore, uploadArtifact, finish, buildMeta } from './routes/internal.js';
import { siteMeta, siteIcon, ping, appAnalytics, iosSigning } from './routes/platform.js';
import { handleAdmin } from './routes/admin.js';
import { aiGenerate, aiQuota } from './routes/ai.js';
import { uploadKeystore, getRemote, ownerRemote, uploadBundle, mySites, publishSite, deleteSite, serveSite } from './routes/extra.js';
import {
  listPosts, getPost, adminPosts, listMarket, getListing, myListings, saveListing, markSold, deleteListing, adminMarket, contact, adminMessages
} from './routes/content.js';

async function publicStats(req, env, ctx) {
  // Edge cache 5 menit: ribuan pengunjung beranda = 1 baca RTDB per data center
  const cache = caches.default;
  const key = new Request(new URL('/api/public/stats', req.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;
  const stats = (await rtdb(env).get('stats/public')) || {};
  const res = json({ totalBuilds: stats.totalBuilds || 0 }, 200, { 'cache-control': 'public, max-age=300, s-maxage=300' });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

async function route(req, env, ctx) {
  const url = new URL(req.url);
  const p = url.pathname;
  const m = req.method;
  let r;

  if (p === '/api/health') return json({ ok: true, time: Date.now() });
  if (p === '/api/public/stats' && m === 'GET') return publicStats(req, env, ctx);
  if ((r = p.match(/^\/api\/files\/([A-Za-z0-9]+)(?:\/([^/]+))?$/)) && m === 'GET') return serveFile(req, env, ctx, r[1], r[2] && decodeURIComponent(r[2]));

  if (p === '/api/public/posts' && m === 'GET') return listPosts(req, env, ctx);
  if ((r = p.match(/^\/api\/public\/posts\/([a-z0-9-]+)$/)) && m === 'GET') return getPost(req, env, ctx, r[1]);
  if (p === '/api/public/market' && m === 'GET') return listMarket(req, env, ctx);
  if ((r = p.match(/^\/api\/public\/market\/([A-Za-z0-9]+)$/)) && m === 'GET') return getListing(req, env, r[1]);
  if (p === '/api/public/contact' && m === 'POST') return contact(req, env, ctx);

  if (p === '/api/ai/quota' && m === 'GET') return aiQuota(req, env);
  if (p === '/api/ai/generate' && m === 'POST') return aiGenerate(req, env);

  if (p === '/api/market/mine' && m === 'GET') return myListings(req, env);
  if (p === '/api/market' && m === 'POST') return saveListing(req, env, null);
  if ((r = p.match(/^\/api\/market\/([A-Za-z0-9]+)$/))) {
    if (m === 'PUT') return saveListing(req, env, r[1]);
    if (m === 'DELETE') return deleteListing(req, env, r[1]);
  }
  if ((r = p.match(/^\/api\/market\/([A-Za-z0-9]+)\/sold$/)) && m === 'POST') return markSold(req, env, r[1]);

  if ((r = p.match(/^\/api\/public\/apps\/([A-Za-z0-9]+)\/remote$/)) && m === 'GET') return getRemote(req, env, ctx, r[1]);
  if (p === '/api/public/site-meta' && m === 'GET') return siteMeta(req, env, ctx);
  if (p === '/api/public/site-icon' && m === 'GET') return siteIcon(req, env);
  if ((r = p.match(/^\/api\/public\/apps\/([A-Za-z0-9]+)\/ping$/)) && m === 'POST') return ping(req, env, r[1]);
  if ((r = p.match(/^\/api\/apps\/([A-Za-z0-9]+)\/analytics$/)) && m === 'GET') return appAnalytics(req, env, r[1]);
  if ((r = p.match(/^\/api\/apps\/([A-Za-z0-9]+)\/ios-signing$/))) return iosSigning(req, env, r[1]);
  if ((r = p.match(/^\/api\/internal\/builds\/([A-Za-z0-9]+)\/meta$/)) && m === 'POST') return buildMeta(req, env, r[1]);
  if (p === '/api/keystores' && m === 'POST') return uploadKeystore(req, env);
  if ((r = p.match(/^\/api\/apps\/([A-Za-z0-9]+)\/remote$/)) && (m === 'GET' || m === 'PUT')) return ownerRemote(req, env, r[1]);
  if ((r = p.match(/^\/api\/apps\/([A-Za-z0-9]+)\/bundle$/)) && m === 'POST') return uploadBundle(req, env, ctx, r[1]);
  if (p === '/api/sites/mine' && m === 'GET') return mySites(req, env);
  if ((r = p.match(/^\/api\/sites\/([a-z0-9-]+)$/))) {
    if (m === 'POST') return publishSite(req, env, ctx, r[1]);
    if (m === 'DELETE') return deleteSite(req, env, ctx, r[1]);
  }

  if (p === '/api/uploads' && m === 'POST') return upload(req, env);
  if (p === '/api/builds' && m === 'POST') return createBuild(req, env, ctx);
  if ((r = p.match(/^\/api\/apps\/([A-Za-z0-9]+)\/keystore$/)) && m === 'GET') return downloadKeystore(req, env, r[1]);
  if ((r = p.match(/^\/api\/apps\/([A-Za-z0-9]+)$/)) && m === 'DELETE') return deleteApp(req, env, ctx, r[1]);

  // Builder (GitHub Actions)
  if ((r = p.match(/^\/api\/internal\/builds\/([A-Za-z0-9]+)\/config$/)) && m === 'GET') return getConfig(req, env, r[1]);
  if ((r = p.match(/^\/api\/internal\/builds\/([A-Za-z0-9]+)\/artifact$/)) && m === 'POST') return uploadArtifact(req, env, r[1]);
  if ((r = p.match(/^\/api\/internal\/builds\/([A-Za-z0-9]+)\/finish$/)) && m === 'POST') return finish(req, env, ctx, r[1]);
  if ((r = p.match(/^\/api\/internal\/files\/([A-Za-z0-9]+)$/)) && m === 'GET') return getFile(req, env, r[1]);
  if (p === '/api/internal/keystores' && m === 'POST') return saveKeystore(req, env);

  if (p.startsWith('/api/admin/posts')) return adminPosts(req, env, p);
  if (p.startsWith('/api/admin/market')) return adminMarket(req, env, p);
  if (p.startsWith('/api/admin/messages')) return adminMessages(req, env, p);
  if (p.startsWith('/api/admin/')) return handleAdmin(req, env, p);
  throw new HttpError(404, 'Endpoint tidak ditemukan');
}

// Cron: build yang macet > 40 menit ditandai gagal (mis. runner mati di tengah jalan)
async function sweepStuck(env) {
  const db = rtdb(env);
  const limit = Date.now() - 40 * 60 * 1000;
  for (const status of ['queued', 'building', 'uploading']) {
    const rows = (await db.query('builds', { orderBy: 'status', equalTo: status })) || {};
    const patch = {};
    for (const [id, b] of Object.entries(rows)) {
      if ((b.updatedAt || b.createdAt) > limit) continue;
      patch[`builds/${id}/status`] = 'failed';
      patch[`builds/${id}/error`] = 'Build melebihi batas waktu. Silakan coba lagi.';
      patch[`builds/${id}/updatedAt`] = Date.now();
      patch[`userBuilds/${b.uid}/${id}/status`] = 'failed';
      patch[`apps/${b.uid}/${b.appId}/lastStatus`] = 'failed';
    }
    if (Object.keys(patch).length) await db.update('', patch);
  }
}

// Hapus penghitung kuota harian yang sudah lewat (hemat ukuran RTDB)
async function pruneQuotas(env) {
  // kunci kuota berstruktur {root}/{yyyymmdd}/{id} -> cukup 1 baca shallow + 1 patch per root
  const db = rtdb(env);
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (const root of ['quotaIp', 'contactQuota', 'aiQuota', 'quota', 'analyticsIp']) {
    const days = (await db.get(root, { shallow: 'true' })) || {};
    const patch = {};
    for (const d of Object.keys(days)) if (d < today) patch[`${root}/${d}`] = null;
    if (Object.keys(patch).length) await db.update('', patch);
  }
}

export default {
  async fetch(req, env, ctx) {
    // Hosting subdomain: namaanda.HOSTING_DOMAIN
    const host = new URL(req.url).hostname;
    if (env.HOSTING_DOMAIN && host.endsWith(`.${env.HOSTING_DOMAIN}`)) {
      try { return await serveSite(req, env, ctx); } catch (e) { console.error(e); return new Response('Server error', { status: 500 }); }
    }
    const cors = corsHeaders(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    let res;
    try {
      res = await route(req, env, ctx);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status >= 500) console.error(e);
      res = json({ error: status >= 500 && !(e instanceof HttpError) ? 'Terjadi kesalahan server' : e.message }, status);
    }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(sweepStuck(env));
    // sekali sehari (run pertama setelah 00:00 UTC)
    if (new Date().getUTCHours() === 0 && new Date().getUTCMinutes() < 30) ctx.waitUntil(pruneQuotas(env));
  }
};
