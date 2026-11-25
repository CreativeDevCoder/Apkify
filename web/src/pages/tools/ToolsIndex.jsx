import { Container } from '@mui/material';
import PageHeader from '../../components/PageHeader';
import { CellGrid } from '../../components/ui';

const TOOLS = [
  { to: '/tools/icon-resizer', k: 'Ikon', t: 'Icon Resizer', d: 'Satu gambar → semua ukuran ikon Android (mipmap) + ikon Play Store 512×512, diunduh sebagai ZIP.' },
  { to: '/tools/feature-graphic', k: 'Grafis', t: 'Feature Graphic Maker', d: 'Buat feature graphic 1024×500 untuk halaman Play Store.' },
  { to: '/tools/qr-code', k: 'Utilitas', t: 'QR Code Generator', d: 'QR untuk link unduhan APK, website, atau teks apa pun.' },
  { to: '/tools/screenshot-mockup', k: 'Grafis', t: 'Screenshot Mockups', d: 'Bingkai HP + judul untuk screenshot Play Store 1080×1920, ekspor ZIP.' },
  { to: '/tools/promo-video', k: 'Video', t: 'Promo Video & GIF', d: 'Slideshow screenshot jadi video vertikal atau GIF untuk promosi.' },
  { to: '/tools/listing-preview', k: 'Listing', t: 'Listing Preview', d: 'Pratinjau halaman Play Store dengan penghitung batas karakter.' },
  { to: '/tools/description-templates', k: 'Listing', t: 'Description Templates', d: 'Buat deskripsi singkat & lengkap siap tempel ke Play Console.' },
  { to: '/tools/play-checklist', k: 'Listing', t: 'Play Listing Checklist', d: 'Daftar periksa sebelum kirim ke peninjauan Google Play.' },
  { to: '/tools/pwa-builder', k: 'Web', t: 'PWA Builder (eksperimental)', d: 'Buat manifest, service worker, ikon, dan halaman offline agar situs jadi PWA.' },
  { to: '/media-app', k: 'Aplikasi', t: 'Media App Maker', d: 'Foto, musik, video, atau PDF jadi aplikasi offline.' },
  { to: '/tools/color-palette', k: 'Grafis', t: 'Color Palette', d: 'Ekstrak warna dari logo atau turunkan palet aplikasi (status bar, aksen, splash).' }
];

export default function ToolsIndex() {
  return (
    <>
      <PageHeader eyebrow="Tools gratis" title="Aset Play Store, dibuat di browser." subtitle="Semua alat berjalan di perangkat Anda — berkas tidak diunggah ke server." />
      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 } }}>
        <CellGrid items={TOOLS.map((t) => ({ to: t.to, title: t.t, desc: t.d, meta: t.k }))} />
      </Container>
    </>
  );
}
