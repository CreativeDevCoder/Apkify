import { useMemo, useState } from 'react';
import { Container, Typography, Card, CardContent, Stack, TextField, Button, Grid, MenuItem, Alert, Chip, Box } from '@mui/material';
import JSZip from 'jszip';
import FileDrop from '../../components/FileDrop';
import ColorField from '../../components/ColorField';
import { loadImage, fileToDataUrl, drawSquare, canvasToBlob, generateLetterIcon } from '../../lib/iconGen';
import { downloadBlob } from '../../lib/canvas';

const SIZES = [48, 72, 96, 128, 144, 192, 256, 384, 512];

function swCode(name, strategy, offline) {
  const v = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-v1`;
  return `// Service worker dibuat oleh PWA Builder — strategi: ${strategy}
const CACHE = '${v}';
const PRECACHE = ['./', './index.html'${offline ? ", './offline.html'" : ''}];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
${strategy === 'network-first' ? `  e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
    .catch(() => caches.match(req).then((r) => r || ${offline ? "(req.mode === 'navigate' ? caches.match('./offline.html') : undefined)" : 'undefined'})));`
    : strategy === 'cache-first' ? `  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
    ${offline ? ".catch(() => (req.mode === 'navigate' ? caches.match('./offline.html') : undefined))" : ''}));`
      : `  e.respondWith(caches.match(req).then((hit) => {
    const net = fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })${offline ? ".catch(() => (req.mode === 'navigate' ? caches.match('./offline.html') : undefined))" : ''};
    return hit || net;
  }));`}
});
`;
}

export default function PwaBuilder() {
  const [f, setF] = useState({ name: 'Aplikasi Saya', short: 'Aplikasi', desc: '', start: '/', display: 'standalone', orientation: 'any', theme: '#4f46e5', bg: '#ffffff', strategy: 'stale-while-revalidate', offline: true });
  const [img, setImg] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const manifest = useMemo(() => ({
    name: f.name, short_name: f.short || f.name.slice(0, 12), description: f.desc || undefined, start_url: f.start, scope: '/',
    display: f.display, orientation: f.orientation, theme_color: f.theme, background_color: f.bg,
    icons: [...SIZES.map((s) => ({ src: `icons/icon-${s}.png`, sizes: `${s}x${s}`, type: 'image/png' })), { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
  }), [f]);

  const snippet = `<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="${f.theme}">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
<script>
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
</script>`;

  async function build() {
    setBusy(true);
    const zip = new JSZip();
    const src = img || generateLetterIcon({ text: f.name, bg1: f.theme, bg2: f.theme, size: 512, radius: 0 });
    for (const s of SIZES) zip.file(`icons/icon-${s}.png`, await canvasToBlob(drawSquare(src, s)));
    zip.file('icons/maskable-512.png', await canvasToBlob(drawSquare(src, 512, { padding: 52, bg: f.bg })));
    zip.file('manifest.webmanifest', JSON.stringify(manifest, null, 2));
    zip.file('sw.js', swCode(f.name, f.strategy, f.offline));
    if (f.offline) zip.file('offline.html', `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><style>body{font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:${f.bg}}button{background:${f.theme};color:#fff;border:0;border-radius:10px;padding:12px 20px;font-size:16px}</style></head><body><div style="text-align:center"><h1>Tidak ada koneksi</h1><p>Periksa internet lalu coba lagi.</p><button onclick="location.reload()">Coba lagi</button></div></body></html>`);
    zip.file('PASANG-DI-HEAD.txt', `Salin semua file ke folder ROOT situs Anda (sejajar index.html), lalu tempel kode ini di <head>:\n\n${snippet}\n\nSitus wajib HTTPS. Uji di Chrome DevTools → Application → Manifest / Service Workers.`);
    downloadBlob(await zip.generateAsync({ type: 'blob' }), 'pwa-kit.zip');
    setBusy(false);
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" spacing={1} alignItems="center"><Typography variant="h4">PWA Builder</Typography><Chip size="small" label="eksperimental" color="warning" /></Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Jadikan situs Anda Progressive Web App: bisa dipasang di layar utama, berjalan offline, dan siap dikonversi ke APK. Hasil: manifest, service worker, ikon, dan halaman offline.</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card><CardContent><Stack spacing={2}>
            <TextField label="Nama aplikasi" value={f.name} onChange={set('name')} />
            <TextField label="Nama pendek (≤12)" value={f.short} onChange={set('short')} inputProps={{ maxLength: 12 }} />
            <TextField label="Deskripsi" value={f.desc} onChange={set('desc')} />
            <TextField label="Start URL" value={f.start} onChange={set('start')} />
            <Stack direction="row" spacing={2}>
              <TextField select label="Tampilan" value={f.display} onChange={set('display')}>
                {['standalone', 'fullscreen', 'minimal-ui', 'browser'].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
              </TextField>
              <TextField select label="Orientasi" value={f.orientation} onChange={set('orientation')}>
                {['any', 'portrait', 'landscape'].map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
              </TextField>
            </Stack>
            <Stack direction="row" spacing={2}>
              <ColorField label="Warna tema" value={f.theme} onChange={(v) => setF({ ...f, theme: v })} />
              <ColorField label="Latar" value={f.bg} onChange={(v) => setF({ ...f, bg: v })} />
            </Stack>
            <TextField select label="Strategi cache service worker" value={f.strategy} onChange={set('strategy')}
              helperText="Stale-while-revalidate: cepat + tetap ter-update. Network-first: konten dinamis. Cache-first: situs statis.">
              <MenuItem value="stale-while-revalidate">Stale-while-revalidate (disarankan)</MenuItem>
              <MenuItem value="network-first">Network-first</MenuItem>
              <MenuItem value="cache-first">Cache-first</MenuItem>
            </TextField>
            <TextField select label="Halaman offline" value={f.offline ? 'y' : 'n'} onChange={(e) => setF({ ...f, offline: e.target.value === 'y' })}>
              <MenuItem value="y">Sertakan</MenuItem><MenuItem value="n">Tidak</MenuItem>
            </TextField>
            <FileDrop accept="image/*" label="Ikon 512×512 (opsional)" onFile={async (x) => setImg(await loadImage(await fileToDataUrl(x)))} />
            <Button variant="contained" size="large" disabled={busy} onClick={build}>Unduh PWA kit (ZIP)</Button>
          </Stack></CardContent></Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography fontWeight={700} gutterBottom>Tempel di &lt;head&gt;</Typography>
          <Box component="pre" sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 2, fontSize: 12, overflow: 'auto' }}>{snippet}</Box>
          <Typography fontWeight={700} gutterBottom sx={{ mt: 2 }}>manifest.webmanifest</Typography>
          <Box component="pre" sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 2, fontSize: 12, overflow: 'auto', maxHeight: 320 }}>{JSON.stringify(manifest, null, 2)}</Box>
          <Alert severity="info" sx={{ mt: 2 }}>Setelah situs menjadi PWA, buat APK lewat “Buat Aplikasi” → Website, atau publikasikan sebagai TWA.</Alert>
        </Grid>
      </Grid>
    </Container>
  );
}
