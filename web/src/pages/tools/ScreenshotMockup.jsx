import { useEffect, useRef, useState } from 'react';
import { Container, Card, CardContent, Stack, TextField, Button, Grid, MenuItem, IconButton, Box, Alert } from '@mui/material';
import { ToolHeader } from '../../components/ui';
import DeleteIcon from '@mui/icons-material/Delete';
import JSZip from 'jszip';
import FileDrop from '../../components/FileDrop';
import ColorField from '../../components/ColorField';
import { loadImage, fileToDataUrl, canvasToBlob } from '../../lib/iconGen';
import { fillGradient, drawPhone, wrapText, downloadBlob } from '../../lib/canvas';
import { isHex } from '../../lib/validators';

// Ukuran screenshot Play Store yang umum (rasio 9:16)
const SIZES = { phone: [1080, 1920], tablet7: [1200, 1920], tablet10: [1600, 2560] };

function render(canvas, { img, caption, sub, c1, c2, fg, frame, size }) {
  const [W, H] = SIZES[size];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  fillGradient(ctx, W, H, c1, c2);
  ctx.fillStyle = fg;
  ctx.font = `800 ${W * 0.068}px system-ui, -apple-system, Roboto, sans-serif`;
  const th = wrapText(ctx, caption, W / 2, H * 0.09, W * 0.86, W * 0.08);
  ctx.globalAlpha = 0.85;
  ctx.font = `400 ${W * 0.036}px system-ui, -apple-system, Roboto, sans-serif`;
  const sh = sub ? wrapText(ctx, sub, W / 2, H * 0.09 + th + W * 0.01, W * 0.8, W * 0.048) : 0;
  ctx.globalAlpha = 1;
  const top = H * 0.09 + th + sh + W * 0.06;
  const phoneW = Math.min(W * 0.72, (H - top) / 2.05 + W * 0.2);
  drawPhone(ctx, img, W / 2, top, phoneW, frame);
}

export default function ScreenshotMockup() {
  const cv = useRef();
  const [shots, setShots] = useState([]); // { img, name, caption, sub }
  const [active, setActive] = useState(0);
  const [style, setStyle] = useState({ c1: '#4f46e5', c2: '#06b6d4', fg: '#ffffff', frame: '#111111', size: 'phone' });
  const [busy, setBusy] = useState(false);

  const cur = shots[active];
  useEffect(() => {
    if (!cv.current || ![style.c1, style.c2, style.fg, style.frame].every(isHex)) return;
    render(cv.current, { ...style, img: cur?.img, caption: cur?.caption ?? 'Judul fitur utama', sub: cur?.sub ?? '' });
  }, [cur, style]);

  const add = async (f) => {
    const img = await loadImage(await fileToDataUrl(f));
    setShots((s) => [...s, { img, name: f.name, caption: 'Judul fitur', sub: 'Penjelasan singkat manfaatnya' }]);
    setActive(shots.length);
  };
  const upd = (k, v) => setShots((s) => s.map((x, i) => (i === active ? { ...x, [k]: v } : x)));

  async function exportAll() {
    setBusy(true);
    const zip = new JSZip();
    const c = document.createElement('canvas');
    for (let i = 0; i < shots.length; i++) {
      render(c, { ...style, ...shots[i] });
      zip.file(`screenshot-${i + 1}.png`, await canvasToBlob(c));
    }
    downloadBlob(await zip.generateAsync({ type: 'blob' }), 'play-screenshots.zip');
    setBusy(false);
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      <ToolHeader title="Screenshot Mockups">Bingkai HP + judul untuk screenshot Play Store. Play Console butuh minimal 2 screenshot.</ToolHeader>
      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Card><CardContent>
            <canvas ref={cv} style={{ width: '100%', height: 'auto', borderRadius: 8 }} />
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={7}>
          <Stack spacing={2}>
            <Card><CardContent>
              <Stack spacing={2}>
                <FileDrop accept="image/*" onFile={add} label="Tambah screenshot aplikasi" hint="Ambil screenshot dari HP (potret)" />
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {shots.map((s, i) => (
                    <Box key={i} onClick={() => setActive(i)} sx={{ position: 'relative', border: 2, borderColor: i === active ? 'primary.main' : 'divider', borderRadius: 2, p: 0.5, cursor: 'pointer' }}>
                      <img src={s.img.src} alt="" width={48} height={86} style={{ objectFit: 'cover', borderRadius: 6, display: 'block' }} />
                      <IconButton size="small" sx={{ position: 'absolute', top: -10, right: -10, bgcolor: 'background.paper' }}
                        onClick={(e) => { e.stopPropagation(); setShots((x) => x.filter((_, j) => j !== i)); setActive(0); }}><DeleteIcon fontSize="inherit" /></IconButton>
                    </Box>
                  ))}
                </Stack>
                {cur && <>
                  <TextField label="Judul" value={cur.caption} onChange={(e) => upd('caption', e.target.value)} />
                  <TextField label="Sub-judul" value={cur.sub} onChange={(e) => upd('sub', e.target.value)} />
                </>}
              </Stack>
            </CardContent></Card>
            <Card><CardContent>
              <Grid container spacing={2}>
                <Grid item xs={6}><ColorField label="Gradien 1" value={style.c1} onChange={(v) => setStyle({ ...style, c1: v })} /></Grid>
                <Grid item xs={6}><ColorField label="Gradien 2" value={style.c2} onChange={(v) => setStyle({ ...style, c2: v })} /></Grid>
                <Grid item xs={6}><ColorField label="Warna teks" value={style.fg} onChange={(v) => setStyle({ ...style, fg: v })} /></Grid>
                <Grid item xs={6}><ColorField label="Bingkai HP" value={style.frame} onChange={(v) => setStyle({ ...style, frame: v })} /></Grid>
                <Grid item xs={12}>
                  <TextField select label="Ukuran" value={style.size} onChange={(e) => setStyle({ ...style, size: e.target.value })}>
                    <MenuItem value="phone">Ponsel 1080×1920</MenuItem>
                    <MenuItem value="tablet7">Tablet 7" 1200×1920</MenuItem>
                    <MenuItem value="tablet10">Tablet 10" 1600×2560</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
            </CardContent></Card>
            {shots.length < 2 && <Alert severity="info">Tambahkan minimal 2 screenshot.</Alert>}
            <Button variant="contained" size="large" disabled={!shots.length || busy} onClick={exportAll}>Unduh semua (ZIP PNG)</Button>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
