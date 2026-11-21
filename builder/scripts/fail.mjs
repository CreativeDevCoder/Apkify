import fs from 'node:fs';
import path from 'node:path';
import { reportFailure } from './lib.mjs';

// prepare.mjs sudah melapor sendiri dengan pesan yang lebih jelas
if (fs.existsSync(path.join(process.env.RUNNER_TEMP || '/tmp', 'reported'))) process.exit(0);
const stage = process.argv[2] || 'building';
await reportFailure(stage, 'Kompilasi Android gagal. Periksa konfigurasi (mis. ID AdMob/OneSignal) lalu coba lagi.');
