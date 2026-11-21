// Rotasi 10 penyedia email:
// - urut berdasarkan prioritas (bisa diubah admin)
// - lewati yang belum dikonfigurasi / dinonaktifkan / sedang jeda karena error
// - lewati yang pemakaian hari/bulan ini >= 90% limit (sisa 10% sebagai buffer)
// - gagal -> catat error, jeda 10 menit, coba penyedia berikutnya
import { EMAIL_PROVIDERS } from './providers.js';
import { rtdb } from '../firebase.js';
import { memo, forget } from '../tokenCache.js';
import { dayKey, monthKey, escapeHtml } from '../util.js';

const SAFETY = 0.9;
const COOLDOWN_MS = 10 * 60 * 1000;

export async function emailState(env) {
  return memo('email-state', 30_000, async () => {
    const db = rtdb(env);
    const [config, usage] = await Promise.all([db.get('config/email'), db.get('providerUsage/email')]);
    return { config: config || {}, usage: usage || {} };
  });
}

export async function listEmailProviders(env) {
  const { config, usage } = await emailState(env);
  const d = dayKey(), m = monthKey();
  return EMAIL_PROVIDERS.map((p, i) => {
    const c = config[p.id] || {};
    const u = usage[p.id] || {};
    return {
      id: p.id, name: p.name, note: p.note,
      configured: p.configured(env),
      enabled: c.enabled !== false,
      priority: c.priority ?? i + 1,
      daily: c.daily !== undefined ? c.daily : p.daily,
      monthly: c.monthly !== undefined ? c.monthly : p.monthly,
      usage: { today: u.d?.[d] || 0, month: u.m?.[m] || 0 },
      coolingUntil: u.coolingUntil || 0,
      lastError: u.lastError || ''
    };
  }).sort((a, b) => a.priority - b.priority);
}

function available(p) {
  if (!p.configured || !p.enabled || p.coolingUntil > Date.now()) return false;
  if (p.daily && p.usage.today >= Math.floor(p.daily * SAFETY)) return false;
  if (p.monthly && p.usage.month >= Math.floor(p.monthly * SAFETY)) return false;
  return true;
}

export async function sendEmail(env, msg, { only } = {}) {
  const db = rtdb(env);
  const list = (await listEmailProviders(env)).filter((p) => (only ? p.id === only : available(p)));
  if (!list.length) throw new Error('Tidak ada penyedia email yang tersedia (kuota habis/belum dikonfigurasi).');
  const errors = [];
  for (const p of list) {
    const impl = EMAIL_PROVIDERS.find((x) => x.id === p.id);
    try {
      await impl.send(env, msg);
      await db.update(`providerUsage/email/${p.id}`, {
        [`d/${dayKey()}`]: db.inc(1), [`m/${monthKey()}`]: db.inc(1), lastSentAt: db.now
      });
      forget('email-state');
      return { provider: p.id };
    } catch (e) {
      errors.push(`${p.id}: ${e.message}`);
      // 4xx karena data (alamat tujuan salah) tidak perlu jeda penyedia
      const cool = !(e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 403 && e.status !== 429);
      await db.update(`providerUsage/email/${p.id}`, {
        lastError: String(e.message).slice(0, 300), lastErrorAt: db.now,
        ...(cool ? { coolingUntil: Date.now() + COOLDOWN_MS } : {})
      }).catch(() => {});
      forget('email-state');
    }
  }
  throw new Error(`Semua penyedia gagal: ${errors.join(' | ')}`);
}

/** Template email sederhana & ringan (inline CSS) */
export function renderEmail(env, { title, intro, buttonText, buttonUrl, footer }) {
  const app = escapeHtml(env.APP_NAME || 'Apkify');
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;padding:32px">
<tr><td style="font-size:20px;font-weight:bold;color:#4f46e5">${app}</td></tr>
<tr><td style="padding-top:16px;font-size:18px;font-weight:bold;color:#111">${escapeHtml(title)}</td></tr>
<tr><td style="padding-top:8px;font-size:15px;line-height:1.6;color:#333">${intro}</td></tr>
${buttonUrl ? `<tr><td style="padding-top:24px"><a href="${escapeHtml(buttonUrl)}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:bold">${escapeHtml(buttonText)}</a></td></tr>` : ''}
<tr><td style="padding-top:24px;font-size:12px;color:#888">${escapeHtml(footer || `Email otomatis dari ${env.APP_NAME || 'Apkify'}.`)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${title}\n\n${intro.replace(/<[^>]+>/g, '')}\n\n${buttonUrl ? `${buttonText}: ${buttonUrl}` : ''}`;
  return { html, text };
}
