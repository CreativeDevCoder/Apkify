import { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Container, Typography, Stack, Button, Alert, Box, Skeleton, Link
} from '@mui/material';
import QRCode from 'qrcode';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { fileUrl } from '../lib/api';
import StatusChip, { FINAL } from '../components/StatusChip';
import { PLATFORM_INFO } from '../components/create/PlatformPicker';
import { Divider } from '@mui/material';
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { Dot, EmptyState } from '../components/ui';
import { MONO } from '../theme';
import { PREVIEW, previewBuild } from '../lib/previewFixtures';

// Artefak per platform (urutan tampil)
const ART = {
  android: [['apk', 'Pasang langsung di HP'], ['aab', 'Upload ke Google Play']],
  windows: [['exe', 'Installer .exe (NSIS)'], ['msi', 'Installer .msi']],
  macos: [['dmg', 'Disk image .dmg (Universal)']],
  linux: [['appimage', 'AppImage (semua distro)'], ['deb', 'Paket .deb (Ubuntu/Debian)']],
  ios: [['ipa', 'IPA'], ['xcode', 'Proyek Xcode (.zip)']]
};
const JOB_LABEL = { queued: 'antre', building: 'berjalan', success: 'selesai', failed: 'gagal' };

const STEPS = ['queued', 'building', 'uploading', 'success'];
const LABEL = { queued: 'Antre', building: 'Build di cloud', uploading: 'Menyimpan hasil', success: 'Selesai' };

export default function BuildDetail() {
  const { buildId } = useParams();
  const [b, setB] = useState(undefined);
  const [qr, setQr] = useState('');
  const [elapsed, setElapsed] = useState(0);

  // Listener realtime HANYA selama build belum selesai -> hemat koneksi & bandwidth RTDB
  useEffect(() => {
    if (PREVIEW) { setB(previewBuild(buildId)); return undefined; }
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
      QRCode.toDataURL(url, { margin: 1, width: 336, color: { dark: '#0f1217', light: '#ffffff' } }).then(setQr);
    }
  }, [b?.apkFileId, b?.packageName]);

  if (b === undefined) return <Container maxWidth="lg" sx={{ py: 6 }}><Skeleton width={220} height={40} /><Skeleton width={320} /><Skeleton variant="rounded" height={240} sx={{ mt: 4 }} /></Container>;
  if (b === null) return (
    <Container maxWidth="sm" sx={{ py: 10 }}>
      <EmptyState title="Build tidak ditemukan" action={<Button variant="outlined" component={RouterLink} to="/dashboard">Kembali ke Studio</Button>}>
        Tautan mungkin salah, atau build ini milik akun lain.
      </EmptyState>
    </Container>
  );

  const jobs = b.jobs || { android: b.status === 'success' ? 'success' : b.status === 'failed' ? 'failed' : 'building' };
  const art = (t) => b.artifacts?.[t] || (b[`${t}FileId`] ? { fileId: b[`${t}FileId`], size: b[`${t}Size`] } : null);
  const active = b.status === 'failed' ? STEPS.indexOf(b.failedAt || 'building') : b.status === 'partial' ? STEPS.length : STEPS.indexOf(b.status);
  const running = !FINAL.includes(b.status);
  const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const dur = b.finishedAt && b.createdAt ? Math.round((b.finishedAt - b.createdAt) / 1000) : null;
  const size = (n) => (n ? `${(n / 1048576).toFixed(1)} MB` : '');
  const ok = b.status === 'success' || b.status === 'partial';

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 3.5, md: 4.5 } }}>
          <Typography component={RouterLink} to="/dashboard" variant="body2" sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { color: 'text.primary' } }}>← Studio</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'flex-end' }} spacing={2} sx={{ mt: 2 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h3" component="h1" noWrap>{b.name}</Typography>
              <Typography sx={{ fontFamily: MONO, fontSize: 12.5, color: 'text.secondary', mt: 0.75 }} noWrap className="tnum">
                {b.packageName} · v{b.versionName} ({b.versionCode}) · build {String(buildId).slice(-6)}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <StatusChip status={b.status} />
              <Button variant="outlined" component={RouterLink} to={`/create/${b.appId}`}>{ok || b.status === 'failed' ? 'Ubah & build lagi' : 'Lihat konfigurasi'}</Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 5 } }}>
        {/* Tahapan */}
        <Box role="list" aria-label="Tahapan build" sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: { xs: 1, sm: 2 } }}>
          {STEPS.map((st, i) => {
            const done = b.status === 'success' || b.status === 'partial' || i < active;
            const now = i === active && running;
            const bad = b.status === 'failed' && i === active;
            return (
              <Box role="listitem" key={st}>
                <Box sx={{ height: 3, borderRadius: 2, bgcolor: bad ? 'error.main' : done ? 'text.primary' : now ? 'primary.main' : 'divider', ...(now && { animation: 'apkPulse 1.6s ease-in-out infinite', '@keyframes apkPulse': { '50%': { opacity: 0.4 } } }) }} />
                <Typography sx={{ fontFamily: MONO, fontSize: 11, mt: 1, color: bad ? 'error.main' : done || now ? 'text.primary' : 'text.disabled' }}>{String(i + 1).padStart(2, '0')}</Typography>
                <Typography variant="body2" sx={{ fontWeight: done || now ? 500 : 400, color: done || now || bad ? 'text.primary' : 'text.secondary' }}>{LABEL[st]}</Typography>
              </Box>
            );
          })}
        </Box>
        <Typography variant="body2" color="text.secondary" className="tnum" sx={{ mt: 2.5 }}>
          {running ? <>Berjalan <Box component="span" sx={{ fontFamily: MONO, color: 'text.primary' }}>{mmss(elapsed)}</Box> — biasanya 3–6 menit. Halaman ini memperbarui sendiri, dan email dikirim saat selesai.</>
            : dur ? <>Selesai dalam <Box component="span" sx={{ fontFamily: MONO, color: 'text.primary' }}>{mmss(dur)}</Box> · {new Date(b.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</>
            : new Date(b.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
        </Typography>

        {(b.status === 'failed' || b.status === 'partial') && (
          <Alert severity={b.status === 'partial' ? 'warning' : 'error'} sx={{ mt: 3 }}
            action={b.logUrl && <Button color="inherit" size="small" href={b.logUrl} target="_blank" rel="noopener">Lihat log</Button>}>
            {b.error || (b.status === 'partial' ? 'Sebagian platform gagal dibuild.' : 'Build gagal.')}
          </Alert>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: ok && art('apk') ? 'minmax(0,1fr) 260px' : '1fr' }, gap: { xs: 4, md: 6 }, mt: { xs: 4, md: 5 }, alignItems: 'start' }}>
          {/* Job per platform + artefak */}
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
            {Object.entries(jobs).map(([j, st], idx) => {
              const files = (ART[j] || []).filter(([t]) => art(t));
              return (
                <Box key={j} sx={{ borderTop: idx ? 1 : 0, borderColor: 'divider' }}>
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 1.5, bgcolor: (t) => t.tokens.subtle, borderRadius: idx ? 0 : '8px 8px 0 0', borderBottom: files.length ? 1 : 0, borderColor: 'divider' }}>
                    <Box sx={{ width: 16, display: 'grid', placeItems: 'center' }}>
                      {st === 'success' ? <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} /> : st === 'failed' ? <CloseIcon sx={{ fontSize: 16, color: 'error.main' }} /> : <Dot color={st === 'queued' ? 'text.disabled' : 'primary.main'} pulse={st !== 'queued'} />}
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>{PLATFORM_INFO[j]?.label || j}</Typography>
                    <Typography sx={{ fontFamily: MONO, fontSize: 11.5, color: st === 'failed' ? 'error.main' : 'text.secondary' }}>
                      {st === 'failed' ? (b.jobErrors?.[j] || 'gagal') : JOB_LABEL[st] || st}
                    </Typography>
                  </Stack>
                  {files.map(([t, label]) => (
                    <Stack key={t} direction="row" alignItems="center" spacing={2} sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
                      <Typography sx={{ fontFamily: MONO, fontSize: 12, width: 72, color: 'primary.main' }}>.{t === 'xcode' ? 'zip' : t}</Typography>
                      <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>{label}</Typography>
                      <Typography className="tnum" sx={{ fontFamily: MONO, fontSize: 12, color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>{size(art(t).size)}</Typography>
                      <Button size="small" variant={t === 'apk' || t === 'exe' || t === 'dmg' || t === 'appimage' || t === 'ipa' ? 'contained' : 'outlined'} startIcon={<DownloadIcon />}
                        href={fileUrl(art(t).fileId, art(t).name || `${b.packageName}-${b.versionName}.${t === 'xcode' ? 'zip' : t}`)}>Unduh</Button>
                    </Stack>
                  ))}
                  {st === 'success' && j === 'ios' && <Typography variant="caption" component="div" sx={{ px: 2, py: 1.25 }}>IPA tanpa sertifikat perlu ditandatangani ulang (Sideloadly/AltStore/Xcode). Unggah sertifikat di Studio untuk IPA siap App Store.</Typography>}
                  {st === 'success' && (j === 'windows' || j === 'macos') && <Typography variant="caption" component="div" sx={{ px: 2, py: 1.25 }}>Belum bertanda tangan kode: Windows → “More info → Run anyway”; macOS → klik kanan → Open.</Typography>}
                  {st === 'success' && j === 'android' && <Typography variant="caption" component="div" sx={{ px: 2, py: 1.25 }}>APK untuk dipasang langsung; AAB untuk Google Play — lihat <Link component={RouterLink} to="/docs#publish">panduan publikasi</Link>.</Typography>}
                </Box>
              );
            })}
          </Box>

          {ok && art('apk') && (
            <Box sx={{ textAlign: 'center', border: 1, borderColor: 'divider', borderRadius: 2, p: 2.5, bgcolor: 'background.paper' }}>
              <Typography variant="overline" color="text.secondary" component="div" sx={{ mb: 1.5 }}>Pasang di HP</Typography>
              {qr ? <Box component="img" src={qr} alt="Kode QR untuk mengunduh APK" sx={{ width: 168, height: 168, display: 'block', mx: 'auto', borderRadius: 1, bgcolor: '#fff', p: 0.5 }} /> : <Skeleton variant="rounded" width={168} height={168} sx={{ mx: 'auto' }} />}
              <Typography variant="caption" component="div" sx={{ mt: 1.5 }}>Pindai untuk mengunduh APK, lalu izinkan pemasangan dari sumber ini.</Typography>
            </Box>
          )}
        </Box>
      </Container>
    </Box>
  );
}
