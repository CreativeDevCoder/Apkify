import { useMemo, useState } from 'react';
import { Container, Typography, Card, CardContent, Grid, Box, Stack, Snackbar } from '@mui/material';
import ColorField from '../../components/ColorField';
import { isHex } from '../../lib/validators';
import FileDrop from '../../components/FileDrop';
import { loadImage, fileToDataUrl } from '../../lib/iconGen';

/** Ekstraksi warna dominan dari gambar: kuantisasi 4-bit per kanal + abaikan transparan/abu-abu ekstrem */
async function extractColors(file, n = 6) {
  const img = await loadImage(await fileToDataUrl(file));
  const c = document.createElement('canvas');
  const s = 96;
  c.width = s; c.height = Math.max(1, Math.round((img.height / img.width) * s));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const buckets = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    const b = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
    b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; b.n++;
    buckets.set(key, b);
  }
  const hex = (v) => Math.round(v).toString(16).padStart(2, '0');
  const picked = [];
  for (const b of [...buckets.values()].sort((x, y) => y.n - x.n)) {
    const col = [b.r / b.n, b.g / b.n, b.b / b.n];
    if (picked.some((p) => Math.hypot(p[0] - col[0], p[1] - col[1], p[2] - col[2]) < 48)) continue;
    picked.push(col);
    if (picked.length >= n) break;
  }
  return picked.map((p) => `#${hex(p[0])}${hex(p[1])}${hex(p[2])}`);
}

const hexToHsl = (hex) => {
  let r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
};
const hslToHex = (h, s, l) => {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
  return `#${f(0)}${f(8)}${f(4)}`;
};
const contrastText = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000' : '#fff';
};

export default function ColorPalette() {
  const [base, setBase] = useState('#4f46e5');
  const [extracted, setExtracted] = useState([]);
  const [copied, setCopied] = useState('');

  const palette = useMemo(() => {
    if (!isHex(base)) return null;
    const [h, s, l] = hexToHsl(base);
    const clamp = (v) => Math.max(4, Math.min(96, v));
    return {
      shades: [95, 85, 70, 60, 50, 40, 30, 20, 12].map((L) => hslToHex(h, s, L)),
      roles: [
        ['Warna utama', base],
        ['Status bar (lebih gelap)', hslToHex(h, s, clamp(l - 12))],
        ['Aksen / komplementer', hslToHex((h + 180) % 360, s, l)],
        ['Analog 1', hslToHex((h + 30) % 360, s, l)],
        ['Analog 2', hslToHex((h + 330) % 360, s, l)],
        ['Latar splash (terang)', hslToHex(h, Math.min(s, 40), 97)]
      ]
    };
  }, [base]);

  const copy = (c) => { navigator.clipboard?.writeText(c); setCopied(c); };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Color Palette</Typography>
      <Card sx={{ mb: 2 }}><CardContent><Stack spacing={2}>
        <FileDrop accept="image/*" label="Ekstrak warna dari logo (opsional)" onFile={async (f) => { const cs = await extractColors(f); setExtracted(cs); if (cs[0]) setBase(cs[0]); }} />
        {extracted.length > 0 && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {extracted.map((c) => <Box key={c} onClick={() => { setBase(c); copy(c); }} title="Pakai & salin" sx={{ cursor: 'pointer', width: 72, height: 56, borderRadius: 2, bgcolor: c, color: contrastText(c), fontSize: 11, display: 'grid', placeItems: 'end center', pb: 0.5, border: base === c ? 3 : 0, borderColor: 'primary.main' }}>{c}</Box>)}
          </Stack>
        )}
        <ColorField label="Warna dasar" value={base} onChange={setBase} />
      </Stack></CardContent></Card>
      {palette && <>
        <Grid container spacing={2}>
          {palette.roles.map(([label, c]) => (
            <Grid item xs={6} sm={4} key={label}>
              <Card onClick={() => copy(c)} sx={{ cursor: 'pointer' }}>
                <Box sx={{ height: 90, bgcolor: c, color: contrastText(c), p: 1, display: 'flex', alignItems: 'flex-end', fontWeight: 700 }}>{c}</Box>
                <CardContent sx={{ py: 1 }}><Typography variant="body2">{label}</Typography></CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
        <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Gradasi</Typography>
        <Stack direction="row" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          {palette.shades.map((c) => (
            <Box key={c} onClick={() => copy(c)} sx={{ flex: 1, height: 64, bgcolor: c, cursor: 'pointer', color: contrastText(c), fontSize: 10, display: 'grid', placeItems: 'end center', pb: 0.5 }}>{c}</Box>
          ))}
        </Stack>
      </>}
      <Snackbar open={!!copied} autoHideDuration={1500} onClose={() => setCopied('')} message={`${copied} disalin`} />
    </Container>
  );
}
