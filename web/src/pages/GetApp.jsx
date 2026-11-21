import { useEffect, useState } from 'react';
import { Container, Typography, Card, CardContent, Button, Stack, Alert, Grid, Box } from '@mui/material';
import AndroidIcon from '@mui/icons-material/Android';
import InstallMobileIcon from '@mui/icons-material/InstallMobile';
import QRCode from 'qrcode';
import PageHeader from '../components/PageHeader';

const APP = import.meta.env.VITE_APP_NAME || 'Apkify';
const APK_URL = import.meta.env.VITE_COMPANION_APK_URL || '';
const PLAY_URL = import.meta.env.VITE_COMPANION_PLAY_URL || '';

export default function GetApp() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [qr, setQr] = useState('');

  useEffect(() => {
    const h = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', h);
    window.addEventListener('appinstalled', () => setInstalled(true));
    if (window.matchMedia('(display-mode: standalone)').matches) setInstalled(true);
    QRCode.toDataURL(PLAY_URL || APK_URL || window.location.href, { width: 200, margin: 1 }).then(setQr);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  return (
    <>
      <PageHeader title={`Aplikasi ${APP} untuk Android`} subtitle="Buat dan pantau build aplikasi langsung dari HP — dapat notifikasi, akses cepat dari layar utama." />
      <Container maxWidth="md" sx={{ py: 5 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={7}>
            <Stack spacing={2}>
              {PLAY_URL && <Button size="large" variant="contained" startIcon={<AndroidIcon />} href={PLAY_URL} target="_blank" rel="noopener">Dapatkan di Google Play</Button>}
              {APK_URL && <Button size="large" variant={PLAY_URL ? 'outlined' : 'contained'} startIcon={<AndroidIcon />} href={APK_URL}>Unduh APK</Button>}
              {installed ? <Alert severity="success">{APP} sudah terpasang di perangkat ini.</Alert>
                : prompt ? <Button size="large" variant="outlined" startIcon={<InstallMobileIcon />} onClick={async () => { prompt.prompt(); await prompt.userChoice; setPrompt(null); }}>Pasang sebagai aplikasi (PWA)</Button>
                  : !APK_URL && !PLAY_URL && <Alert severity="info">Buka halaman ini di Chrome Android lalu pilih menu ⋮ → “Tambahkan ke layar utama”.</Alert>}
              <Card><CardContent>
                <Typography fontWeight={700} gutterBottom>Dibuat dengan {APP} sendiri</Typography>
                <Typography variant="body2" color="text.secondary">Aplikasi Android kami dibangun dengan konverter yang sama yang Anda pakai — bukti bahwa website modern bisa menjadi aplikasi berkualitas.</Typography>
              </CardContent></Card>
            </Stack>
          </Grid>
          <Grid item xs={12} md={5} sx={{ textAlign: 'center' }}>
            {qr && <Box component="img" src={qr} alt="QR" sx={{ width: 200, height: 200, borderRadius: 2 }} />}
            <Typography variant="caption" display="block" color="text.secondary">Pindai dengan HP Android</Typography>
          </Grid>
        </Grid>
      </Container>
    </>
  );
}
