import { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Container, Typography, Card, CardContent, Stack, Button, Alert, LinearProgress, Stepper, Step,
  StepLabel, Box, Grid, Skeleton, Link
} from '@mui/material';
import AndroidIcon from '@mui/icons-material/Android';
import StoreIcon from '@mui/icons-material/Store';
import EditIcon from '@mui/icons-material/Edit';
import QRCode from 'qrcode';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { fileUrl } from '../lib/api';
import StatusChip, { FINAL } from '../components/StatusChip';
import { PLATFORM_INFO } from '../components/create/PlatformPicker';
import { Chip, List, ListItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';

// Artefak per platform (urutan tampil)
const ART = {
  android: [['apk', 'APK — pasang langsung'], ['aab', 'AAB — upload ke Google Play']],
  windows: [['exe', 'Installer .exe (NSIS)'], ['msi', 'Installer .msi']],
  macos: [['dmg', 'Disk image .dmg (Universal)']],
  linux: [['appimage', 'AppImage (semua distro)'], ['deb', 'Paket .deb (Ubuntu/Debian)']],
  ios: [['ipa', 'IPA'], ['xcode', 'Proyek Xcode (.zip)']]
};
const JOB_LABEL = { queued: 'antre', building: 'dibuild', success: 'selesai', failed: 'gagal' };

const STEPS = ['queued', 'building', 'uploading', 'success'];
const LABEL = { queued: 'Antre', building: 'Build di cloud', uploading: 'Simpan hasil', success: 'Selesai' };

export default function BuildDetail() {
  const { buildId } = useParams();
  const [b, setB] = useState(undefined);
  const [qr, setQr] = useState('');
  const [elapsed, setElapsed] = useState(0);

  // Listener realtime HANYA selama build belum selesai -> hemat koneksi & bandwidth RTDB
  useEffect(() => {
    const r = ref(db, `builds/${buildId}`);
    let done = false;
    let unsub = null;
    unsub = onValue(r, (s) => {
      const v = s.val();
      setB(v);
      if (v && FINAL.includes(v.status)) {
        done = true;
        if (unsub) unsub();
      }
    }, () => setB(null));
    if (done) unsub();
    return () => unsub && unsub();
  }, [buildId]);

  useEffect(() => {
    if (!b || FINAL.includes(b.status)) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - b.createdAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [b]);

  useEffect(() => {
    if (b?.apkFileId) {
      const url = new URL(fileUrl(b.apkFileId, `${b.packageName}.apk`), window.location.origin).href;
      QRCode.toDataURL(url, { margin: 1, width: 220 }).then(setQr);
    }
  }, [b?.apkFileId, b?.packageName]);

  if (b === undefined) return <Container sx={{ py: 4 }}><Skeleton variant="rounded" height={300} /></Container>;
  if (b === null) return <Container sx={{ py: 4 }}><Alert severity="error">Build tidak ditemukan atau Anda tidak punya akses.</Alert></Container>;

  const jobs = b.jobs || { android: b.status === 'success' ? 'success' : b.status === 'failed' ? 'failed' : 'building' };
  const art = (t) => b.artifacts?.[t] || (b[`${t}FileId`] ? { fileId: b[`${t}FileId`], size: b[`${t}Size`] } : null);
  const active = b.status === 'failed' ? STEPS.indexOf(b.failedAt || 'building') : STEPS.indexOf(b.status);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4">{b.name}</Typography>
          <Typography color="text.secondary">{b.packageName} • v{b.versionName} ({b.versionCode})</Typography>
        </Box>
        <StatusChip status={b.status} size="medium" />
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stepper activeStep={b.status === 'success' ? STEPS.length : active} alternativeLabel>
            {STEPS.map((s, i) => (
              <Step key={s}><StepLabel error={b.status === 'failed' && i === active}>{LABEL[s]}</StepLabel></Step>
            ))}
          </Stepper>
          {Object.keys(jobs).length > 1 && (
            <Stack direction="row" spacing={1} sx={{ mt: 3, flexWrap: 'wrap', gap: 1 }}>
              {Object.entries(jobs).map(([j, st]) => (
                <Chip key={j} icon={PLATFORM_INFO[j]?.icon} label={`${PLATFORM_INFO[j]?.label || j}: ${JOB_LABEL[st] || st}`}
                  color={st === 'success' ? 'success' : st === 'failed' ? 'error' : 'default'} variant={st === 'success' ? 'filled' : 'outlined'} />
              ))}
            </Stack>
          )}
          {!FINAL.includes(b.status) && (
            <Box sx={{ mt: 3 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Waktu berjalan {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} — biasanya 3–6 menit. Halaman ini otomatis ter-update; Anda juga akan menerima email saat selesai.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {(b.status === 'failed' || b.status === 'partial') && (
        <Alert severity={b.status === "partial" ? "warning" : "error"} sx={{ mb: 2 }} action={<Button color="inherit" component={RouterLink} to={`/create/${b.appId}`}>Coba lagi</Button>}>
          {b.error || 'Build gagal.'} {b.logUrl && <Link href={b.logUrl} target="_blank" rel="noopener">Lihat log</Link>}
        </Alert>
      )}

      {(b.status === 'success' || b.status === 'partial') && Object.keys(jobs).some((j) => j !== 'android') && (
        <Card sx={{ mb: 2 }}><CardContent>
          <Typography variant="h6" gutterBottom>Unduhan per platform</Typography>
          {Object.entries(jobs).map(([j, st]) => (
            <Box key={j} sx={{ mb: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1}>{PLATFORM_INFO[j]?.icon}<Typography fontWeight={700}>{PLATFORM_INFO[j]?.label || j}</Typography>
                {st !== 'success' && <Chip size="small" color="error" label={b.jobErrors?.[j] || 'gagal'} />}</Stack>
              <List dense>
                {(ART[j] || []).map(([t, label]) => art(t) && (
                  <ListItem key={t} secondaryAction={<Button size="small" startIcon={<DownloadIcon />} href={fileUrl(art(t).fileId, art(t).name || `${b.packageName}.${t}`)}>Unduh</Button>}>
                    <ListItemIcon sx={{ minWidth: 34 }}><DownloadIcon fontSize="small" /></ListItemIcon>
                    <ListItemText primary={label} secondary={art(t).size ? `${(art(t).size / 1048576).toFixed(1)} MB` : ''} />
                  </ListItem>
                ))}
              </List>
              {j === 'ios' && st === 'success' && <Typography variant="caption" color="text.secondary">IPA tanpa sertifikat harus ditandatangani ulang (Sideloadly/AltStore/Xcode). Unggah sertifikat di Studio untuk IPA siap App Store.</Typography>}
              {(j === 'windows' || j === 'macos') && st === 'success' && <Typography variant="caption" color="text.secondary" display="block">Belum bertanda tangan kode: pilih “More info → Run anyway” (Windows) atau klik kanan → Open (macOS).</Typography>}
              <Divider sx={{ mt: 1 }} />
            </Box>
          ))}
        </CardContent></Card>
      )}

      {(b.status === 'success' || (b.status === 'partial' && jobs.android === 'success')) && art('apk') && (
        <Card>
          <CardContent>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} sm={7}>
                <Typography variant="h6" gutterBottom>Aplikasi siap 🎉</Typography>
                <Stack spacing={1.5}>
                  <Button variant="contained" size="large" startIcon={<AndroidIcon />} href={fileUrl(b.apkFileId, `${b.packageName}-${b.versionName}.apk`)}>
                    Unduh APK {b.apkSize ? `(${(b.apkSize / 1048576).toFixed(1)} MB)` : ''}
                  </Button>
                  <Button variant="outlined" size="large" startIcon={<StoreIcon />} href={fileUrl(b.aabFileId, `${b.packageName}-${b.versionName}.aab`)}>
                    Unduh AAB untuk Google Play
                  </Button>
                  <Button startIcon={<EditIcon />} component={RouterLink} to={`/create/${b.appId}`}>Ubah & build versi baru</Button>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Pasang APK di HP (izinkan “sumber tidak dikenal”). Untuk Play Store, upload file AAB — lihat <Link component={RouterLink} to="/docs#publish">panduan publikasi</Link>.
                </Typography>
              </Grid>
              <Grid item xs={12} sm={5} sx={{ textAlign: 'center' }}>
                {qr && <img src={qr} alt="QR unduh APK" width={200} height={200} style={{ borderRadius: 8 }} />}
                <Typography variant="caption" display="block" color="text.secondary">Pindai dengan HP untuk mengunduh APK</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </Container>
  );
}
