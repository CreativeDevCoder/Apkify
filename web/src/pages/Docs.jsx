import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Container, Typography, Grid, List, ListItemButton, ListItemText, Card, CardContent, TextField,
  Accordion, AccordionSummary, AccordionDetails, Box, useMediaQuery
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const SECTIONS = [
  {
    id: 'mulai', title: 'Mulai cepat', body: [
      'Masuk dengan email, Google, atau GitHub.',
      'Klik “Buat Aplikasi”, pilih sumber: Website, ZIP, atau HTML.',
      'Isi nama aplikasi. Package name dibuat otomatis — ubah bila perlu, karena setelah terbit di Play Store tidak bisa diganti.',
      'Pilih ikon (buat otomatis atau upload PNG 512×512), warna, dan fitur.',
      'Klik “Build APK & AAB”. Tunggu 3–6 menit; status ter-update otomatis dan Anda menerima email saat selesai.'
    ]
  },
  {
    id: 'zip', title: 'ZIP: hasil build atau kode sumber (React, Vite, Vue, Svelte, Angular)', body: [
      'Dua pilihan: (1) ZIP hasil build berisi index.html, atau (2) ZIP kode sumber berisi package.json — Apkify menjalankan npm install + npm run build otomatis di kontainer terisolasi (pnpm/yarn/bun terdeteksi dari lockfile).',
      'Hapus folder node_modules sebelum di-zip agar unggahan kecil; dependensi dipasang ulang otomatis.',
      'Konten disajikan di root https://appassets.androidplatform.net/, jadi BrowserRouter / history API, base "/" bawaan Vite, dan path absolut (/assets/…) berjalan normal. HashRouter juga tetap bisa.',
      'Rute yang tidak punya berkas (mis. /produk/12) otomatis diarahkan ke index.html (SPA fallback).',
      'Konten ZIP/HTML berjalan offline. Panggilan API ke server luar tetap butuh internet dan CORS yang mengizinkan origin https://appassets.androidplatform.net (atau aktifkan “Izinkan cross-origin”).',
      'Variabel lingkungan build (VITE_*) dibaca dari file .env di dalam ZIP. Jangan menaruh kunci rahasia di sana — semua yang ada di bundle frontend bisa dibaca orang.'
    ]
  },
  {
    id: 'website', title: 'Tips untuk website', body: [
      'Pastikan website HTTPS dan responsif di layar HP.',
      'Login Google di dalam WebView diblokir Google. Gunakan login email atau buka login Google lewat browser.',
      'Link ke domain lain otomatis dibuka di browser bila opsi “Link luar dibuka di browser” aktif.',
      'Link tel:, mailto:, whatsapp:, dan intent: otomatis diteruskan ke aplikasi yang sesuai.'
    ]
  },
  {
    id: 'publish', title: 'Publikasi ke Google Play', body: [
      'Buat akun Google Play Console (biaya registrasi satu kali).',
      'Buat aplikasi baru, isi detail toko: deskripsi, ikon 512×512, feature graphic 1024×500 (gunakan Tools Gratis), dan minimal 2 screenshot.',
      'Masuk ke Release > Production (atau Testing) > Create new release, lalu upload file .aab.',
      'Aktifkan Play App Signing (default). Kunci kami menjadi “upload key”. Simpan cadangan keystore dari dashboard.',
      'Akun pribadi baru wajib menjalankan closed testing dengan sejumlah penguji selama beberapa hari sebelum production — cek syarat terbaru di Play Console.',
      'Untuk update: build ulang dari tombol “Update” di dashboard. Kode versi naik otomatis.'
    ]
  },
  {
    id: 'keystore', title: 'Kunci tanda tangan (keystore)', body: [
      'Setiap package name dibuatkan keystore unik pada build pertama dan dipakai ulang di semua build berikutnya.',
      'Keystore disimpan terenkripsi (AES-256-GCM) dan hanya dapat diunduh pemilik aplikasi.',
      'Unduh cadangan keystore dari dashboard (ikon kunci) dan simpan di tempat aman.'
    ]
  }
];

const FAQ = [
  ['Apakah benar-benar gratis?', 'Ya. Build APK dan AAB gratis, tanpa watermark, dan aplikasi Anda tidak berisi iklan dari kami. Ada batas build harian per akun untuk mencegah penyalahgunaan.'],
  ['Bisa diterbitkan di Google Play?', 'Bisa. Setiap build menghasilkan AAB bertanda tangan yang siap di-upload.'],
  ['Apa saja yang bisa dikonversi?', 'Alamat website, ZIP berisi index.html (hasil build React/Vite/Vue/Angular atau situs statis), dan satu file HTML.'],
  ['Apakah perlu instal sesuatu?', 'Tidak. Semua berjalan di browser; proses build dilakukan di cloud.'],
  ['Berapa lama file hasil build disimpan?', 'Selama aplikasi masih ada di dashboard Anda. Unduh dan simpan file penting di perangkat Anda sendiri.'],
  ['Kenapa login Google di aplikasi saya gagal?', 'Google memblokir OAuth di WebView demi keamanan. Gunakan metode login lain atau arahkan login ke browser eksternal.'],
  ['Apakah kode saya aman?', 'File ZIP/HTML dibundel ke dalam APK. Siapa pun yang membongkar APK tetap bisa melihat HTML/JS, jadi jangan simpan rahasia (API key privat) di sisi klien.']
];

export default function Docs() {
  const { hash } = useLocation();
  const [q, setQ] = useState('');
  const desktop = useMediaQuery((t) => t.breakpoints.up('md'));

  useEffect(() => {
    if (hash) setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [hash]);

  const filtered = useMemo(() => {
    const k = q.toLowerCase();
    if (!k) return SECTIONS;
    return SECTIONS.map((s) => ({ ...s, body: s.body.filter((b) => b.toLowerCase().includes(k) || s.title.toLowerCase().includes(k)) })).filter((s) => s.body.length);
  }, [q]);
  const faq = FAQ.filter(([a, b]) => !q || (a + b).toLowerCase().includes(q.toLowerCase()));

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Panduan</Typography>
      <TextField placeholder="Cari panduan…" value={q} onChange={(e) => setQ(e.target.value)} sx={{ mb: 3, maxWidth: 420 }} />
      <Grid container spacing={3}>
        {desktop && (
          <Grid item md={3}>
            <Box sx={{ position: 'sticky', top: 80 }}>
              <List dense>
                {[...SECTIONS, { id: 'faq', title: 'FAQ' }].map((s) => (
                  <ListItemButton key={s.id} href={`#${s.id}`}><ListItemText primary={s.title} /></ListItemButton>
                ))}
              </List>
            </Box>
          </Grid>
        )}
        <Grid item xs={12} md={9}>
          {filtered.map((s) => (
            <Card key={s.id} id={s.id} sx={{ mb: 2, scrollMarginTop: 80 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>{s.title}</Typography>
                <Box component="ol" sx={{ pl: 2.5, m: 0, '& li': { mb: 1 } }}>
                  {s.body.map((b) => <li key={b}><Typography>{b}</Typography></li>)}
                </Box>
              </CardContent>
            </Card>
          ))}
          <Typography id="faq" variant="h5" sx={{ mt: 4, mb: 1, scrollMarginTop: 80 }}>FAQ</Typography>
          {faq.map(([qq, a]) => (
            <Accordion key={qq} disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography fontWeight={600}>{qq}</Typography></AccordionSummary>
              <AccordionDetails><Typography color="text.secondary">{a}</Typography></AccordionDetails>
            </Accordion>
          ))}
        </Grid>
      </Grid>
    </Container>
  );
}
