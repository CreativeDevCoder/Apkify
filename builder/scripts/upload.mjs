import fs from 'node:fs';
import path from 'node:path';
import { api, BUILD_ID } from './lib.mjs';

const WORK = process.env.WORK_DIR;
const files = {
  apk: path.join(WORK, 'app/build/outputs/apk/release/app-release.apk'),
  aab: path.join(WORK, 'app/build/outputs/bundle/release/app-release.aab')
};

for (const [type, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) throw new Error(`${type.toUpperCase()} tidak ditemukan: ${file}`);
  const buf = fs.readFileSync(file);
  console.log(`Mengunggah ${type} (${(buf.length / 1048576).toFixed(2)} MB)…`);
  // coba ulang 3x untuk gangguan jaringan sesaat
  for (let i = 1; ; i++) {
    try {
      await api(`/api/internal/builds/${BUILD_ID}/artifact?type=${type}`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: buf });
      break;
    } catch (e) {
      if (i >= 3) throw e;
      console.warn(`Gagal (${e.message}), coba lagi…`);
      await new Promise((r) => setTimeout(r, 3000 * i));
    }
  }
}

await api(`/api/internal/builds/${BUILD_ID}/finish`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ status: 'success', logUrl: process.env.LOG_URL })
});
console.log('Selesai ✔');
