import { b64 } from './util.js';

const enc = new TextEncoder();

/** Perbandingan waktu-konstan untuk rahasia builder */
export function safeEqual(a = '', b = '') {
  const x = enc.encode(a), y = enc.encode(b);
  if (x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0;
}

async function aesKey(env) {
  // KEYSTORE_ENC_KEY = 32 byte base64 (openssl rand -base64 32)
  return crypto.subtle.importKey('raw', b64.toBytes(env.KEYSTORE_ENC_KEY), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptStr(env, plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(env), enc.encode(plain));
  return `${b64.fromBytes(iv)}.${b64.fromBytes(ct)}`;
}

export async function decryptStr(env, payload) {
  const [iv, ct] = payload.split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64.toBytes(iv) }, await aesKey(env), b64.toBytes(ct));
  return new TextDecoder().decode(pt);
}
