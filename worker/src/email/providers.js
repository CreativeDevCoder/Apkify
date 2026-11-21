// 10 penyedia email transaksional dengan paket gratis, semuanya via HTTP API
// (Workers tidak mendukung SMTP biasa). Limit default = perkiraan paket gratis;
// SELALU cek ulang di dashboard penyedia & ubah dari halaman Admin.
import { cachedToken } from '../tokenCache.js';
import { b64 } from '../util.js';

const ok = async (res, name) => {
  if (res.ok) return true;
  let t = '';
  try { t = (await res.text()).slice(0, 300); } catch { /* */ }
  const e = new Error(`${name} ${res.status}: ${t}`);
  e.status = res.status;
  throw e;
};

const from = (env) => ({ email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME || env.APP_NAME || 'Apkify' });

export const EMAIL_PROVIDERS = [
  {
    id: 'brevo', name: 'Brevo', daily: 300, monthly: null, note: '±300 email/hari',
    configured: (e) => !!e.BREVO_API_KEY,
    async send(env, m) {
      const f = from(env);
      await ok(await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { email: f.email, name: f.name }, to: [{ email: m.to }], subject: m.subject, htmlContent: m.html, textContent: m.text })
      }), 'Brevo');
    }
  },
  {
    id: 'resend', name: 'Resend', daily: 100, monthly: 3000, note: '±100/hari, 3.000/bulan',
    configured: (e) => !!e.RESEND_API_KEY,
    async send(env, m) {
      const f = from(env);
      await ok(await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: `${f.name} <${f.email}>`, to: [m.to], subject: m.subject, html: m.html, text: m.text })
      }), 'Resend');
    }
  },
  {
    id: 'mailjet', name: 'Mailjet', daily: 200, monthly: 6000, note: '±200/hari, 6.000/bulan',
    configured: (e) => !!(e.MAILJET_API_KEY && e.MAILJET_API_SECRET),
    async send(env, m) {
      const f = from(env);
      await ok(await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: { authorization: `Basic ${btoa(`${env.MAILJET_API_KEY}:${env.MAILJET_API_SECRET}`)}`, 'content-type': 'application/json' },
        body: JSON.stringify({ Messages: [{ From: { Email: f.email, Name: f.name }, To: [{ Email: m.to }], Subject: m.subject, TextPart: m.text, HTMLPart: m.html }] })
      }), 'Mailjet');
    }
  },
  {
    id: 'mailgun', name: 'Mailgun', daily: 100, monthly: null, note: '±100/hari (paket Free)',
    configured: (e) => !!(e.MAILGUN_API_KEY && e.MAILGUN_DOMAIN),
    async send(env, m) {
      const f = from(env);
      const host = env.MAILGUN_REGION === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net';
      const fd = new FormData();
      fd.set('from', `${f.name} <${f.email}>`);
      fd.set('to', m.to);
      fd.set('subject', m.subject);
      fd.set('text', m.text);
      fd.set('html', m.html);
      await ok(await fetch(`https://${host}/v3/${env.MAILGUN_DOMAIN}/messages`, {
        method: 'POST', headers: { authorization: `Basic ${btoa(`api:${env.MAILGUN_API_KEY}`)}` }, body: fd
      }), 'Mailgun');
    }
  },
  {
    id: 'postmark', name: 'Postmark', daily: null, monthly: 100, note: '±100/bulan (Developer)',
    configured: (e) => !!e.POSTMARK_TOKEN,
    async send(env, m) {
      const f = from(env);
      await ok(await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: { 'X-Postmark-Server-Token': env.POSTMARK_TOKEN, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ From: `${f.name} <${f.email}>`, To: m.to, Subject: m.subject, HtmlBody: m.html, TextBody: m.text, MessageStream: 'outbound' })
      }), 'Postmark');
    }
  },
  {
    id: 'smtp2go', name: 'SMTP2GO', daily: 200, monthly: 1000, note: '±1.000/bulan, 200/hari',
    configured: (e) => !!e.SMTP2GO_API_KEY,
    async send(env, m) {
      const f = from(env);
      await ok(await fetch('https://api.smtp2go.com/v3/email/send', {
        method: 'POST',
        headers: { 'X-Smtp2go-Api-Key': env.SMTP2GO_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ sender: `${f.name} <${f.email}>`, to: [m.to], subject: m.subject, html_body: m.html, text_body: m.text })
      }), 'SMTP2GO');
    }
  },
  {
    id: 'mailersend', name: 'MailerSend', daily: null, monthly: 500, note: '±500/bulan (Free)',
    configured: (e) => !!e.MAILERSEND_API_KEY,
    async send(env, m) {
      const f = from(env);
      await ok(await fetch('https://api.mailersend.com/v1/email', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.MAILERSEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: { email: f.email, name: f.name }, to: [{ email: m.to }], subject: m.subject, html: m.html, text: m.text })
      }), 'MailerSend');
    }
  },
  {
    id: 'elasticemail', name: 'Elastic Email', daily: 100, monthly: null, note: '±100/hari (Free)',
    configured: (e) => !!e.ELASTICEMAIL_API_KEY,
    async send(env, m) {
      const f = from(env);
      await ok(await fetch('https://api.elasticemail.com/v4/emails/transactional', {
        method: 'POST',
        headers: { 'X-ElasticEmail-ApiKey': env.ELASTICEMAIL_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({
          Recipients: { To: [m.to] },
          Content: {
            From: `${f.name} <${f.email}>`, Subject: m.subject,
            Body: [{ ContentType: 'HTML', Content: m.html, Charset: 'utf-8' }, { ContentType: 'PlainText', Content: m.text, Charset: 'utf-8' }]
          }
        })
      }), 'ElasticEmail');
    }
  },
  {
    id: 'mailtrap', name: 'Mailtrap Sending', daily: 150, monthly: 1000, note: '±1.000/bulan',
    configured: (e) => !!e.MAILTRAP_API_TOKEN,
    async send(env, m) {
      const f = from(env);
      await ok(await fetch('https://send.api.mailtrap.io/api/send', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.MAILTRAP_API_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: { email: f.email, name: f.name }, to: [{ email: m.to }], subject: m.subject, html: m.html, text: m.text, category: 'transactional' })
      }), 'Mailtrap');
    }
  },
  {
    id: 'sendpulse', name: 'SendPulse SMTP', daily: null, monthly: 12000, note: '±12.000/bulan',
    configured: (e) => !!(e.SENDPULSE_CLIENT_ID && e.SENDPULSE_CLIENT_SECRET),
    async send(env, m) {
      const token = await cachedToken('sendpulse', async () => {
        const r = await fetch('https://api.sendpulse.com/oauth/access_token', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ grant_type: 'client_credentials', client_id: env.SENDPULSE_CLIENT_ID, client_secret: env.SENDPULSE_CLIENT_SECRET })
        });
        const d = await r.json();
        if (!r.ok) throw new Error(`SendPulse token ${r.status}`);
        return { value: d.access_token, expiresIn: d.expires_in || 3600 };
      });
      const f = from(env);
      await ok(await fetch('https://api.sendpulse.com/smtp/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          email: {
            html: b64.fromBytes(new TextEncoder().encode(m.html)), text: m.text, subject: m.subject,
            from: { name: f.name, email: f.email }, to: [{ email: m.to }]
          }
        })
      }), 'SendPulse');
    }
  }
];
