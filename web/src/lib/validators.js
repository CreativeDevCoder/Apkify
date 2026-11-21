export const PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,}$/;
const RESERVED = new Set(['abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package', 'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'try', 'void', 'volatile', 'while', 'true', 'false', 'null']);

export function validatePackage(pkg) {
  if (!pkg) return 'Package name wajib diisi';
  if (pkg.length > 100) return 'Maksimal 100 karakter';
  if (!PACKAGE_RE.test(pkg)) return 'Format: com.namaanda.aplikasi (huruf kecil, angka, titik, underscore)';
  if (pkg.split('.').some((p) => RESERVED.has(p))) return 'Mengandung kata terlarang Java (mis. "new", "class")';
  return '';
}

export function slugify(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '')
    .replace(/^[0-9]+/, '')
    .slice(0, 30) || 'app';
}

export function suggestPackage(name, url) {
  let host = 'myapp';
  try {
    if (url) host = new URL(url).hostname.replace(/^www\./, '').split('.').reverse().map(slugify).join('.');
  } catch { /* */ }
  const app = slugify(name);
  const base = host.includes('.') ? host : `com.${host}`;
  return `${base}.${app}`.replace(/\.+/g, '.');
}

export function normalizeUrl(u) {
  if (!u) return '';
  let v = u.trim();
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  return v;
}

export function validateUrl(u) {
  try {
    const url = new URL(normalizeUrl(u));
    if (!['http:', 'https:'].includes(url.protocol)) return 'Harus http/https';
    if (!url.hostname.includes('.')) return 'Alamat website tidak valid';
    return '';
  } catch {
    return 'Alamat website tidak valid';
  }
}

export const isHex = (c) => /^#[0-9a-fA-F]{6}$/.test(c);
