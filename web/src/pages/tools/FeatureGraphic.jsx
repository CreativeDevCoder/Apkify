import { useEffect, useRef, useState } from 'react';
import { Container, Card, CardContent, Stack, TextField, Button, Grid } from '@mui/material';
import { ToolHeader } from '../../components/ui';
import FileDrop from '../../components/FileDrop';
import ColorField from '../../components/ColorField';
import { loadImage, fileToDataUrl } from '../../lib/iconGen';
import { isHex } from '../../lib/validators';

const W = 1024, H = 500;

export default function FeatureGraphic() {
  const cv = useRef();
  const [title, setTitle] = useState('Nama Aplikasi');
  const [tagline, setTagline] = useState('Tagline singkat yang menarik');
  const [c1, setC1] = useState('#4f46e5');
  const [c2, setC2] = useState('#06b6d4');
  const [fg, setFg] = useState('#ffffff');
  const [icon, setIcon] = useState(null);

  useEffect(() => {
    if (![c1, c2, fg].every(isHex)) return;
    const ctx = cv.current.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.12; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(W - 120, 80, 220, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(80, H - 40, 160, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    let x = 80;
    if (icon) {
      const s = 220;
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, (H - s) / 2, s, s, 48); ctx.clip();
      ctx.drawImage(icon, x, (H - s) / 2, s, s); ctx.restore();
      x += s + 50;
    }
    ctx.fillStyle = fg; ctx.textBaseline = 'alphabetic';
    ctx.font = '800 64px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.fillText(title, x, H / 2 - 5, W - x - 60);
    ctx.font = '400 32px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.globalAlpha = 0.9; ctx.fillText(tagline, x, H / 2 + 50, W - x - 60); ctx.globalAlpha = 1;
  }, [title, tagline, c1, c2, fg, icon]);

  const download = () => {
    const a = document.createElement('a');
    a.href = cv.current.toDataURL('image/png');
    a.download = 'feature-graphic-1024x500.png';
    a.click();
  };

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <ToolHeader title="Feature Graphic Maker" />
      <Card sx={{ mb: 2 }}><CardContent>
        <canvas ref={cv} width={W} height={H} style={{ width: '100%', height: 'auto', borderRadius: 8 }} />
      </CardContent></Card>
      <Card><CardContent>
        <Stack spacing={2}>
          <TextField label="Judul" value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextField label="Tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}><ColorField label="Gradien 1" value={c1} onChange={setC1} /></Grid>
            <Grid item xs={12} sm={4}><ColorField label="Gradien 2" value={c2} onChange={setC2} /></Grid>
            <Grid item xs={12} sm={4}><ColorField label="Warna teks" value={fg} onChange={setFg} /></Grid>
          </Grid>
          <FileDrop accept="image/*" onFile={async (f) => setIcon(await loadImage(await fileToDataUrl(f)))} label="Tambahkan ikon (opsional)" />
          <Button variant="contained" size="large" onClick={download}>Unduh PNG 1024×500</Button>
        </Stack>
      </CardContent></Card>
    </Container>
  );
}
