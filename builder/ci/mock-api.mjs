// API tiruan untuk CI "template-check": menyajikan konfigurasi fixture (disanitasi dengan
// worker/src/config.js yang sama seperti produksi), ikon, google-services.json palsu, dan ZIP proyek Vite.
// Pemakaian: FIXTURE=full node builder/ci/mock-api.mjs  (port 8787)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { sanitizeConfig } from '../../worker/src/config.js';
import { FIXTURES } from './fixtures.mjs';

const DIR = path.dirname(new URL(import.meta.url).pathname);
const name = process.env.FIXTURE || 'minimal';
const fx = FIXTURES[name];
if (!fx) { console.error('fixture tidak dikenal', name); process.exit(1); }
const config = sanitizeConfig(fx);
const TMP = process.env.RUNNER_TEMP || '/tmp';

const sharp = (await import(path.join(DIR, '../scripts/node_modules/sharp/lib/index.js'))).default;
const icon = await sharp({ create: { width: 512, height: 512, channels: 4, background: '#4f46e5' } })
  .composite([{ input: Buffer.from('<svg width="512" height="512"><circle cx="256" cy="256" r="160" fill="#fff"/></svg>') }]).png().toBuffer();

const zipPath = path.join(TMP, 'fixture-src.zip');
fs.rmSync(zipPath, { force: true });
execFileSync('zip', ['-qr', zipPath, 'vite-app'], { cwd: DIR });

const gs = JSON.stringify({
  project_info: { project_number: '123456789012', project_id: 'apkify-ci', storage_bucket: 'apkify-ci.appspot.com' },
  client: [{
    client_info: { mobilesdk_app_id: '1:123456789012:android:0123456789abcdef', android_client_info: { package_name: config.packageName } },
    oauth_client: [], api_key: [{ current_key: 'AIzaSyA-ci-fake-key-000000000000000000' }],
    services: { appinvite_service: { other_platform_oauth_client: [] } }
  }],
  configuration_version: '1'
});

const files = { icon: ['image/png', icon], alt: ['image/png', icon], gs: ['application/json', Buffer.from(gs)], zip: ['application/zip', () => fs.readFileSync(zipPath)] };

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.headers.authorization !== `Bearer ${process.env.BUILDER_SECRET || 'ci'}`) { res.writeHead(401); return res.end(); }
  let body = ''; for await (const ch of req) body += ch;
  const origin = `http://${req.headers.host}`;
  if (/\/config$/.test(u.pathname)) {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({
      buildId: 'ci', job: u.searchParams.get('job') || 'android', versionCode: 1, config, keystore: null,
      iconUrl: `${origin}/api/internal/files/icon`,
      sourceUrl: config.source.fileId ? `${origin}/api/internal/files/zip` : null,
      splashUrl: null, errorPageUrl: null,
      fcmUrl: config.fcmFileId ? `${origin}/api/internal/files/gs` : null,
      altIconUrls: (config.altIconFileIds || []).map(() => `${origin}/api/internal/files/alt`),
      appId: 'ciapp000001', apiBase: origin
    }));
  }
  const m = u.pathname.match(/\/files\/(\w+)$/);
  if (m && files[m[1]]) {
    const [type, data] = files[m[1]];
    res.writeHead(200, { 'content-type': type });
    return res.end(typeof data === 'function' ? data() : data);
  }
  if (req.method === 'POST') { console.log('POST', u.pathname, body.slice(0, 200)); res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"ok":true}'); }
  res.writeHead(404); res.end();
}).listen(8787, () => console.log(`mock API fixture=${name} :8787`));
