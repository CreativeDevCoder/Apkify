import fs from 'node:fs';
import path from 'node:path';
import { reportFailure } from './lib.mjs';

if (fs.existsSync(path.join(process.env.RUNNER_TEMP || '/tmp', 'reported'))) process.exit(0);
const job = process.env.JOB || 'android';
const msg = { ios: 'Kompilasi iOS gagal. Periksa sertifikat/profile atau lihat log.', android: 'Kompilasi Android gagal.' }[job] || `Kompilasi ${job} gagal. Lihat log build.`;
await reportFailure(process.argv[2] || 'building', msg, job);
