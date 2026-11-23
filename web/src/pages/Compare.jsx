import { Link as RouterLink } from 'react-router-dom';
import { Container, Typography, Card, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Alert, Button, Stack, Chip } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import PageHeader from '../components/PageHeader';

const APP = import.meta.env.VITE_APP_NAME || 'Apkify';
// Ringkasan riset publik (November 2026). Harga & fitur pesaing bisa berubah — cek situs resminya.
const COLS = ['Harga', 'Android', 'iOS', 'Windows', 'macOS/Linux', 'ZIP/HTML offline', 'Plugin native (JS bridge)', 'Tanpa watermark gratis'];
const ROWS = [
  [APP, 'Gratis', true, 'IPA + Xcode', '.exe + .msi', '.dmg, .AppImage, .deb', true, '20+ plugin', true],
  ['FreeWebToApk', 'Gratis', true, false, false, false, true, '—', true],
  ['Median.co', 'Mulai $229 + biaya tahunan', true, true, false, false, '—', 'Lengkap (paket berbayar)', false],
  ['WebToNative', 'Mulai $39 sekali (Android)', true, true, false, false, '—', 'Add-on', false],
  ['WebViewGold', '± $109 per platform', true, true, false, 'macOS', '—', 'Konfigurasi kode', 'Lisensi berbayar'],
  ['WebsiteToApp', 'Mulai $35 sekali', true, 'Beta', true, false, '—', '—', 'Ada watermark'],
  ['Appy Pie', 'Langganan', true, true, false, false, '—', '—', false],
  ['PWABuilder', 'Gratis', 'TWA (butuh PWA)', 'Eksperimental', 'MSIX', false, false, false, true],
  ['Website 2 APK Builder', 'Program desktop', true, false, false, false, true, '—', '—'],
  ['Pake / Nativefier', 'Gratis (CLI)', false, false, true, true, '—', false, true]
];

const Cell = ({ v, i }) => (v === true ? <CheckIcon color="success" /> : v === false ? <CloseIcon color="disabled" /> : <span style={{ fontWeight: i === 0 ? 700 : 400 }}>{v}</span>);

export default function Compare() {
  return (
    <>
      <PageHeader title="Bandingkan" subtitle={`${APP} dibandingkan konverter web-to-app, web-to-exe, dan web-to-ipa populer.`} />
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Layanan</TableCell>
                  {COLS.map((c) => <TableCell key={c} sx={{ fontWeight: 700 }}>{c}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {ROWS.map(([name, ...vals], r) => (
                  <TableRow key={name} sx={{ bgcolor: r === 0 ? 'action.hover' : undefined }}>
                    <TableCell sx={{ fontWeight: 700, color: r === 0 ? 'primary.main' : undefined }}>{name}</TableCell>
                    {vals.map((v, i) => <TableCell key={i}><Cell v={v} i={i} /></TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          Berdasarkan informasi publik per November 2026; harga dan fitur pesaing dapat berubah. Merek milik pemiliknya masing-masing.
        </Typography>

        <Typography variant="h5" sx={{ mt: 5, mb: 2 }}>Yang membuat {APP} berbeda</Typography>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          {['5 platform dari 1 konfigurasi', 'Build paralel di cloud', 'Desktop ringan (Tauri)', 'IPA tanpa Mac', 'Google Play Billing', 'Scanner QR native', 'Biometrik', 'Navigasi bawah & FAB',
            'Remote Update/OTA', 'Analitik bawaan', 'AI Studio', 'Hosting subdomain', 'Keystore & sertifikat sendiri', 'Enkripsi konten', 'Tanpa watermark'].map((x) => <Chip key={x} label={x} color="primary" variant="outlined" />)}
        </Stack>
        <Alert severity="info" sx={{ mt: 3 }}>
          Kapan memilih layanan berbayar? Bila Anda butuh tim yang mengurus publikasi ke toko aplikasi, dukungan prioritas, atau plugin enterprise (MDM, SDK pihak ketiga tertentu).
        </Alert>
        <Button size="large" variant="contained" component={RouterLink} to="/create" sx={{ mt: 3 }}>Coba gratis</Button>
      </Container>
    </>
  );
}
