// Utilitas canvas: generate ikon huruf, resize gambar, ekspor PNG.

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gambar tidak bisa dibaca'));
    img.src = src;
  });
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function canvasToBlob(canvas, type = 'image/png', q) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, q));
}

/** Ikon teks (inisial) dengan gradien */
export function generateLetterIcon({ text = 'A', bg1 = '#4f46e5', bg2 = '#06b6d4', fg = '#ffffff', size = 512, radius = 0.22 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, bg1);
  g.addColorStop(1, bg2);
  ctx.fillStyle = g;
  const r = size * radius;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(size, 0, size, size, r);
  ctx.arcTo(size, size, 0, size, r);
  ctx.arcTo(0, size, 0, 0, r);
  ctx.arcTo(0, 0, size, 0, r);
  ctx.closePath();
  ctx.fill();
  const t = (text || 'A').trim().slice(0, 2).toUpperCase();
  ctx.fillStyle = fg;
  ctx.font = `700 ${t.length > 1 ? size * 0.4 : size * 0.52}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t, size / 2, size / 2 + size * 0.03);
  return c;
}

/** Resize gambar ke kotak persegi (cover), opsional padding & background */
export function drawSquare(img, size, { padding = 0, bg = null, round = 0 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (round) {
    const r = size * round;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, r);
    ctx.clip();
  }
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
  }
  const inner = size - padding * 2;
  const s = Math.min(img.width, img.height);
  const sx = (img.width - s) / 2;
  const sy = (img.height - s) / 2;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, s, s, padding, padding, inner, inner);
  return c;
}

export const ANDROID_ICON_SIZES = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 }
];
