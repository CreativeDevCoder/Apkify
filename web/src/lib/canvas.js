// Helper canvas bersama untuk tools mockup & video promo.

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function fillGradient(ctx, w, h, c1, c2) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Gambar img memenuhi kotak (cover) */
export function drawCover(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

/** Bungkus teks ke beberapa baris, kembalikan tinggi total */
export function wrapText(ctx, text, x, y, maxW, lineH, align = 'center') {
  ctx.textAlign = align;
  const words = (text || '').split(/\s+/);
  let line = '';
  let yy = y;
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lineH;
    } else line = t;
  }
  if (line) ctx.fillText(line, x, yy);
  return yy - y + lineH;
}

/** Bingkai HP sederhana dengan layar berisi gambar */
export function drawPhone(ctx, img, cx, top, phoneW, frameColor = '#111') {
  const phoneH = phoneW * 2.05;
  const x = cx - phoneW / 2;
  const r = phoneW * 0.12;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = phoneW * 0.08;
  ctx.shadowOffsetY = phoneW * 0.03;
  ctx.fillStyle = frameColor;
  roundRect(ctx, x, top, phoneW, phoneH, r);
  ctx.fill();
  ctx.restore();
  const b = phoneW * 0.035;
  ctx.save();
  roundRect(ctx, x + b, top + b, phoneW - 2 * b, phoneH - 2 * b, r - b);
  ctx.clip();
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + b, top + b, phoneW - 2 * b, phoneH - 2 * b);
  if (img) drawCover(ctx, img, x + b, top + b, phoneW - 2 * b, phoneH - 2 * b);
  ctx.restore();
  // kamera punch-hole
  ctx.fillStyle = frameColor;
  ctx.beginPath();
  ctx.arc(cx, top + b + phoneW * 0.05, phoneW * 0.022, 0, Math.PI * 2);
  ctx.fill();
  return phoneH;
}

export function download(href, name) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

export function downloadBlob(blob, name) {
  const u = URL.createObjectURL(blob);
  download(u, name);
  setTimeout(() => URL.revokeObjectURL(u), 2000);
}
