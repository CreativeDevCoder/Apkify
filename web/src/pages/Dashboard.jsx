import { useEffect, useState, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container, Typography, Button, Avatar, Stack, Box,
  IconButton, Tooltip, Alert, Skeleton, Dialog, DialogTitle,
  DialogContent, DialogActions
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { ref, get, query, limitToLast, orderByChild } from 'firebase/database';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { swr, clearCache } from '../lib/cache';
import { api, fileUrl } from '../lib/api';
import StatusChip from '../components/StatusChip';
import { RemoteDialog, KeystoreDialog, AnalyticsDialog, AppLinksDialog, IosSigningDialog } from '../components/AppDialogs';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Menu, MenuItem } from '@mui/material';
import AppsIcon from '@mui/icons-material/AppsOutlined';
import { Divider } from '@mui/material';
import { Eyebrow, EmptyState } from '../components/ui';
import { MONO } from '../theme';
import { PREVIEW, previewApps, previewBuilds } from '../lib/previewFixtures';

const COLS = 'minmax(0,2.4fr) 110px minmax(0,1.2fr) 150px 110px 132px';

const toList = (obj) => Object.entries(obj || {}).map(([id, v]) => ({ id, ...v }));

export default function Dashboard() {
  const { user, isAnon } = useAuth();
  const [apps, setApps] = useState(null);
  const [builds, setBuilds] = useState(null);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [remoteApp, setRemoteApp] = useState(null);
  const [ksApp, setKsApp] = useState(null);
  const [more, setMore] = useState(null); // { el, app }
  const [dlg, setDlg] = useState({}); // { analytics|links|ios: app }

  const load = useCallback((force = false) => {
    setErr('');
    if (PREVIEW) { setApps(previewApps); setBuilds(previewBuilds); return; }
    // Cache 2 menit; tombol refresh memaksa ambil ulang
    swr(`apps:${user.uid}`, async () => toList((await get(ref(db, `apps/${user.uid}`))).val())
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)), { ttl: 120_000, force, onData: setApps })
      .catch((e) => setErr(e.message));
    swr(`apps:${user.uid}:builds`, async () => toList((await get(query(ref(db, `userBuilds/${user.uid}`), orderByChild('createdAt'), limitToLast(15)))).val())
      .sort((a, b) => b.createdAt - a.createdAt), { ttl: 120_000, force, onData: setBuilds })
      .catch(() => {});
  }, [user.uid]);

  useEffect(() => { load(); }, [load]);

  async function removeApp() {
    const app = confirm;
    setConfirm(null);
    try {
      await api.del(`/api/apps/${app.id}`);
      clearCache(`apps:${user.uid}`);
      load(true);
    } catch (e) { setErr(e.message); }
  }

  const PLAT = { android: 'Android', ios: 'iOS', windows: 'Windows', macos: 'macOS', linux: 'Linux' };
  const ago = (t) => {
    if (!t) return '—';
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'baru saja';
    if (m < 60) return `${m} mnt lalu`;
    if (m < 1440) return `${Math.round(m / 60)} jam lalu`;
    return new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  };

  return (
    <Box>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 3.5, md: 4.5 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'flex-end' }} spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Eyebrow sx={{ mb: 1 }}>Studio</Eyebrow>
              <Typography variant="h3" component="h1">Aplikasi saya</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }} className="tnum">
                {apps ? `${apps.length} aplikasi · ${apps.filter((a) => a.lastStatus === 'building' || a.lastStatus === 'queued').length} sedang dibuild` : 'Memuat…'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Tooltip title="Muat ulang"><IconButton onClick={() => load(true)} aria-label="Muat ulang" sx={{ border: 1, borderColor: 'divider', width: 34, height: 34 }}><RefreshIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
              <Button variant="contained" startIcon={<AddIcon />} component={RouterLink} to="/create">Aplikasi baru</Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {isAnon && (
        <Alert severity="warning" sx={{ mb: 3 }} action={<Button color="inherit" size="small" component={RouterLink} to="/register?next=/dashboard">Daftar</Button>}>
          Mode tamu: aplikasi hanya tersimpan di browser ini. Daftar gratis untuk menyimpannya permanen.
        </Alert>
      )}

      {apps === null ? (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
          {[1, 2, 3].map((i) => (
            <Stack key={i} direction="row" spacing={2} alignItems="center" sx={{ px: 2, py: 1.75, borderTop: i > 1 ? 1 : 0, borderColor: 'divider' }}>
              <Skeleton variant="rounded" width={36} height={36} /><Box sx={{ flex: 1 }}><Skeleton width="30%" /><Skeleton width="18%" /></Box>
            </Stack>
          ))}
        </Box>
      ) : apps.length === 0 ? (
        <EmptyState icon={<AppsIcon />} title="Belum ada aplikasi" action={<Button variant="contained" component={RouterLink} to="/create">Buat aplikasi pertama</Button>}>
          Mulai dari alamat website, ZIP, atau satu file HTML. Build pertama biasanya selesai dalam 3–6 menit.
        </EmptyState>
      ) : (
        <Box role="table" aria-label="Daftar aplikasi" sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
          <Box role="row" sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: COLS, columnGap: 2, px: 2, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: (t) => t.tokens.subtle, borderRadius: '8px 8px 0 0' }}>
            {['Aplikasi', 'Versi', 'Platform', 'Status', 'Diperbarui', ''].map((h) => <Typography key={h} role="columnheader" variant="overline" color="text.secondary">{h}</Typography>)}
          </Box>
          {apps.map((a, i) => (
            <Box role="row" key={a.id} sx={{
              display: 'grid', gridTemplateColumns: { xs: '1fr auto', md: COLS }, columnGap: 2, rowGap: 1, alignItems: 'center',
              px: 2, py: 1.5, borderTop: i ? 1 : 0, borderColor: 'divider', transition: 'background-color 120ms', '&:hover': { bgcolor: 'action.hover' }
            }}>
              <Stack role="cell" direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                <Avatar variant="rounded" src={a.iconFileId ? fileUrl(a.iconFileId) : ''} sx={{ width: 36, height: 36, borderRadius: 1.75, bgcolor: 'primary.main', color: '#fff' }}>{a.name?.[0]}</Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography component={RouterLink} to={`/create/${a.id}`} variant="body2" noWrap sx={{ fontWeight: 600, color: 'text.primary', textDecoration: 'none', display: 'block', '&:hover': { color: 'primary.main' } }}>{a.name}</Typography>
                  <Typography noWrap sx={{ fontFamily: MONO, fontSize: 11.5, color: 'text.secondary' }}>{a.packageName}</Typography>
                </Box>
              </Stack>
              <Typography role="cell" className="tnum" sx={{ display: { xs: 'none', md: 'block' }, fontFamily: MONO, fontSize: 12 }}>{a.versionName} <Box component="span" sx={{ color: 'text.disabled' }}>({a.versionCode})</Box></Typography>
              <Typography role="cell" variant="body2" color="text.secondary" noWrap sx={{ display: { xs: 'none', md: 'block' } }}>
                {Object.entries(a.platforms || { android: true }).filter(([, v]) => v).map(([k]) => PLAT[k] || k).join(', ')}
              </Typography>
              <Box role="cell" sx={{ gridRow: { xs: 2, md: 'auto' } }}>
                {a.lastBuildId ? <Box component={RouterLink} to={`/build/${a.lastBuildId}`} sx={{ textDecoration: 'none', color: 'inherit', '&:hover span': { textDecoration: 'underline' } }}><StatusChip status={a.lastStatus} /></Box> : <StatusChip status={a.lastStatus} />}
              </Box>
              <Typography role="cell" variant="body2" color="text.secondary" className="tnum" sx={{ display: { xs: 'none', md: 'block' } }}>{ago(a.updatedAt)}</Typography>
              <Stack role="cell" direction="row" spacing={0.5} justifyContent="flex-end" sx={{ gridRow: { xs: '1 / span 2', md: 'auto' }, gridColumn: { xs: 2, md: 'auto' } }}>
                <Button size="small" variant="outlined" component={RouterLink} to={`/create/${a.id}`} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>Perbarui</Button>
                <Tooltip title="Tindakan lain"><IconButton size="small" aria-label={`Tindakan untuk ${a.name}`} onClick={(e) => setMore({ el: e.currentTarget, app: a })}><MoreVertIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
              </Stack>
            </Box>
          ))}
        </Box>
      )}

      {builds?.length > 0 && (
        <Box sx={{ mt: { xs: 5, md: 7 } }}>
          <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Typography variant="h5" component="h2">Riwayat build</Typography>
            <Typography variant="caption">{builds.length} terakhir</Typography>
          </Stack>
          <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
            {builds.map((b) => (
              <Box key={b.id} component={RouterLink} to={`/build/${b.id}`} sx={{
                display: 'grid', gridTemplateColumns: { xs: '1fr auto', sm: '150px 1fr 160px' }, columnGap: 2, alignItems: 'center', py: 1.25,
                borderBottom: 1, borderColor: 'divider', textDecoration: 'none', color: 'inherit', '&:hover': { bgcolor: 'action.hover' }, px: 0.5
              }}>
                <Typography className="tnum" sx={{ fontFamily: MONO, fontSize: 12, color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>
                  {new Date(b.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Typography>
                <Typography variant="body2" noWrap><Box component="span" sx={{ fontWeight: 500 }}>{b.name || b.appId}</Box> <Box component="span" sx={{ fontFamily: MONO, fontSize: 12, color: 'text.secondary' }}>v{b.versionName || ''}</Box></Typography>
                <Box sx={{ justifySelf: 'end' }}><StatusChip status={b.status} /></Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}
      </Container>

      <Menu anchorEl={more?.el} open={!!more} onClose={() => setMore(null)}>
        <MenuItem component={RouterLink} to={more?.app?.lastBuildId ? `/build/${more.app.lastBuildId}` : '#'} onClick={() => setMore(null)} disabled={!more?.app?.lastBuildId}>Build terakhir</MenuItem>
        <MenuItem component={RouterLink} to={`/create/${more?.app?.id}`} onClick={() => setMore(null)}>Perbarui & build</MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => { setRemoteApp(more.app); setMore(null); }}>Remote Update</MenuItem>
        <MenuItem onClick={() => { setKsApp(more.app); setMore(null); }}>Keystore & penandatanganan</MenuItem>
        <MenuItem onClick={() => { setDlg({ analytics: more.app }); setMore(null); }}>Analitik</MenuItem>
        <MenuItem onClick={() => { setDlg({ links: more.app }); setMore(null); }}>App Links (assetlinks.json)</MenuItem>
        <MenuItem onClick={() => { setDlg({ ios: more.app }); setMore(null); }}>Sertifikat iOS</MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem sx={{ color: 'error.main' }} onClick={() => { setConfirm(more.app); setMore(null); }}>Hapus aplikasi…</MenuItem>
      </Menu>
      <AnalyticsDialog app={dlg.analytics} onClose={() => setDlg({})} />
      <AppLinksDialog app={dlg.links} onClose={() => setDlg({})} />
      <IosSigningDialog app={dlg.ios} onClose={() => setDlg({})} />
      <RemoteDialog app={remoteApp} onClose={() => setRemoteApp(null)} />
      <KeystoreDialog app={ksApp} isAnon={isAnon} onClose={() => setKsApp(null)} />
      <Dialog open={!!confirm} onClose={() => setConfirm(null)}>
        <DialogTitle>Hapus {confirm?.name}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">Aplikasi dan riwayat build akan dihapus dari dashboard. <b>Unduh keystore terlebih dahulu</b> bila aplikasi sudah terbit di Play Store — tanpa kunci yang sama Anda tidak bisa merilis update.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Batal</Button>
          <Button color="error" variant="contained" onClick={removeApp}>Hapus</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
