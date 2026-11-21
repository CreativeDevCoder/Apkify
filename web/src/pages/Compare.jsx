import { Container, Typography, Card, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Alert } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import PageHeader from '../components/PageHeader';

const APP = import.meta.env.VITE_APP_NAME || 'Apkify';
// Perbandingan dengan PENDEKATAN umum (bukan merek tertentu) agar tetap akurat & tidak usang.
const COLS = [APP, 'Konverter berbayar', 'TWA / Bubblewrap', 'Coding sendiri'];
const ROWS = [
  ['Biaya', 'Gratis', 'Langganan bulanan', 'Gratis', 'Waktu developer'],
  ['Tanpa coding', true, true, false, false],
  ['APK + AAB', true, true, true, true],
  ['Sumber ZIP/HTML offline', true, 'Sebagian', false, true],
  ['Tanpa watermark', true, 'Paket tertentu', true, true],
  ['Iklan AdMob milik sendiri', true, true, false, true],
  ['Push notification', 'OneSignal', true, 'Web Push', true],
  ['Keystore bisa diunduh', true, 'Bervariasi', true, true],
  ['Wajib verifikasi domain (Digital Asset Links)', false, false, true, false],
  ['Waktu jadi', '± 5 menit', '± 5–30 menit', '1–2 jam', 'Hari–minggu']
];

const Cell = ({ v }) => (v === true ? <CheckIcon color="success" /> : v === false ? <CloseIcon color="disabled" /> : v);

export default function Compare() {
  return (
    <>
      <PageHeader title="Bandingkan" subtitle={`${APP} dibandingkan cara lain membuat aplikasi Android dari website.`} />
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell />
                  {COLS.map((c, i) => <TableCell key={c} sx={{ fontWeight: 700, color: i === 0 ? 'primary.main' : undefined }}>{c}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {ROWS.map(([label, ...vals]) => (
                  <TableRow key={label}>
                    <TableCell sx={{ fontWeight: 600 }}>{label}</TableCell>
                    {vals.map((v, i) => <TableCell key={i} sx={{ bgcolor: i === 0 ? 'action.hover' : undefined }}><Cell v={v} /></TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
        <Alert severity="info" sx={{ mt: 3 }}>
          Kapan memilih TWA? Bila situs Anda adalah PWA penuh dan Anda bisa memasang file assetlinks.json di domain. Kapan coding sendiri? Bila butuh fitur native berat
          (Bluetooth, pembayaran in-app, sensor khusus).
        </Alert>
      </Container>
    </>
  );
}
