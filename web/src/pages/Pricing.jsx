import { Link as RouterLink } from 'react-router-dom';
import { Box, Container, Typography, Button, Stack } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PageHeader from '../components/PageHeader';
import { MONO } from '../theme';

const DONATE = import.meta.env.VITE_DONATE_URL || '';

const INCLUDED = [
  ['Build', ['APK + AAB tanpa batas jumlah aplikasi', 'iOS (IPA), Windows (.exe/.msi), macOS (.dmg), Linux (.AppImage/.deb)', 'Sumber: website, ZIP, kode sumber React/Vite, atau HTML', 'Keystore tetap per package + cadangan unduhan', 'Email saat build selesai']],
  ['Aplikasi', ['Ikon, splash, warna, orientasi, navigasi bawah, FAB', '60+ API native: NFC, printer, OCR, lokasi, notifikasi', 'Halaman offline, unggah/unduh berkas, menu samping', 'Remote Update & OTA tanpa build ulang', 'Analitik pengguna aktif bawaan']],
  ['Monetisasi', ['Iklan dari AdMob, AppLovin, Unity, Meta, Start.io', 'Semua format: banner, interstitial, rewarded, app open', 'Google Play Billing (in-app purchase)', 'Tanpa watermark, tanpa iklan dari kami']],
  ['Ekstra', ['AI Studio (kredit harian)', 'Hosting subdomain untuk situs statis', 'Tools aset Play Store di browser', 'Marketplace untuk menjual aplikasi jadi']]
];

export default function Pricing() {
  return (
    <>
      <PageHeader eyebrow="Harga" title="Gratis. Tanpa paket, tanpa uji coba." subtitle="Semua fitur terbuka untuk semua orang. Yang kami batasi hanya jumlah build harian, agar layanan tetap adil untuk semua." />
      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '320px 1fr' }, gap: { xs: 5, md: 8 }, alignItems: 'start' }}>
          <Box sx={{ position: { md: 'sticky' }, top: 88 }}>
            <Typography variant="overline" color="text.secondary">Satu paket</Typography>
            <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mt: 1 }}>
              <Typography sx={{ fontSize: 64, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1 }} className="tnum">Rp0</Typography>
              <Typography color="text.secondary">/ selamanya</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Batas wajar build harian per akun. Tamu tanpa akun mendapat batas lebih kecil.</Typography>
            <Button component={RouterLink} to="/create" variant="contained" size="large" fullWidth endIcon={<ArrowForwardIcon />} sx={{ mt: 3 }}>Buat aplikasi</Button>
            <Button component={RouterLink} to="/compare" variant="outlined" size="large" fullWidth sx={{ mt: 1 }}>Bandingkan dengan layanan lain</Button>
          </Box>
          <Box>
            {INCLUDED.map(([group, items]) => (
              <Box key={group} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '140px 1fr' }, gap: { xs: 1, sm: 3 }, py: 3, borderTop: 1, borderColor: 'divider' }}>
                <Typography sx={{ fontFamily: MONO, fontSize: 12, color: 'text.secondary', pt: 0.25 }}>{group}</Typography>
                <Stack component="ul" spacing={1.25} sx={{ listStyle: 'none', p: 0, m: 0 }}>
                  {items.map((x) => (
                    <Stack component="li" key={x} direction="row" spacing={1.25} alignItems="flex-start">
                      <CheckIcon sx={{ fontSize: 16, color: 'primary.main', mt: 0.4 }} />
                      <Typography variant="body1">{x}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            ))}
            <Box sx={{ mt: 2, p: 3, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: (t) => t.tokens.subtle, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr auto' }, gap: 2, alignItems: 'center' }}>
              <Box>
                <Typography variant="h6">Dukung pengembangan</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 520 }}>Donasi sukarela membantu biaya server dan fitur baru. Pendukung mendapat prioritas balasan di halaman Kontak.</Typography>
              </Box>
              {DONATE
                ? <Button variant="outlined" href={DONATE} target="_blank" rel="noopener">Donasi</Button>
                : <Button variant="outlined" component={RouterLink} to="/contact">Hubungi untuk sponsor</Button>}
            </Box>
          </Box>
        </Box>
      </Container>
    </>
  );
}
