// AI Studio: membuat aplikasi satu-halaman (HTML/CSS/JS) dari deskripsi teks
// memakai Cloudflare Workers AI (binding AI, ada jatah gratis harian dalam "neurons").
// "Kredit" = jatah generate per user per hari + batas global agar tidak melebihi kuota gratis.
import { requireUser, rtdb } from '../firebase.js';
import { getSettings } from './admin.js';
import { json, HttpError, readJson, dayKey } from '../util.js';

const SYSTEM = `Anda adalah developer front-end ahli. Buat SATU file HTML lengkap untuk aplikasi mobile (layar HP) sesuai permintaan pengguna.
Aturan:
- Output HANYA kode HTML lengkap diawali <!doctype html>, tanpa penjelasan, tanpa markdown.
- Semua CSS di <style> dan JS di <script> dalam file yang sama. Tanpa library/CDN eksternal, tanpa gambar eksternal (pakai emoji/SVG inline).
- Desain modern, rapi, responsif mobile-first, ramah sentuhan (tombol besar), mendukung mode gelap via prefers-color-scheme.
- Simpan data pengguna di localStorage bila relevan agar berjalan offline.
- Teks antarmuka dalam bahasa Indonesia kecuali diminta lain.
- Jangan pernah membuat form login palsu, phishing, atau meniru merek/aplikasi nyata.`;

function extractHtml(text) {
  let t = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fence = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const i = t.search(/<!doctype html|<html/i);
  if (i > 0) t = t.slice(i);
  const end = t.toLowerCase().lastIndexOf('</html>');
  if (end > 0) t = t.slice(0, end + 7);
  return t;
}

async function quota(env, uid) {
  const s = await getSettings(env);
  const db = rtdb(env);
  const d = dayKey();
  const [used, global] = await Promise.all([db.get(`aiQuota/${d}/${uid}`), db.get(`aiQuota/${d}/_global`)]);
  return { used: used || 0, limit: Number(s.aiDailyLimit), global: global || 0, globalLimit: Number(s.aiGlobalDailyLimit || 60) };
}

export async function aiQuota(req, env) {
  const user = await requireUser(env, req);
  const q = await quota(env, user.uid);
  return json({ used: q.used, limit: user.anonymous ? 0 : q.limit, remaining: user.anonymous ? 0 : Math.max(0, q.limit - q.used) });
}

export async function aiGenerate(req, env) {
  const user = await requireUser(env, req);
  if (user.anonymous) throw new HttpError(403, 'Daftar gratis untuk memakai AI Studio.');
  if (!env.AI) throw new HttpError(503, 'AI Studio belum diaktifkan di server.');
  const body = await readJson(req, 120 * 1024);
  const prompt = String(body.prompt || '').trim().slice(0, 2000);
  const previous = typeof body.html === 'string' ? body.html.slice(0, 40_000) : '';
  if (prompt.length < 8) throw new HttpError(400, 'Jelaskan aplikasi yang Anda inginkan (minimal beberapa kata).');

  const q = await quota(env, user.uid);
  if (q.used >= q.limit) throw new HttpError(429, `Kredit AI hari ini habis (${q.limit}/hari). Coba lagi besok.`);
  if (q.global >= q.globalLimit) throw new HttpError(429, 'Kuota AI harian server sudah habis. Coba lagi besok.');

  // Opsi backend Supabase: aplikasi memakai window.APKIFY.supabaseUrl/supabaseAnonKey (disuntikkan aplikasi Android)
  const sys = body.supabase ? `${SYSTEM}
- Aplikasi memakai backend Supabase: muat supabase-js dari https://esm.sh/@supabase/supabase-js@2 (satu-satunya pengecualian CDN),
  buat client dengan window.APKIFY?.supabaseUrl dan window.APKIFY?.supabaseAnonKey (tampilkan pesan bila belum diisi),
  gunakan Supabase Auth (email/password) untuk login dan tabel Supabase untuk data. Tulis komentar SQL pembuatan tabel + RLS di awal <script>.` : SYSTEM;
  const messages = [{ role: 'system', content: sys }];
  if (previous) {
    messages.push({ role: 'user', content: `Ini kode aplikasi saat ini:\n${previous}` });
    messages.push({ role: 'user', content: `Ubah aplikasi di atas sesuai permintaan berikut, lalu kirim ulang SELURUH file HTML: ${prompt}` });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  const model = env.AI_MODEL || '@cf/qwen/qwen3-30b-a3b-fp8';
  let out;
  try {
    out = await env.AI.run(model, { messages, max_tokens: 6000, temperature: 0.4 });
  } catch (e) {
    console.error('ai', e);
    throw new HttpError(502, 'AI sedang sibuk atau kuota gratis habis. Coba lagi nanti.');
  }
  const text = out?.response ?? out?.choices?.[0]?.message?.content ?? '';
  const html = extractHtml(text);
  if (!/<html|<body|<div/i.test(html)) throw new HttpError(502, 'AI tidak menghasilkan kode yang valid. Coba perjelas permintaan Anda.');

  const db = rtdb(env);
  const d = dayKey();
  await db.update('', { [`aiQuota/${d}/${user.uid}`]: db.inc(1), [`aiQuota/${d}/_global`]: db.inc(1) });
  const titleMatch = html.match(/<title>([^<]{1,40})<\/title>/i);
  return json({ html, title: titleMatch ? titleMatch[1].trim() : '', remaining: Math.max(0, q.limit - q.used - 1) });
}
