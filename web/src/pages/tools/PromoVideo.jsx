import { useEffect, useRef, useState } from 'react';
import { Container, Typography, Card, CardContent, Stack, TextField, Button, Grid, Slider, LinearProgress, Alert, Box } from '@mui/material';
import { ToolHeader } from '../../components/ui';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import FileDrop from '../../components/FileDrop';
import ColorField from '../../components/ColorField';
import { loadImage, fileToDataUrl } from '../../lib/iconGen';
import { fillGradient, drawPhone, wrapText, downloadBlob } from '../../lib/canvas';

const W = 720, H = 1280;

/** Gambar satu frame pada waktu t (detik) */
function frame(ctx, t, { imgs, title, cta, c1, c2, perSlide, scale = 1 }) {
  const w = W * scale, h = H * scale;
  fillGradient(ctx, w, h, c1, c2);
  const total = imgs.length * perSlide;
  const outro = t >= total;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  if (outro) {
    const a = Math.min(1, (t - total) / 0.4);
    ctx.globalAlpha = a;
    ctx.font = `800 ${64 * scale}px system-ui, Roboto, sans-serif`;
    wrapText(ctx, title, w / 2, h * 0.42, w * 0.85, 76 * scale);
    ctx.font = `600 ${40 * scale}px system-ui, Roboto, sans-serif`;
    wrapText(ctx, cta, w / 2, h * 0.58, w * 0.85, 50 * scale);
    ctx.globalAlpha = 1;
    return;
  }
  const i = Math.min(imgs.length - 1, Math.floor(t / perSlide));
  const local = t - i * perSlide;
  const fade = Math.min(1, local / 0.35);
  ctx.font = `800 ${52 * scale}px system-ui, Roboto, sans-serif`;
  wrapText(ctx, title, w / 2, 120 * scale, w * 0.85, 62 * scale);
  ctx.globalAlpha = fade;
  const slide = (1 - fade) * 60 * scale;
  ctx.save();
  ctx.translate(0, slide);
  drawPhone(ctx, imgs[i], w / 2, 260 * scale, 440 * scale, '#111');
  ctx.restore();
  ctx.globalAlpha = 1;
}

export default function PromoVideo() {
  const cv = useRef();
  const [imgs, setImgs] = useState([]);
  const [opt, setOpt] = useState({ title: 'Aplikasi Saya', cta: 'Unduh gratis di Google Play', c1: '#4f46e5', c2: '#06b6d4', perSlide: 2.5 });
  const [busy, setBusy] = useState('');
  const [prog, setProg] = useState(0);
  const anim = useRef();

  const duration = imgs.length * opt.perSlide + 2;

  // Pratinjau berulang
  useEffect(() => {
    const ctx = cv.current.getContext('2d');
    if (!imgs.length) { fillGradient(ctx, W, H, opt.c1, opt.c2); return; }
    const start = performance.now();
    const loop = (now) => {
      const t = ((now - start) / 1000) % duration;
      frame(ctx, t, { ...opt, imgs });
      anim.current = requestAnimationFrame(loop);
    };
    anim.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(anim.current);
  }, [imgs, opt, duration]);

  async function recordVideo() {
    if (!window.MediaRecorder) return alert('Browser tidak mendukung perekaman video. Gunakan Chrome/Edge.');
    cancelAnimationFrame(anim.current);
    setBusy('video');
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const stream = c.captureStream(30);
    const mime = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((r) => { rec.onstop = r; });
    rec.start();
    const start = performance.now();
    await new Promise((resolve) => {
      const tick = (now) => {
        const t = (now - start) / 1000;
        frame(ctx, Math.min(t, duration), { ...opt, imgs });
        setProg(Math.min(100, (t / duration) * 100));
        if (t < duration) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
    rec.stop();
    await done;
    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    if (ext === 'webm') alert('Browser ini belum bisa merekam MP4, jadi video disimpan sebagai WebM. Gunakan Chrome versi terbaru untuk MP4, atau konversi WebM ke MP4 sebelum diunggah ke media sosial.');
    downloadBlob(new Blob(chunks, { type: mime }), `promo.${ext}`);
    setBusy(''); setProg(0);
    setImgs((x) => [...x]); // mulai ulang pratinjau
  }

  async function makeGif() {
    setBusy('gif');
    const scale = 0.5, fps = 10;
    const c = document.createElement('canvas');
    c.width = W * scale; c.height = H * scale;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    const gif = GIFEncoder();
    const n = Math.ceil(duration * fps);
    for (let k = 0; k < n; k++) {
      frame(ctx, k / fps, { ...opt, imgs, scale });
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      const palette = quantize(data, 256);
      gif.writeFrame(applyPalette(data, palette), c.width, c.height, { palette, delay: 1000 / fps });
      if (k % 5 === 0) { setProg((k / n) * 100); await new Promise((r) => setTimeout(r)); }
    }
    gif.finish();
    downloadBlob(new Blob([gif.bytes()], { type: 'image/gif' }), 'promo.gif');
    setBusy(''); setProg(0);
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      <ToolHeader title="Promo Video & GIF">Slideshow screenshot dalam bingkai HP untuk media sosial, WhatsApp Status, atau Reels. Untuk Play Store, unggah video ke YouTube lalu tempel link-nya di Play Console.</ToolHeader>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card><CardContent><canvas ref={cv} width={W} height={H} style={{ width: '100%', height: 'auto', borderRadius: 8 }} /></CardContent></Card>
        </Grid>
        <Grid item xs={12} md={8}>
          <Stack spacing={2}>
            <Card><CardContent><Stack spacing={2}>
              <FileDrop accept="image/*" onFile={async (f) => { const i = await loadImage(await fileToDataUrl(f)); setImgs((x) => [...x, i].slice(0, 8)); }} label="Tambah screenshot (maks 8)" />
              <Stack direction="row" spacing={1}>{imgs.map((i, k) => <Box key={k} component="img" src={i.src} onClick={() => setImgs((x) => x.filter((_, j) => j !== k))} title="Klik untuk hapus" sx={{ width: 40, height: 72, objectFit: 'cover', borderRadius: 1, cursor: 'pointer' }} />)}</Stack>
              <TextField label="Judul" value={opt.title} onChange={(e) => setOpt({ ...opt, title: e.target.value })} />
              <TextField label="Ajakan (penutup)" value={opt.cta} onChange={(e) => setOpt({ ...opt, cta: e.target.value })} />
              <Stack direction="row" spacing={2}>
                <ColorField label="Gradien 1" value={opt.c1} onChange={(v) => setOpt({ ...opt, c1: v })} />
                <ColorField label="Gradien 2" value={opt.c2} onChange={(v) => setOpt({ ...opt, c2: v })} />
              </Stack>
              <Typography variant="body2">Durasi per slide: {opt.perSlide} dtk (total {duration.toFixed(1)} dtk)</Typography>
              <Slider value={opt.perSlide} min={1.5} max={5} step={0.5} onChange={(_, v) => setOpt({ ...opt, perSlide: v })} />
            </Stack></CardContent></Card>
            {busy && <Box><Typography variant="body2">{busy === 'video' ? 'Merekam video (real-time)…' : 'Membuat GIF…'}</Typography><LinearProgress variant="determinate" value={prog} /></Box>}
            {!imgs.length && <Alert severity="info">Tambahkan minimal 1 screenshot.</Alert>}
            <Stack direction="row" spacing={2}>
              <Button variant="contained" size="large" disabled={!imgs.length || !!busy} onClick={recordVideo}>Unduh video</Button>
              <Button variant="outlined" size="large" disabled={!imgs.length || !!busy} onClick={makeGif}>Unduh GIF</Button>
            </Stack>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
