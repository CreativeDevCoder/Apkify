import { useEffect, useState } from 'react';
import { Container, Typography, Card, CardContent, Checkbox, FormControlLabel, LinearProgress, Stack, Button, Box } from '@mui/material';

const KEY = 'apkify:checklist';
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
  const [done, setDone] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
  });
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(done)); } catch { /* */ } }, [done]);
  const n = ALL.filter((x) => done[x]).length;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Play Listing Checklist</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>Centang tiap langkah sebelum menekan “Kirim untuk ditinjau”. Progres tersimpan di browser ini. Syarat Google bisa berubah — cek juga Play Console.</Typography>
      <Box sx={{ position: 'sticky', top: 64, zIndex: 1, bgcolor: 'background.default', py: 1 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <LinearProgress variant="determinate" value={(n / ALL.length) * 100} sx={{ flex: 1, height: 10, borderRadius: 5 }} />
          <Typography fontWeight={700}>{n}/{ALL.length}</Typography>
          <Button size="small" onClick={() => setDone({})}>Reset</Button>
        </Stack>
      </Box>
      {GROUPS.map(([g, items]) => (
        <Card key={g} sx={{ mt: 2 }}><CardContent>
          <Typography variant="h6">{g}</Typography>
          {items.map((it) => (
            <FormControlLabel key={it} sx={{ display: 'flex', alignItems: 'flex-start', my: 0.5 }}
              control={<Checkbox checked={!!done[it]} onChange={(e) => setDone({ ...done, [it]: e.target.checked })} sx={{ pt: 0 }} />}
              label={<Typography sx={{ textDecoration: done[it] ? 'line-through' : 'none', color: done[it] ? 'text.secondary' : 'text.primary' }}>{it}</Typography>} />
          ))}
        </CardContent></Card>
      ))}
    </Container>
  );
}
