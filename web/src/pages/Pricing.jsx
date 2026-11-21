import { Link as RouterLink } from 'react-router-dom';
import { Container, Typography, Card, CardContent, Button, List, ListItem, ListItemIcon, ListItemText, Grid, Chip } from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckCircle';

const FREE = [
  'APK + AAB tanpa batas aplikasi',
  'Tanpa watermark & tanpa iklan dari kami',
  'Sumber: Website, ZIP, atau HTML',
  'Ikon, splash screen, warna, orientasi',
  'Push notification OneSignal',
  'Iklan AdMob milik Anda sendiri',
  'Menu samping, halaman offline, upload/download file',
  'Keystore tetap per package + cadangan',
  'Notifikasi email saat build selesai'
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
        </Grid>
      </Grid>
    </Container>
  );
}
