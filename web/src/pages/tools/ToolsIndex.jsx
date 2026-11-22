import { Link as RouterLink } from 'react-router-dom';
import { Container, Typography, Grid, Card, CardActionArea, CardContent, Box } from '@mui/material';
import PhotoSizeSelectLargeIcon from '@mui/icons-material/PhotoSizeSelectLarge';
import QrCodeIcon from '@mui/icons-material/QrCode2';
import PaletteIcon from '@mui/icons-material/Palette';
import WallpaperIcon from '@mui/icons-material/Wallpaper';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import MovieIcon from '@mui/icons-material/Movie';
import StorefrontIcon from '@mui/icons-material/Storefront';
import DescriptionIcon from '@mui/icons-material/Description';
import ChecklistIcon from '@mui/icons-material/Checklist';
import InstallMobileIcon from '@mui/icons-material/InstallMobile';
import PermMediaIcon from '@mui/icons-material/PermMedia';

const TOOLS = [
  { to: '/tools/icon-resizer', icon: <PhotoSizeSelectLargeIcon />, t: 'Icon Resizer', d: 'Satu gambar → semua ukuran ikon Android (mipmap) + ikon Play Store 512×512, diunduh sebagai ZIP.' },
  { to: '/tools/feature-graphic', icon: <WallpaperIcon />, t: 'Feature Graphic Maker', d: 'Buat feature graphic 1024×500 untuk halaman Play Store.' },
  { to: '/tools/qr-code', icon: <QrCodeIcon />, t: 'QR Code Generator', d: 'QR untuk link unduhan APK, website, atau teks apa pun.' },
  { to: '/tools/screenshot-mockup', icon: <PhoneAndroidIcon />, t: 'Screenshot Mockups', d: 'Bingkai HP + judul untuk screenshot Play Store 1080×1920, ekspor ZIP.' },
  { to: '/tools/promo-video', icon: <MovieIcon />, t: 'Promo Video & GIF', d: 'Slideshow screenshot jadi video vertikal atau GIF untuk promosi.' },
  { to: '/tools/listing-preview', icon: <StorefrontIcon />, t: 'Listing Preview', d: 'Pratinjau halaman Play Store dengan penghitung batas karakter.' },
  { to: '/tools/description-templates', icon: <DescriptionIcon />, t: 'Description Templates', d: 'Buat deskripsi singkat & lengkap siap tempel ke Play Console.' },
  { to: '/tools/play-checklist', icon: <ChecklistIcon />, t: 'Play Listing Checklist', d: 'Daftar periksa sebelum kirim ke peninjauan Google Play.' },
  { to: '/tools/pwa-builder', icon: <InstallMobileIcon />, t: 'PWA Builder (eksperimental)', d: 'Buat manifest, service worker, ikon, dan halaman offline agar situs jadi PWA.' },
  { to: '/media-app', icon: <PermMediaIcon />, t: 'Media App Maker', d: 'Foto, musik, video, atau PDF jadi aplikasi offline.' },
  { to: '/tools/color-palette', icon: <PaletteIcon />, t: 'Color Palette', d: 'Ekstrak warna dari logo atau turunkan palet aplikasi (status bar, aksen, splash).' }
];

export default function ToolsIndex() {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Tools Gratis</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Semua diproses di browser Anda — file tidak diunggah ke server.</Typography>
      <Grid container spacing={2}>
        {TOOLS.map((t) => (
          <Grid item xs={12} sm={6} md={4} key={t.to}>
            <Card sx={{ height: '100%' }}>
              <CardActionArea component={RouterLink} to={t.to} sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ color: 'primary.main', mb: 1 }}>{t.icon}</Box>
                  <Typography variant="h6">{t.t}</Typography>
                  <Typography color="text.secondary">{t.d}</Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
