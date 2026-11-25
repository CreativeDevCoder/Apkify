import { Link as RouterLink } from 'react-router-dom';
import { Container, Typography, Button, Stack, Box } from '@mui/material';
import { Eyebrow, RuleList } from '../components/ui';
import PageHeader from '../components/PageHeader';

const APP = import.meta.env.VITE_APP_NAME || 'Apkify';
const VALUES = [
  ['Gratis untuk semua', 'UMKM, sekolah, kreator, dan developer pemula berhak punya aplikasi tanpa biaya developer mahal.'],
  ['Tanpa VPS', 'Seluruh layanan berjalan di infrastruktur serverless dan paket gratis — biaya operasional mendekati nol, sehingga layanan bisa tetap gratis.'],
  ['Milik Anda sepenuhnya', 'Tanpa watermark, tanpa iklan dari kami. Keystore bisa diunduh kapan saja dan aplikasi diterbitkan atas nama Anda.'],
  ['Transparan', 'Proses build berjalan di GitHub Actions publik; batas pemakaian ditampilkan jelas.']
];

export default function About() {
  return (
    <>
      <PageHeader eyebrow="Tentang" title={`Aplikasi untuk semua yang sudah punya website.`} subtitle={`${APP} membantu siapa pun mengubah situs dan proyek web menjadi aplikasi — cepat, gratis, dan siap toko aplikasi.`} />
      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '240px 1fr' }, gap: { xs: 2, md: 6 }, alignItems: 'start' }}>
          <Eyebrow>Misi</Eyebrow>
          <Typography sx={{ fontSize: { xs: 18, md: 22 }, lineHeight: 1.5, letterSpacing: '-0.01em', maxWidth: 760 }}>
            Banyak bisnis kecil sudah punya website, tetapi aplikasi terasa mahal dan rumit. {APP} menutup celah itu: masukkan alamat website, ZIP, atau HTML,
            lalu dapatkan aplikasi untuk Android, iOS, dan desktop dalam hitungan menit.
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '240px 1fr' }, gap: { xs: 2, md: 6 }, mt: { xs: 6, md: 9 }, alignItems: 'start' }}>
          <Eyebrow>Prinsip</Eyebrow>
          <RuleList items={VALUES} cols={{ xs: 1, sm: 2, md: 2 }} />
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ mt: 6, ml: { md: '288px' } }}>
          <Button variant="contained" size="large" component={RouterLink} to="/create">Buat aplikasi</Button>
          <Button variant="outlined" size="large" component={RouterLink} to="/contact">Hubungi kami</Button>
        </Stack>
      </Container>
    </>
  );
}
