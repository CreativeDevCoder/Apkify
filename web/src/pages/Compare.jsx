import { Link as RouterLink } from 'react-router-dom';
import { Box, Container, Typography, Table, TableHead, TableRow, TableCell, TableBody, Alert, Button, Stack, useMediaQuery } from '@mui/material';
import { RuleList } from '../components/ui';
import CheckIcon from '@mui/icons-material/Check';
import PageHeader from '../components/PageHeader';

const APP = import.meta.env.VITE_APP_NAME || 'Apkify';
// Ringkasan riset publik (November 2026). Harga & fitur pesaing bisa berubah — cek situs resminya.
const COLS = ['Harga', 'Android', 'iOS', 'Windows', 'macOS/Linux', 'ZIP/HTML offline', 'Plugin native (JS bridge)', 'Tanpa watermark gratis'];
const ROWS = [
  [APP, 'Gratis', true, 'IPA + Xcode', '.exe + .msi', '.dmg, .AppImage, .deb', 'Ya + build kode sumber', '60+ API, 5 jaringan iklan', true],
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

const Cell = ({ v }) => (v === true
  ? <CheckIcon sx={{ fontSize: 17, color: 'text.primary' }} aria-label="Ya" />
  : v === false ? <Box component="span" aria-label="Tidak" sx={{ color: 'text.disabled' }}>—</Box>
  : <Box component="span">{v}</Box>);

const DIFF = [
  ['Lima platform, satu konfigurasi', 'Android, iOS, Windows, macOS, Linux dibangun paralel.'],
  ['Fitur HP lengkap', 'NFC, printer thermal, OCR, geofence, notifikasi lokal, kiosk.'],
  ['Lima jaringan iklan', 'AdMob, AppLovin, Unity, Meta, Start.io — semua format.'],
  ['Build kode sumber', 'Unggah proyek React/Vite apa adanya, kami yang build.'],
  ['Kunci & sertifikat Anda', 'Keystore tetap, unggah sertifikat iOS sendiri.'],
  ['Tanpa watermark', 'Tidak ada merek kami di aplikasi Anda.']
];

export default function Compare() {
  const wide = useMediaQuery((t) => t.breakpoints.up('md'));
  return (
    <>
      <PageHeader eyebrow="Bandingkan" title={`${APP} dan konverter lain`} subtitle="Ringkasan dari informasi publik layanan web-to-app, web-to-exe, dan web-to-ipa populer." />
      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 } }}>
        {wide ? (
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper' }}>
            <Table size="small" sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '15%' }}>Layanan</TableCell>
                  {COLS.map((c) => <TableCell key={c}>{c}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {ROWS.map(([name, ...vals], r) => (
                  <TableRow key={name} sx={{ bgcolor: r === 0 ? 'primary.light' : undefined, '& td': { verticalAlign: 'top', wordBreak: 'break-word' } }}>
                    <TableCell sx={{ fontWeight: 600, color: r === 0 ? 'primary.main' : 'text.primary' }}>{name}</TableCell>
                    {vals.map((v, i) => <TableCell key={i} sx={{ color: 'text.secondary', ...(r === 0 && { color: 'text.primary' }) }}><Cell v={v} /></TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : (
          <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
            {ROWS.map(([name, ...vals], r) => (
              <Box key={name} component="details" open={r === 0} sx={{ borderBottom: 1, borderColor: 'divider', '& summary': { listStyle: 'none' }, '& summary::-webkit-details-marker': { display: 'none' }, '&[open] .chev': { transform: 'rotate(180deg)' } }}>
                <Box component="summary" sx={{ display: 'flex', alignItems: 'center', minHeight: 52, cursor: 'pointer' }}>
                  <Typography sx={{ flex: 1, fontWeight: 600, color: r === 0 ? 'primary.main' : 'text.primary' }}>{name}</Typography>
                  <Typography variant="body2" color="text.secondary">{vals[0]}</Typography>
                  <Box component="span" className="chev" aria-hidden sx={{ ml: 1.5, color: 'text.secondary', transition: 'transform 160ms', fontSize: 12 }}>▾</Box>
                </Box>
                <Box sx={{ pb: 2 }}>
                  {COLS.slice(1).map((c, i) => (
                    <Stack key={c} direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.75 }}>
                      <Typography variant="body2" color="text.secondary">{c}</Typography>
                      <Typography variant="body2" component="div" sx={{ textAlign: 'right' }}><Cell v={vals[i + 1]} /></Typography>
                    </Stack>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        )}
        <Typography variant="caption" component="p" sx={{ mt: 1.5 }}>
          Berdasarkan informasi publik per November 2026; harga dan fitur pesaing dapat berubah. Merek milik pemiliknya masing-masing.
        </Typography>

        <Box sx={{ mt: { xs: 7, md: 10 } }}>
          <Typography variant="h3" component="h2" sx={{ mb: 3 }}>Yang membuat {APP} berbeda</Typography>
          <RuleList items={DIFF} cols={{ xs: 1, sm: 2, md: 3 }} />
        </Box>
        <Alert severity="info" sx={{ mt: 5 }}>
          Kapan memilih layanan berbayar? Bila Anda butuh tim yang mengurus publikasi ke toko aplikasi, dukungan prioritas, atau integrasi enterprise khusus.
        </Alert>
        <Button size="large" variant="contained" component={RouterLink} to="/create" sx={{ mt: 3 }}>Coba gratis</Button>
      </Container>
    </>
  );
}
