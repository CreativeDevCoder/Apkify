// 10 penyedia penyimpanan gratis yang berbeda. Masing-masing punya adapter:
//   upload(env, { key, body, size, mime, name }) -> ref (disimpan di RTDB)
//   download(env, ref) -> Response (body stream)
//   remove(env, ref)
// Kapasitas default = perkiraan paket gratis; cek ulang & ubah dari halaman Admin.
import { AwsClient } from 'aws4fetch';
import { cachedToken, invalidateToken } from '../tokenCache.js';

const GB = 1024 ** 3;

async function must(res, name) {
  if (res.ok) return res;
  let t = '';
  try { t = (await res.text()).slice(0, 300); } catch { /* */ }
  const e = new Error(`${name} ${res.status}: ${t}`);
  e.status = res.status;
  throw e;
}

// Helper OAuth refresh-token (Google Drive, Dropbox, OneDrive)
function oauthRefresh(cacheKey, url, params) {
  return cachedToken(cacheKey, async () => {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
    const d = await r.json();
    if (!r.ok) throw new Error(`${cacheKey} token ${r.status}: ${d.error_description || d.error || ''}`);
    return { value: d.access_token, expiresIn: d.expires_in || 3600 };
  });
}

// Helper S3-compatible (Backblaze B2)
function s3(env, prefix) {
  const client = new AwsClient({ accessKeyId: env[`${prefix}_KEY_ID`], secretAccessKey: env[`${prefix}_APP_KEY`], service: 's3' });
  const base = `${env[`${prefix}_ENDPOINT`].replace(/\/$/, '')}/${env[`${prefix}_BUCKET`]}`;
  return { client, url: (key) => `${base}/${key.split('/').map(encodeURIComponent).join('/')}` };
}

export const STORAGE_PROVIDERS = [
  // 1. Cloudflare R2 — 10 GB gratis, tanpa biaya egress, akses via binding (paling cepat)
  {
    id: 'r2', name: 'Cloudflare R2', capacity: 10 * GB, note: '10 GB, tanpa egress',
    configured: (e) => !!e.R2,
    async upload(env, f) {
      await env.R2.put(f.key, f.body, { httpMetadata: { contentType: f.mime } });
      return { key: f.key };
    },
    async download(env, ref) {
      const o = await env.R2.get(ref.key);
      if (!o) throw Object.assign(new Error('R2: objek tidak ada'), { status: 404 });
      return new Response(o.body, { headers: { 'content-length': String(o.size) } });
    },
    async remove(env, ref) { await env.R2.delete(ref.key); }
  },

  // 2. Backblaze B2 — 10 GB gratis, S3 API
  {
    id: 'b2', name: 'Backblaze B2', capacity: 10 * GB, note: '10 GB (S3 API)',
    configured: (e) => !!(e.B2_KEY_ID && e.B2_APP_KEY && e.B2_BUCKET && e.B2_ENDPOINT),
    async upload(env, f) {
      const { client, url } = s3(env, 'B2');
      await must(await client.fetch(url(f.key), { method: 'PUT', body: f.body, headers: { 'content-type': f.mime } }), 'B2');
      return { key: f.key };
    },
    async download(env, ref) {
      const { client, url } = s3(env, 'B2');
      return must(await client.fetch(url(ref.key)), 'B2');
    },
    async remove(env, ref) {
      const { client, url } = s3(env, 'B2');
      await client.fetch(url(ref.key), { method: 'DELETE' });
    }
  },

  // 3. Google Drive — 15 GB (dibagi dengan Gmail/Photos)
  {
    id: 'gdrive', name: 'Google Drive', capacity: 15 * GB, note: '15 GB',
    configured: (e) => !!(e.GDRIVE_CLIENT_ID && e.GDRIVE_CLIENT_SECRET && e.GDRIVE_REFRESH_TOKEN),
    token: (env) => oauthRefresh('gdrive', 'https://oauth2.googleapis.com/token', {
      client_id: env.GDRIVE_CLIENT_ID, client_secret: env.GDRIVE_CLIENT_SECRET, refresh_token: env.GDRIVE_REFRESH_TOKEN, grant_type: 'refresh_token'
    }),
    async upload(env, f) {
      const token = await this.token(env);
      const meta = { name: f.key.replace(/\//g, '_'), ...(env.GDRIVE_FOLDER_ID ? { parents: [env.GDRIVE_FOLDER_ID] } : {}) };
      const boundary = `b${crypto.randomUUID()}`;
      const head = `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\ncontent-type: ${f.mime}\r\n\r\n`;
      const body = new Blob([head, f.body, `\r\n--${boundary}--`]);
      const r = await must(await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${boundary}` }, body
      }), 'GDrive');
      return { id: (await r.json()).id };
    },
    async download(env, ref) {
      const token = await this.token(env);
      return must(await fetch(`https://www.googleapis.com/drive/v3/files/${ref.id}?alt=media`, { headers: { authorization: `Bearer ${token}` } }), 'GDrive');
    },
    async remove(env, ref) {
      const token = await this.token(env);
      await fetch(`https://www.googleapis.com/drive/v3/files/${ref.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
    }
  },

  // 4. Dropbox — 2 GB (Basic)
  {
    id: 'dropbox', name: 'Dropbox', capacity: 2 * GB, note: '2 GB (maks 150 MB/file)',
    configured: (e) => !!(e.DROPBOX_APP_KEY && e.DROPBOX_APP_SECRET && e.DROPBOX_REFRESH_TOKEN),
    token: (env) => oauthRefresh('dropbox', 'https://api.dropboxapi.com/oauth2/token', {
      grant_type: 'refresh_token', refresh_token: env.DROPBOX_REFRESH_TOKEN, client_id: env.DROPBOX_APP_KEY, client_secret: env.DROPBOX_APP_SECRET
    }),
    async upload(env, f) {
      const token = await this.token(env);
      const path = `/apkify/${f.key}`;
      await must(await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', mute: true })
        },
        body: f.body
      }), 'Dropbox');
      return { path };
    },
    async download(env, ref) {
      const token = await this.token(env);
      return must(await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'Dropbox-API-Arg': JSON.stringify({ path: ref.path }) }
      }), 'Dropbox');
    },
    async remove(env, ref) {
      const token = await this.token(env);
      await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ path: ref.path })
      });
    }
  },

  // 5. Microsoft OneDrive — 5 GB (Microsoft Graph)
  {
    id: 'onedrive', name: 'Microsoft OneDrive', capacity: 5 * GB, note: '5 GB',
    configured: (e) => !!(e.ONEDRIVE_CLIENT_ID && e.ONEDRIVE_REFRESH_TOKEN),
    token: (env) => oauthRefresh('onedrive', 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
      client_id: env.ONEDRIVE_CLIENT_ID, ...(env.ONEDRIVE_CLIENT_SECRET ? { client_secret: env.ONEDRIVE_CLIENT_SECRET } : {}),
      refresh_token: env.ONEDRIVE_REFRESH_TOKEN, grant_type: 'refresh_token', scope: 'Files.ReadWrite offline_access'
    }),
    async upload(env, f) {
      const token = await this.token(env);
      const r = await must(await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/apkify/${f.key.split('/').map(encodeURIComponent).join('/')}:/content`, {
        method: 'PUT', headers: { authorization: `Bearer ${token}`, 'content-type': f.mime }, body: f.body
      }), 'OneDrive');
      return { id: (await r.json()).id };
    },
    async download(env, ref) {
      const token = await this.token(env);
      return must(await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${ref.id}/content`, { headers: { authorization: `Bearer ${token}` } }), 'OneDrive');
    },
    async remove(env, ref) {
      const token = await this.token(env);
      await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${ref.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
    }
  },

  // 6. Box — 10 GB (Individual, maks 250 MB/file). Client Credentials Grant.
  {
    id: 'box', name: 'Box', capacity: 10 * GB, note: '10 GB (maks 250 MB/file)',
    configured: (e) => !!(e.BOX_CLIENT_ID && e.BOX_CLIENT_SECRET && e.BOX_USER_ID),
    token: (env) => oauthRefresh('box', 'https://api.box.com/oauth2/token', {
      grant_type: 'client_credentials', client_id: env.BOX_CLIENT_ID, client_secret: env.BOX_CLIENT_SECRET,
      box_subject_type: 'user', box_subject_id: env.BOX_USER_ID
    }),
    async upload(env, f) {
      const token = await this.token(env);
      const fd = new FormData();
      fd.set('attributes', JSON.stringify({ name: f.key.replace(/\//g, '_'), parent: { id: env.BOX_FOLDER_ID || '0' } }));
      fd.set('file', new Blob([f.body], { type: f.mime }), 'file');
      const r = await must(await fetch('https://upload.box.com/api/2.0/files/content', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd }), 'Box');
      return { id: (await r.json()).entries[0].id };
    },
    async download(env, ref) {
      const token = await this.token(env);
      return must(await fetch(`https://api.box.com/2.0/files/${ref.id}/content`, { headers: { authorization: `Bearer ${token}` } }), 'Box');
    },
    async remove(env, ref) {
      const token = await this.token(env);
      await fetch(`https://api.box.com/2.0/files/${ref.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
    }
  },

  // 7. pCloud — 10 GB. Token OAuth pCloud tidak kedaluwarsa.
  {
    id: 'pcloud', name: 'pCloud', capacity: 10 * GB, note: '10 GB',
    configured: (e) => !!e.PCLOUD_TOKEN,
    host: (env) => env.PCLOUD_API_HOST || 'api.pcloud.com', // EU: eapi.pcloud.com
    async upload(env, f) {
      const qs = new URLSearchParams({ folderid: env.PCLOUD_FOLDER_ID || '0', filename: f.key.replace(/\//g, '_'), nopartial: '1' });
      const r = await must(await fetch(`https://${this.host(env)}/uploadfile?${qs}`, {
        method: 'PUT', headers: { authorization: `Bearer ${env.PCLOUD_TOKEN}` }, body: f.body
      }), 'pCloud');
      const d = await r.json();
      if (d.result !== 0) throw new Error(`pCloud ${d.result}: ${d.error}`);
      return { id: d.metadata[0].fileid };
    },
    async download(env, ref) {
      const r = await must(await fetch(`https://${this.host(env)}/getfilelink?fileid=${ref.id}`, { headers: { authorization: `Bearer ${env.PCLOUD_TOKEN}` } }), 'pCloud');
      const d = await r.json();
      if (d.result !== 0) throw Object.assign(new Error(`pCloud ${d.error}`), { status: 404 });
      return must(await fetch(`https://${d.hosts[0]}${d.path}`), 'pCloud');
    },
    async remove(env, ref) {
      await fetch(`https://${this.host(env)}/deletefile?fileid=${ref.id}`, { headers: { authorization: `Bearer ${env.PCLOUD_TOKEN}` } });
    }
  },

  // 8. Supabase Storage — 1 GB (Free)
  {
    id: 'supabase', name: 'Supabase Storage', capacity: 1 * GB, note: '1 GB (maks 50 MB/file)',
    configured: (e) => !!(e.SUPABASE_URL && e.SUPABASE_SERVICE_KEY),
    url: (env, key) => `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${env.SUPABASE_BUCKET || 'apkify'}/${key}`,
    async upload(env, f) {
      await must(await fetch(this.url(env, f.key), {
        method: 'POST',
        headers: { authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY, 'content-type': f.mime, 'x-upsert': 'true' },
        body: f.body
      }), 'Supabase');
      return { key: f.key };
    },
    async download(env, ref) {
      return must(await fetch(this.url(env, ref.key), { headers: { authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY } }), 'Supabase');
    },
    async remove(env, ref) {
      await fetch(this.url(env, ref.key), { method: 'DELETE', headers: { authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, apikey: env.SUPABASE_SERVICE_KEY } });
    }
  },

  // 9. GitHub Releases — aset rilis (maks 2 GB/file). Satu rilis per bulan agar jumlah aset per rilis tidak berlebihan.
  {
    id: 'ghrelease', name: 'GitHub Releases', capacity: 50 * GB, note: 'Batas lunak, maks 2 GB/file',
    configured: (e) => !!(e.GHSTORE_TOKEN && e.GHSTORE_REPO),
    gh: (env, path, init = {}) => fetch(`https://api.github.com/repos/${env.GHSTORE_REPO}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${env.GHSTORE_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'apkify-worker', 'x-github-api-version': '2022-11-28', ...(init.headers || {}) }
    }),
    async releaseId(env) {
      const tag = `store-${new Date().toISOString().slice(0, 7)}`;
      return cachedToken(`ghrel-${tag}`, async () => {
        let r = await this.gh(env, `/releases/tags/${tag}`);
        if (r.status === 404) {
          r = await this.gh(env, '/releases', { method: 'POST', body: JSON.stringify({ tag_name: tag, name: tag, body: 'Penyimpanan file Apkify', prerelease: true }) });
        }
        await must(r, 'GitHub');
        return { value: String((await r.json()).id), expiresIn: 86400 };
      });
    },
    async upload(env, f) {
      const rid = await this.releaseId(env);
      const name = f.key.replace(/\//g, '_');
      const r = await fetch(`https://uploads.github.com/repos/${env.GHSTORE_REPO}/releases/${rid}/assets?name=${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${env.GHSTORE_TOKEN}`, 'content-type': 'application/octet-stream', 'user-agent': 'apkify-worker', accept: 'application/vnd.github+json' },
        body: f.body
      });
      if (r.status === 404) invalidateToken(`ghrel-store-${new Date().toISOString().slice(0, 7)}`);
      await must(r, 'GitHub');
      return { id: (await r.json()).id };
    },
    async download(env, ref) {
      return must(await this.gh(env, `/releases/assets/${ref.id}`, { headers: { accept: 'application/octet-stream' } }), 'GitHub');
    },
    async remove(env, ref) { await this.gh(env, `/releases/assets/${ref.id}`, { method: 'DELETE' }); }
  },

  // 10. Koofr — 10 GB, WebDAV dengan app password
  {
    id: 'koofr', name: 'Koofr', capacity: 10 * GB, note: '10 GB (WebDAV)',
    configured: (e) => !!(e.KOOFR_EMAIL && e.KOOFR_APP_PASSWORD),
    auth: (env) => `Basic ${btoa(`${env.KOOFR_EMAIL}:${env.KOOFR_APP_PASSWORD}`)}`,
    url: (key) => `https://app.koofr.net/dav/Koofr/apkify/${key.replace(/\//g, '_')}`,
    async upload(env, f) {
      // pastikan folder ada (201 dibuat / 405 sudah ada)
      await fetch('https://app.koofr.net/dav/Koofr/apkify', { method: 'MKCOL', headers: { authorization: this.auth(env) } }).catch(() => {});
      await must(await fetch(this.url(f.key), { method: 'PUT', headers: { authorization: this.auth(env), 'content-type': f.mime }, body: f.body }), 'Koofr');
      return { key: f.key };
    },
    async download(env, ref) {
      return must(await fetch(this.url(ref.key), { headers: { authorization: this.auth(env) } }), 'Koofr');
    },
    async remove(env, ref) { await fetch(this.url(ref.key), { method: 'DELETE', headers: { authorization: this.auth(env) } }); }
  }
];

// Batas ukuran per file untuk penyedia tertentu
export const MAX_FILE = { dropbox: 150 * 1024 ** 2, box: 250 * 1024 ** 2, supabase: 50 * 1024 ** 2 };
