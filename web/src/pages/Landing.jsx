import { useEffect } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Container, Typography, Grid, Card, CardContent, Button, Stack, Box, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PageHeader from '../components/PageHeader';

const APP = import.meta.env.VITE_APP_NAME || 'Apkify';

// Halaman SEO per kata kunci. Konten unik per halaman agar tidak dianggap duplikat.
export const LANDINGS = {
  '/website-to-app': {
    title: 'Website to App Converter — gratis', h1: 'Ubah website jadi aplikasi Android',
    lead: 'Masukkan alamat website, atur ikon & warna, lalu unduh APK dan AAB siap Google Play. Tanpa coding, tanpa watermark.',
    cta: ['/create?type=url', 'Konversi website sekarang'],
    points: [['Konten selalu terbaru', 'Aplikasi memuat situs Anda langsung, jadi setiap perubahan situs langsung tampil di aplikasi.'], ['Fitur native', 'Push notification, tarik untuk refresh, unduh file, kamera, lokasi, dan menu samping.'], ['Siap monetisasi', 'Pasang banner dan interstitial AdMob milik Anda sendiri.']],
    faq: [['Apakah situs harus responsif?', 'Ya, aplikasi menampilkan situs apa adanya di layar HP. Pastikan tampilan mobile rapi.'], ['Perlu build ulang saat situs berubah?', 'Tidak. Build ulang hanya saat mengubah ikon, nama, atau fitur aplikasi.']]
  },
  '/convert-website-to-mobile-app': {
    title: 'Convert Website to Mobile App', h1: 'Cara mengonversi website menjadi aplikasi mobile',
    lead: 'Panduan singkat dan alat gratis untuk mengubah situs bisnis, toko online, atau blog menjadi aplikasi Android dalam 5 menit.',
    cta: ['/create?type=url', 'Mulai konversi'],
    points: [['1. Siapkan situs', 'Gunakan HTTPS, tampilan mobile yang rapi, dan matikan pop-up layar penuh.'], ['2. Atur aplikasi', 'Nama, ikon, splash, warna, izin, dan fitur seperti push notification.'], ['3. Terbitkan', 'Uji APK di HP, lalu unggah AAB ke Google Play Console dengan checklist kami.']],
    faq: [['Berapa biayanya?', `Build di ${APP} gratis. Google Play memungut biaya pendaftaran developer satu kali.`], ['Bisa untuk iPhone?', 'Saat ini hanya Android (APK & AAB).']]
  },
  '/html-to-app': {
    title: 'HTML to APK', h1: 'Ubah HTML, CSS, dan JavaScript menjadi APK',
    lead: 'Tempel satu file HTML atau unggah ZIP proyek statis. Aplikasi berjalan 100% offline dan kontennya dienkripsi di dalam APK.',
    cta: ['/create?type=html', 'Tempel kode HTML'],
    points: [['Offline penuh', 'Semua file dibundel ke APK — cocok untuk kalkulator, kuis, katalog, dan game HTML5.'], ['Terenkripsi', 'HTML/JS dienkripsi AES-GCM sehingga tidak mudah disalin dari APK.'], ['Update tanpa build ulang', 'Aktifkan Remote Update untuk mengirim konten baru lewat OTA.']],
    faq: [['ZIP saya punya banyak halaman?', 'Bisa. Pastikan index.html ada di folder utama dan link memakai path relatif.'], ['Bisa memakai API luar?', 'Bisa, selama API mengizinkan CORS — atau aktifkan opsi “Izinkan cross-origin”.']]
  },
  '/website-to-exe': {
    title: 'Website to EXE — gratis', h1: 'Ubah website jadi aplikasi Windows (.exe & .msi)',
    lead: 'Masukkan URL atau ZIP, dapatkan installer Windows yang ringan (± 3–10 MB) — bukan Electron 100 MB. Sekaligus APK, macOS, dan Linux dari konfigurasi yang sama.',
    cta: ['/create?type=url', 'Buat .exe sekarang'],
    points: [['Ringan & cepat', 'Dibangun dengan Tauri: memakai WebView2 bawaan Windows, hemat RAM dan ukuran unduhan.'], ['Installer lengkap', 'Setup .exe (NSIS) dan .msi untuk distribusi kantor/sekolah, dengan ikon & nama aplikasi Anda.'], ['Atur jendela', 'Ukuran, layar penuh/kiosk, selalu di atas, aturan link, CSS/JS kustom.']],
    faq: [['Kenapa muncul peringatan SmartScreen?', 'Installer belum bertanda tangan kode. Pilih “More info → Run anyway”, atau tanda tangani dengan sertifikat code signing Anda sendiri.'], ['Bisa offline?', 'Bisa — gunakan sumber ZIP/HTML, semua file dibundel ke aplikasi.']]
  },
  '/website-to-ipa': {
    title: 'Website to IPA (iOS)', h1: 'Ubah website jadi aplikasi iPhone & iPad (.ipa)',
    lead: 'Build iOS di cloud tanpa Mac: dapatkan proyek Xcode dan IPA. Unggah sertifikat Apple Anda untuk IPA yang siap App Store.',
    cta: ['/create?type=url', 'Buat aplikasi iOS'],
    points: [['Tanpa Mac', 'Build berjalan di runner macOS cloud — Anda cukup memakai browser.'], ['Siap App Store', 'Dengan sertifikat .p12 + provisioning profile, IPA ditandatangani dan siap diunggah lewat Transporter.'], ['Proyek Xcode ikut', 'Unduh proyek SwiftUI + WKWebView lengkap untuk dikembangkan lebih lanjut.']],
    faq: [['Apakah Apple pasti menerima?', 'Tidak dijamin. Apple menolak aplikasi yang sekadar membungkus website tanpa nilai tambah (Guideline 4.2). Tambahkan fitur native seperti navigasi bawah, Face ID, dan notifikasi.'], ['IPA unsigned untuk apa?', 'Untuk diuji/ditandatangani ulang dengan Sideloadly, AltStore, atau Xcode memakai Apple ID Anda.']]
  },
  '/website-to-desktop-app': {
    title: 'Website to Desktop App', h1: 'Aplikasi desktop Windows, macOS & Linux dari website',
    lead: 'Satu klik untuk tiga sistem operasi: .exe/.msi, .dmg universal, .AppImage/.deb — gratis, dibangun paralel di cloud.',
    cta: ['/create?type=url', 'Buat aplikasi desktop'],
    points: [['Tiga OS sekaligus', 'Pilih Windows, macOS, dan Linux; semuanya dibangun bersamaan.'], ['Kecil & aman', 'Tauri (Rust) + WebView sistem: lebih kecil dan hemat memori dibanding Electron.'], ['Konsisten dengan mobile', 'Ikon, nama, aturan link, dan kode kustom sama dengan versi Android/iOS.']],
    faq: [['Apakah perlu memasang sesuatu?', 'Tidak. Windows 10/11 sudah punya WebView2 (installer mengunduhnya bila belum ada).'], ['macOS mendukung Apple Silicon?', 'Ya, .dmg dibangun universal (Apple Silicon + Intel).']]
  },
  '/ai-website-to-app': {
    title: 'AI Website to App', h1: 'Ubah situs buatan AI menjadi aplikasi Android',
    lead: 'Proyek dari Lovable, Bolt, v0, Replit, Google AI Studio, atau AI Studio kami sendiri bisa langsung dijadikan APK.',
    cta: ['/ai-studio', 'Coba AI Studio'],
    points: [['Dari URL deploy', 'Cara tercepat: salin URL hasil deploy lalu pilih tab Website.'], ['Dari ZIP build', 'Set base relatif, gunakan hash router, build, lalu zip folder dist.'], ['Tanpa situs?', 'Gunakan AI Studio: tulis deskripsi, AI membuat aplikasinya, lalu build APK.']],
    faq: [['Login Google di aplikasi gagal?', 'Google memblokir OAuth di WebView. Gunakan login email atau Supabase Auth.'], ['Supabase didukung?', 'Ya, aktifkan “Backend Supabase” — URL & anon key tersedia di window.APKIFY.']]
  }
};

export default function Landing() {
  const { pathname } = useLocation();
  const d = LANDINGS[pathname];
  useEffect(() => { if (d) document.title = `${d.title} | ${APP}`; return () => { document.title = `${APP} — Website ke APK Gratis`; }; }, [d]);
  if (!d) return null;
  return (
    <>
      <PageHeader title={d.h1} subtitle={d.lead}>
        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button size="large" variant="contained" component={RouterLink} to={d.cta[0]}>{d.cta[1]}</Button>
          <Button size="large" component={RouterLink} to="/guides">Panduan per platform</Button>
        </Stack>
      </PageHeader>
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Grid container spacing={2}>
          {d.points.map(([t, x]) => (
            <Grid item xs={12} md={4} key={t}><Card sx={{ height: '100%' }}><CardContent>
              <Typography variant="h6">{t}</Typography><Typography color="text.secondary">{x}</Typography>
            </CardContent></Card></Grid>
          ))}
        </Grid>
        <Typography variant="h5" sx={{ mt: 6, mb: 1 }}>Pertanyaan umum</Typography>
        {d.faq.map(([q, a]) => (
          <Accordion key={q} disableGutters><AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography fontWeight={600}>{q}</Typography></AccordionSummary>
            <AccordionDetails><Typography color="text.secondary">{a}</Typography></AccordionDetails></Accordion>
        ))}
        <Box sx={{ mt: 4 }}>
          <Typography variant="body2" color="text.secondary">Halaman terkait: {Object.keys(LANDINGS).filter((p) => p !== pathname).map((p, i) => (
            <span key={p}>{i > 0 && ' • '}<RouterLink to={p}>{LANDINGS[p].title}</RouterLink></span>
          ))}</Typography>
        </Box>
      </Container>
    </>
  );
}
