import { useEffect, useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box, Container, Typography, Card, CardContent, Tabs, Tab, TextField, Button, Grid, Stack, Chip
} from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import CodeIcon from '@mui/icons-material/Code';
import BoltIcon from '@mui/icons-material/Bolt';
import VerifiedIcon from '@mui/icons-material/Verified';
import StoreIcon from '@mui/icons-material/Store';
import NotificationsIcon from '@mui/icons-material/NotificationsActive';
import PaidIcon from '@mui/icons-material/Paid';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { api } from '../lib/api';
import { swr } from '../lib/cache';

const FEATURES = [
  { icon: <BoltIcon />, t: 'Cepat & gratis', d: 'Tanpa coding, tanpa watermark. Build berjalan di cloud dalam beberapa menit.' },
  { icon: <StoreIcon />, t: 'APK + AAB', d: 'APK untuk tes langsung di HP, AAB siap upload ke Google Play.' },
  { icon: <VerifiedIcon />, t: 'Kunci tanda tangan tetap', d: 'Setiap package name selalu ditandatangani kunci yang sama, jadi update terpasang mulus.' },
  { icon: <NotificationsIcon />, t: 'Push notification', d: 'Integrasi OneSignal cukup dengan App ID.' },
  { icon: <PaidIcon />, t: 'Iklan AdMob', d: 'Pasang banner AdMob milik Anda — pendapatannya 100% untuk Anda.' },
  { icon: <WifiOffIcon />, t: 'Offline & cache pintar', d: 'Halaman offline rapi, mode cache bisa diatur, konten ZIP/HTML berjalan tanpa internet.' },
  { icon: <BoltIcon />, t: '5 platform sekaligus', d: 'Android, iOS, Windows, macOS, dan Linux dibangun paralel dari satu konfigurasi.' },
  { icon: <VerifiedIcon />, t: 'Plugin native', d: 'Scanner QR, biometrik, Google Play Billing, ulasan, shortcut, share target, FCM — lewat window.Apkify.' },
  { icon: <StoreIcon />, t: 'Analitik & Remote Update', d: 'Lihat pengguna aktif, kirim pesan, paksa update, dan perbarui konten tanpa build ulang.' }
];

const STEPS = [
  ['Pilih sumber', 'Alamat website, file ZIP (mis. folder dist React/Vite), atau kode HTML.'],
  ['Atur tampilan', 'Nama, ikon, splash screen, warna, dan fitur tambahan.'],
  ['Unduh & publikasi', 'Pasang APK untuk mencoba, lalu upload AAB ke Google Play Console.']
];

export default function Home() {
  const nav = useNavigate();
  const [type, setType] = useState('url');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    swr('stats', () => api.get('/api/public/stats', { auth: false }), { ttl: 10 * 60_000, onData: setStats }).catch(() => {});
  }, []);

  const go = () => {
    const p = new URLSearchParams({ type, name });
    if (type === 'url' && url) p.set('url', url);
    nav(`/create?${p}`);
  };

  return (
    <>
      <Box sx={{ background: (t) => t.palette.mode === 'light'
        ? 'linear-gradient(135deg,#eef2ff 0%,#ecfeff 100%)' : 'linear-gradient(135deg,#1e1b4b 0%,#083344 100%)', py: { xs: 6, md: 10 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Chip label="100% gratis • tanpa watermark" color="primary" variant="outlined" sx={{ mb: 2 }} />
              <Typography variant="h2" sx={{ fontSize: { xs: 34, md: 52 }, lineHeight: 1.1, mb: 2 }}>
                Ubah website jadi aplikasi Android, iOS, Windows, macOS & Linux
              </Typography>
              <Typography variant="h6" color="text.secondary" fontWeight={400}>
                Dari URL, ZIP, atau HTML menjadi APK/AAB, IPA, .exe, .dmg, dan .AppImage — gratis, tanpa watermark. Lengkap dengan navigasi bawah, scanner QR, biometrik, in-app purchase, push notification, dan AdMob.
              </Typography>
              {stats?.totalBuilds > 0 && (
                <Typography sx={{ mt: 2 }} color="text.secondary">
                  <b>{Number(stats.totalBuilds).toLocaleString('id-ID')}</b> aplikasi sudah dibuat
                </Typography>
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ boxShadow: 6 }}>
                <CardContent>
                  <Tabs value={type} onChange={(_, v) => setType(v)} variant="fullWidth" sx={{ mb: 2 }}>
                    <Tab value="url" icon={<LanguageIcon />} label="Website" />
                    <Tab value="zip" icon={<FolderZipIcon />} label="ZIP" />
                    <Tab value="html" icon={<CodeIcon />} label="HTML" />
                  </Tabs>
                  <Stack spacing={2}>
                    <TextField label="Nama aplikasi" value={name} onChange={(e) => setName(e.target.value)} placeholder="Toko Saya" />
                    {type === 'url' && <TextField label="Alamat website" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://tokosaya.com" />}
                    {type !== 'url' && <Typography variant="body2" color="text.secondary">File {type === 'zip' ? 'ZIP' : 'HTML'} diunggah di langkah berikutnya.</Typography>}
                    <Button size="large" variant="contained" onClick={go}>Buat aplikasi gratis</Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h4" textAlign="center" gutterBottom>Tiga langkah, selesai</Typography>
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {STEPS.map(([t, d], i) => (
            <Grid item xs={12} md={4} key={t}>
              <Card sx={{ height: '100%' }}><CardContent>
                <Typography variant="h3" color="primary" fontWeight={800}>{i + 1}</Typography>
                <Typography variant="h6">{t}</Typography>
                <Typography color="text.secondary">{d}</Typography>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>

        <Typography variant="h4" textAlign="center" sx={{ mt: 8 }} gutterBottom>Fitur lengkap</Typography>
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {FEATURES.map((f) => (
            <Grid item xs={12} sm={6} md={4} key={f.t}>
              <Card sx={{ height: '100%' }}><CardContent>
                <Box sx={{ color: 'primary.main', mb: 1 }}>{f.icon}</Box>
                <Typography variant="h6">{f.t}</Typography>
                <Typography color="text.secondary">{f.d}</Typography>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>

        <Card sx={{ mt: 8, textAlign: 'center', bgcolor: 'primary.main', color: 'primary.contrastText' }}>
          <CardContent sx={{ py: 5 }}>
            <Typography variant="h5" gutterBottom>Butuh aset Play Store?</Typography>
            <Typography sx={{ mb: 2, opacity: 0.9 }}>Icon resizer, feature graphic 1024×500, QR code, dan palet warna — gratis di browser.</Typography>
            <Button variant="contained" color="inherit" sx={{ color: 'primary.main' }} component={RouterLink} to="/tools">Buka Tools Gratis</Button>
          </CardContent>
        </Card>
      </Container>
    </>
  );
}
