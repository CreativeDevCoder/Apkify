import { useEffect, useState } from 'react';
import { Container, Typography, Card, CardContent, Checkbox, FormControlLabel, LinearProgress, Stack, Button, Box, TextField, MenuItem } from '@mui/material';

const KEY = 'apkify:checklist';
const APPS_KEY = 'apkify:checklist:apps';
const GROUPS = [
  ['Akun & aplikasi', [
    'Akun Google Play Console aktif dan identitas terverifikasi',
    'Aplikasi dibuat di Play Console dengan nama & bahasa default',
    'Untuk akun pribadi baru: closed testing dengan jumlah penguji & durasi sesuai syarat terbaru'
  ]],
  ['Aset toko', [
    'Ikon 512×512 PNG (32-bit, maks 1 MB)',
    'Feature graphic 1024×500 JPG/PNG',
    'Minimal 2 screenshot ponsel (rasio 16:9 atau 9:16)',
    'Screenshot tablet 7" & 10" (opsional, disarankan)',
    'Video promo YouTube (opsional)'
  ]],
  ['Teks listing', [
    'Nama aplikasi ≤ 30 karakter, tanpa kata “terbaik/#1/gratis”',
    'Deskripsi singkat ≤ 80 karakter',
    'Deskripsi lengkap ≤ 4000 karakter, tanpa keyword stuffing',
    'Kategori & tag dipilih',
    'Email kontak developer diisi'
  ]],
  ['Kebijakan & konten', [
    'URL kebijakan privasi (Privacy Policy) yang bisa dibuka publik',
    'Kuesioner rating konten diisi',
    'Formulir Keamanan Data (Data safety) diisi sesuai data yang dikumpulkan situs/aplikasi',
    'Deklarasi iklan: “Berisi iklan” bila memakai AdMob',
    'Target audiens & konten ditetapkan',
    'Akses aplikasi: sediakan akun demo bila ada halaman login',
    'Deklarasi izin sensitif (lokasi, kamera) bila diaktifkan'
  ]],
  ['Rilis', [
    'AAB dari Apkify diunggah (bukan APK)',
    'Play App Signing aktif; cadangan keystore Apkify sudah diunduh',
    'Catatan rilis (release notes) ditulis',
    'Negara/wilayah distribusi dipilih',
    'Aplikasi diuji di HP sungguhan (APK) — login, upload, link luar, tombol kembali'
  ]]
];
const ALL = GROUPS.flatMap(([, items]) => items);

export default function ListingChecklist() {
  // Checklist tersimpan per aplikasi (nama bebas, mis. package name)
  const [apps, setApps] = useState(() => { try { return JSON.parse(localStorage.getItem(APPS_KEY) || '["Aplikasi utama"]'); } catch { return ['Aplikasi utama']; } });
  const [app, setApp] = useState(apps[0]);
  const [newApp, setNewApp] = useState('');
  const k = `${KEY}:${app}`;
  const [done, setDone] = useState({});
  useEffect(() => { try { setDone(JSON.parse(localStorage.getItem(k) || localStorage.getItem(KEY) || '{}')); } catch { setDone({}); } }, [k]);
  const update = (d) => { setDone(d); try { localStorage.setItem(k, JSON.stringify(d)); } catch { /* */ } };
  useEffect(() => { try { localStorage.setItem(APPS_KEY, JSON.stringify(apps)); } catch { /* */ } }, [apps]);
  const n = ALL.filter((x) => done[x]).length;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Play Listing Checklist</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
        <TextField select label="Aplikasi" value={app} onChange={(e) => setApp(e.target.value)} sx={{ minWidth: 220 }}>
          {apps.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
        </TextField>
        <TextField label="Tambah aplikasi (nama/package)" value={newApp} onChange={(e) => setNewApp(e.target.value)} />
        <Button onClick={() => { const n = newApp.trim(); if (n && !apps.includes(n)) { setApps([...apps, n]); setApp(n); } setNewApp(''); }}>Tambah</Button>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 2 }}>Centang tiap langkah sebelum menekan “Kirim untuk ditinjau”. Progres tersimpan di browser ini. Syarat Google bisa berubah — cek juga Play Console.</Typography>
      <Box sx={{ position: 'sticky', top: 64, zIndex: 1, bgcolor: 'background.default', py: 1 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <LinearProgress variant="determinate" value={(n / ALL.length) * 100} sx={{ flex: 1, height: 10, borderRadius: 5 }} />
          <Typography fontWeight={700}>{n}/{ALL.length}</Typography>
          <Button size="small" onClick={() => update({})}>Reset</Button>
        </Stack>
      </Box>
      {GROUPS.map(([g, items]) => (
        <Card key={g} sx={{ mt: 2 }}><CardContent>
          <Typography variant="h6">{g}</Typography>
          {items.map((it) => (
            <FormControlLabel key={it} sx={{ display: 'flex', alignItems: 'flex-start', my: 0.5 }}
              control={<Checkbox checked={!!done[it]} onChange={(e) => update({ ...done, [it]: e.target.checked })} sx={{ pt: 0 }} />}
              label={<Typography sx={{ textDecoration: done[it] ? 'line-through' : 'none', color: done[it] ? 'text.secondary' : 'text.primary' }}>{it}</Typography>} />
          ))}
        </CardContent></Card>
      ))}
    </Container>
  );
}
