import { Link as RouterLink } from 'react-router-dom';
import { Container, Typography, Grid, Card, CardContent, Button, Stack } from '@mui/material';
import PageHeader from '../components/PageHeader';

const APP = import.meta.env.VITE_APP_NAME || 'Apkify';
const VALUES = [
  ['Gratis untuk semua', 'UMKM, sekolah, kreator, dan developer pemula berhak punya aplikasi Android tanpa biaya developer mahal.'],
  ['Tanpa VPS', 'Seluruh layanan berjalan di infrastruktur serverless dan paket gratis — biaya operasional mendekati nol, sehingga layanan bisa tetap gratis.'],
  ['Milik Anda sepenuhnya', 'Tanpa watermark, tanpa iklan dari kami. Keystore bisa diunduh kapan saja dan aplikasi diterbitkan atas nama Anda.'],
  ['Transparan', 'Proses build berjalan di GitHub Actions publik; batas pemakaian ditampilkan jelas.']
];

export default function About() {
  return (
    <>
      <PageHeader title={`Tentang ${APP}`} subtitle="Kami membantu siapa pun mengubah website menjadi aplikasi Android — cepat, gratis, dan siap Google Play." />
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Typography variant="h5" gutterBottom>Misi kami</Typography>
        <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 800 }}>
          Banyak bisnis kecil sudah punya website, tetapi aplikasi Android terasa mahal dan rumit. {APP} menutup celah itu: masukkan alamat website, file ZIP,
          atau kode HTML, lalu dapatkan APK untuk dicoba dan AAB untuk Play Store dalam hitungan menit.
        </Typography>
        <Grid container spacing={2}>
          {VALUES.map(([t, d]) => (
            <Grid item xs={12} sm={6} key={t}>
              <Card sx={{ height: '100%' }}><CardContent>
                <Typography variant="h6">{t}</Typography>
                <Typography color="text.secondary">{d}</Typography>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>
        <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
          <Button variant="contained" component={RouterLink} to="/create">Buat aplikasi</Button>
          <Button component={RouterLink} to="/contact">Hubungi kami</Button>
        </Stack>
      </Container>
    </>
  );
}
