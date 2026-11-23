import fs from 'node:fs';
import path from 'node:path';
import { uploadArtifact, finishJob } from './lib.mjs';

const OUT = path.join(process.env.RUNNER_TEMP, 'ios-out');
if (fs.existsSync(path.join(OUT, 'xcode.zip'))) await uploadArtifact('xcode', path.join(OUT, 'xcode.zip'));
if (!fs.existsSync(path.join(OUT, 'app.ipa'))) throw new Error('IPA tidak ditemukan');
await uploadArtifact('ipa', path.join(OUT, 'app.ipa'));
await finishJob('ios', 'success', { signed: process.env.IOS_SIGNED === '1' });
console.log('Selesai ✔');
