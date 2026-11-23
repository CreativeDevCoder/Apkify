// Mengunggah hasil bundle Tauri lalu menandai job selesai.
import fs from 'node:fs';
import path from 'node:path';
import { uploadArtifact, finishJob } from './lib.mjs';

const JOB = process.env.JOB;
const WORK = process.env.WORK_DIR;
const TARGET_DIR = process.env.TAURI_TARGET_DIR || path.join(WORK, 'src-tauri', 'target');

function find(dir, ext) {
  if (!fs.existsSync(dir)) return null;
  const f = fs.readdirSync(dir).find((n) => n.toLowerCase().endsWith(ext));
  return f ? path.join(dir, f) : null;
}

const release = [path.join(TARGET_DIR, 'universal-apple-darwin', 'release', 'bundle'), path.join(TARGET_DIR, 'release', 'bundle')].find((p) => fs.existsSync(p));
if (!release) throw new Error('Folder bundle tidak ditemukan');
const want = { windows: [['exe', 'nsis', '.exe'], ['msi', 'msi', '.msi']], macos: [['dmg', 'dmg', '.dmg']], linux: [['appimage', 'appimage', '.appimage'], ['deb', 'deb', '.deb']] }[JOB];
let n = 0;
for (const [type, sub, ext] of want) {
  const f = find(path.join(release, sub), ext);
  if (f) { await uploadArtifact(type, f); n++; } else console.warn(`Tidak ada ${type}`);
}
if (!n) throw new Error('Tidak ada artefak desktop yang dihasilkan');
await finishJob(JOB, 'success');
console.log('Selesai ✔');
