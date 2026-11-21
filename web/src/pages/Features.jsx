import { Link as RouterLink } from 'react-router-dom';
import { Container, Typography, Grid, Card, CardContent, Button, Box } from '@mui/material';
import PageHeader from '../components/PageHeader';

const GROUPS = [
  ['Sumber konten', [
    ['Website (URL)', 'Konten selalu terbaru mengikuti situs Anda.'],
    ['ZIP offline', 'Hasil build React/Vite/Vue/Angular atau situs statis dibundel ke APK dan berjalan tanpa internet.'],
    ['HTML tempel', 'Satu halaman HTML langsung jadi aplikasi.'],
    ['Template', 'Mulai dari katalog toko, link in bio, kalkulator, kuis, dan lainnya.'],
    ['AI Studio', 'Jelaskan aplikasi yang Anda mau, AI membuatkan kodenya.']
  ]],
  ['Tampilan', [
    ['Ikon otomatis atau upload', 'Lengkap semua ukuran mipmap + adaptive icon.'],
    ['Splash screen', 'Android 12+ Splash API dengan warna latar pilihan.'],
    ['Warna status bar', 'Ikon status bar terang/gelap menyesuaikan otomatis.'],
    ['Orientasi & layar penuh', 'Potret, lanskap, atau mode kiosk.'],
    ['Menu samping', 'Tentang, Kontak, Bagikan, dan hingga 8 link sosial.']
  ]],
  ['Fungsi', [
    ['Tarik untuk refresh', 'Gestur yang familiar bagi pengguna.'],
    ['Upload & download file', 'Form upload dan unduhan lewat Download Manager.'],
    ['Kamera, mikrofon, lokasi', 'Izin runtime diminta hanya saat dibutuhkan.'],
    ['Halaman offline', 'Tampilan rapi saat tidak ada koneksi + tombol coba lagi.'],
    ['Link pintar', 'tel:, mailto:, WhatsApp, intent:// dan link luar ke browser.'],
    ['Mode cache WebView', 'Standar, utamakan cache, atau selalu terbaru.']
  ]],
  ['Monetisasi & engagement', [
    ['AdMob', 'Banner adaptif dengan ID milik Anda — 100% pendapatan untuk Anda.'],
    ['Push notification', 'OneSignal, cukup App ID.'],
    ['Marketplace', 'Jual atau beli aplikasi jadi di marketplace kami.']
  ]],
  ['Publikasi & keamanan', [
    ['APK + AAB', 'APK untuk tes, AAB siap Google Play, target API terbaru.'],
    ['Keystore tetap', 'Satu kunci per package name, terenkripsi, bisa diunduh.'],
    ['Enkripsi konten', 'File ZIP/HTML dienkripsi AES-GCM di dalam APK.'],
    ['Versi otomatis', 'Kode versi naik setiap build.'],
    ['Tools Play Store', 'Icon resizer, feature graphic, mockup screenshot, video promo, checklist listing.']
  ]]
];

export default function Features() {
  return (
    <>
      <PageHeader title="Fitur lengkap" subtitle="Semua yang dibutuhkan untuk mengubah website menjadi aplikasi Android berkualitas — gratis." />
      <Container maxWidth="lg" sx={{ py: 6 }}>
        {GROUPS.map(([g, items]) => (
          <Box key={g} sx={{ mb: 5 }}>
            <Typography variant="h5" gutterBottom>{g}</Typography>
            <Grid container spacing={2}>
              {items.map(([t, d]) => (
                <Grid item xs={12} sm={6} md={4} key={t}>
                  <Card sx={{ height: '100%' }}><CardContent>
                    <Typography fontWeight={700}>{t}</Typography>
                    <Typography variant="body2" color="text.secondary">{d}</Typography>
                  </CardContent></Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}
        <Button size="large" variant="contained" component={RouterLink} to="/create">Mulai gratis</Button>
      </Container>
    </>
  );
}
