// Job "source" (Linux): ekstrak ZIP sekali dan build kode sumber (React/Vite/Vue/…) di Docker terisolasi,
// hasilnya diteruskan sebagai artifact ke job Windows/macOS/iOS (yang tidak punya Docker).
// ENV: JOBS = daftar job yang dilaporkan gagal bila langkah ini gagal (mis. "windows,macos")
import fs from 'node:fs';
import path from 'node:path';
import { api, download, reportFailure, extractZip, BUILD_ID } from './lib.mjs';

const TMP = process.env.RUNNER_TEMP || '/tmp';
const OUT = path.join(TMP, 'site');
const jobs = (process.env.JOBS || '').split(',').map((s) => s.trim()).filter(Boolean);

try {
  const first = jobs[0] || 'linux';
  const { config: c, sourceUrl } = await (await api(`/api/internal/builds/${BUILD_ID}/config?job=${first}`)).json();
  let built = false;
  if (c.source.type === 'zip' && sourceUrl) {
    const zip = await download(new URL(sourceUrl).pathname, path.join(TMP, 'source.zip'));
    fs.rmSync(OUT, { recursive: true, force: true });
    await extractZip(zip, OUT, TMP);
    built = true;
  }
  fs.appendFileSync(process.env.GITHUB_OUTPUT || '/dev/null', `built=${built}\n`);
  console.log(built ? `Konten siap di ${OUT}` : 'Sumber bukan ZIP: tidak ada yang perlu disiapkan.');
} catch (e) {
  console.error(e);
  const msg = e.user ? e.message : 'Gagal menyiapkan konten (unduh/ekstrak/build ZIP).';
  for (const j of jobs) await reportFailure('prepare', msg, j);
  process.exit(1);
}
