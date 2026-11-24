import { Link as RouterLink } from 'react-router-dom';
import { Container, Typography, Grid, Card, CardContent, Button, Box } from '@mui/material';
import PageHeader from '../components/PageHeader';

const GROUPS = [
  ['Platform', [
    ['Android', 'APK + AAB, Android TV, App Links terverifikasi (assetlinks.json).'],
    ['iOS', 'IPA + proyek Xcode, dibangun di cloud tanpa Mac; bertanda tangan bila sertifikat diunggah.'],
    ['Windows', 'Installer .exe (NSIS) dan .msi, ringan berbasis WebView2.'],
    ['macOS', '.dmg universal (Apple Silicon + Intel).'],
    ['Linux', '.AppImage dan .deb.']
  ]],
  ['Plugin native', [
    ['Navigasi bawah & FAB', 'Tab bar hingga 5 item dan tombol mengambang (URL, scan, bagikan).'],
    ['Scanner QR & barcode', 'UI native Google tanpa izin kamera.'],
    ['Biometrik', 'Sidik jari/Face unlock (Android) dan Face ID (iOS).'],
    ['Google Play Billing', 'Produk sekali beli & langganan lewat Apkify.iap.'],
    ['Ulasan dalam aplikasi', 'Dialog rating Google Play.'],
    ['Push FCM & OneSignal', 'Token FCM untuk server Anda atau OneSignal tanpa server.'],
    ['Shortcut & share target', 'Menu ikon tekan-lama dan menerima teks/link dari aplikasi lain.'],
    ['Penyimpanan native & analitik', 'Data bertahan & statistik pengguna aktif harian.'],
    ['CSS/JS kustom & aturan link', 'Sembunyikan elemen situs di aplikasi, atur link internal/eksternal/blokir dengan regex.']
  ]],
  ['Fitur HP lengkap (60+ API)', [
    ['NFC', 'Baca/tulis tag & kartu, UID, mode pantau, emulasi kartu (HCE).'],
    ['Printer thermal & BLE', 'Cetak struk ESC/POS lewat Bluetooth atau USB OTG, perangkat BLE (timbangan, IoT).'],
    ['Pemindai dokumen & OCR', 'Auto-crop multi-halaman + PDF, baca teks KTP/struk, deteksi wajah — offline (ML Kit).'],
    ['Absensi & lokasi', 'Geofence area kantor, deteksi Fake GPS, pengenalan aktivitas.'],
    ['Notifikasi lokal & latar', 'Pengingat terjadwal/berulang, badge, sinkronisasi latar, mulai saat boot.'],
    ['Media', 'Audio latar + kontrol layar kunci, PiP, Chromecast, TTS, dikte suara, rekam audio, cetak, PDF.'],
    ['Data & berkas', 'Kamera native, kontak, kalender, OTP SMS otomatis, akses folder pilihan, SQLite, penyimpanan terenkripsi.'],
    ['Login & Firebase', 'Login Google & Facebook native, Analytics, Crashlytics, Play Integrity, In-App Update.'],
    ['Bisnis & kiosk', 'Mode kiosk/launcher, scanner Zebra/Honeywell/Sunmi (+RFID), MDM, widget, Quick Settings, ganti ikon, kunci aplikasi.']
  ]],
  ['Sumber konten', [
    ['Website (URL)', 'Konten selalu terbaru mengikuti situs Anda.'],
    ['ZIP offline', 'Hasil build atau kode sumber React/Vite/Vue/Svelte/Angular — di-build otomatis di cloud, BrowserRouter didukung.'],
    ['HTML tempel', 'Satu halaman HTML langsung jadi aplikasi.'],
    ['Template', 'Mulai dari katalog toko, link in bio, kalkulator, kuis, dan lainnya.'],
    ['AI Studio', 'Jelaskan aplikasi yang Anda mau, AI membuatkan kodenya.'],
    ['Isi otomatis', 'Nama, warna tema, dan ikon diambil dari website Anda.'],
    ['Pratinjau langsung', 'Lihat toolbar, navigasi bawah, dan FAB sebelum build.']
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
    ['Iklan multi-jaringan', 'AdMob (+mediasi), AppLovin MAX, Unity Ads, Meta Audience Network, Start.io — 100% pendapatan untuk Anda.'],
    ['Semua format iklan', 'Banner (adaptif/collapsible/native), interstitial, rewarded, rewarded interstitial, app open.'],
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
