import { Link as RouterLink } from 'react-router-dom';
import { Container, Typography, Card, CardContent, Button, List, ListItem, ListItemIcon, ListItemText, Grid, Chip } from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckCircle';

const DONATE = import.meta.env.VITE_DONATE_URL || '';
const FREE = [
  'APK + AAB tanpa batas aplikasi',
  'Tanpa watermark & tanpa iklan dari kami',
  'Sumber: Website, ZIP, atau HTML',
  'Ikon, splash screen, warna, orientasi',
  'Push notification OneSignal',
  'Iklan AdMob milik Anda sendiri',
  'Menu samping, halaman offline, upload/download file',
  'Keystore tetap per package + cadangan',
  'Notifikasi email saat build selesai',
  'AI Studio (kredit harian), hosting subdomain, Remote Update',
  'Iklan interstitial, live chat Tawk, JavaScript API, Supabase'
];

export default function Pricing() {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h3" textAlign="center" gutterBottom>Harga</Typography>
      <Typography textAlign="center" color="text.secondary" sx={{ mb: 4 }}>Gratis. Benar-benar gratis.</Typography>
      <Grid container justifyContent="center">
        <Grid item xs={12} sm={9}>
          <Card sx={{ borderColor: 'primary.main', borderWidth: 2 }}>
            <CardContent sx={{ p: 4 }}>
              <Chip label="Paling populer" color="primary" size="small" />
              <Typography variant="h4" sx={{ mt: 1 }}>Gratis</Typography>
              <Typography color="text.secondary">Rp0 selamanya • batas wajar build harian per akun</Typography>
              <List>
                {FREE.map((f) => (
                  <ListItem key={f} disableGutters>
                    <ListItemIcon sx={{ minWidth: 34 }}><CheckIcon color="success" /></ListItemIcon>
                    <ListItemText primary={f} />
                  </ListItem>
                ))}
              </List>
              <Button fullWidth size="large" variant="contained" component={RouterLink} to="/create">Mulai sekarang</Button>
            </CardContent>
          </Card>
          <Card sx={{ mt: 3 }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h5">Dukung pengembangan</Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Layanan tetap gratis dan tanpa iklan di aplikasi Anda. Donasi sukarela membantu biaya server, domain, dan pengembangan fitur baru. Pendukung mendapat prioritas balasan di halaman Kontak.
              </Typography>
              {DONATE
                ? <Button variant="outlined" size="large" href={DONATE} target="_blank" rel="noopener">Dukung via donasi</Button>
                : <Button variant="outlined" size="large" component={RouterLink} to="/contact">Hubungi kami untuk sponsor</Button>}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
