import { useEffect, useState, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container, Typography, Grid, Card, CardContent, CardActions, Button, Avatar, Stack, Box,
  IconButton, Tooltip, Alert, Skeleton, List, ListItemButton, ListItemText, Dialog, DialogTitle,
  DialogContent, DialogActions
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import KeyIcon from '@mui/icons-material/VpnKey';
import DeleteIcon from '@mui/icons-material/Delete';
import { ref, get, query, limitToLast, orderByChild } from 'firebase/database';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { swr, clearCache } from '../lib/cache';
import { api, fileUrl } from '../lib/api';
import StatusChip from '../components/StatusChip';
import { RemoteDialog, KeystoreDialog } from '../components/AppDialogs';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';

const toList = (obj) => Object.entries(obj || {}).map(([id, v]) => ({ id, ...v }));

export default function Dashboard() {
  const { user, isAnon } = useAuth();
  const [apps, setApps] = useState(null);
  const [builds, setBuilds] = useState(null);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [remoteApp, setRemoteApp] = useState(null);
  const [ksApp, setKsApp] = useState(null);

  const load = useCallback((force = false) => {
    setErr('');
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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 3 }} spacing={1}>
        <Typography variant="h4" sx={{ flex: 1 }}>Studio — Aplikasi Saya</Typography>
        <Tooltip title="Muat ulang"><IconButton onClick={() => load(true)}><RefreshIcon /></IconButton></Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} component={RouterLink} to="/create">Buat baru</Button>
      </Stack>
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {isAnon && (
        <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" component={RouterLink} to="/register?next=/dashboard">Daftar</Button>}>
          Mode tamu: aplikasi hanya tersimpan di browser ini dan hilang bila sesi dihapus. Daftar gratis untuk menyimpannya permanen.
        </Alert>
      )}

      {apps === null ? (
        <Grid container spacing={2}>{[1, 2, 3].map((i) => <Grid item xs={12} sm={6} md={4} key={i}><Skeleton variant="rounded" height={170} /></Grid>)}</Grid>
      ) : apps.length === 0 ? (
        <Card><CardContent sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="h6">Belum ada aplikasi</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Buat aplikasi pertama Anda dari website, ZIP, atau HTML.</Typography>
          <Button variant="contained" component={RouterLink} to="/create">Buat aplikasi</Button>
        </CardContent></Card>
      ) : (
        <Grid container spacing={2}>
          {apps.map((a) => (
            <Grid item xs={12} sm={6} md={4} key={a.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar variant="rounded" src={a.iconFileId ? fileUrl(a.iconFileId) : ''} sx={{ width: 56, height: 56, borderRadius: 3 }}>{a.name?.[0]}</Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography fontWeight={700} noWrap>{a.name}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap component="div">{a.packageName}</Typography>
                      <Typography variant="caption" color="text.secondary">v{a.versionName} ({a.versionCode})</Typography>
                    </Box>
                  </Stack>
                  <Box sx={{ mt: 2 }}><StatusChip status={a.lastStatus} /></Box>
                </CardContent>
                <CardActions>
                  {a.lastBuildId && <Button size="small" component={RouterLink} to={`/build/${a.lastBuildId}`}>Build terakhir</Button>}
                  <Button size="small" component={RouterLink} to={`/create/${a.id}`}>Update</Button>
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title="Remote Update"><IconButton size="small" onClick={() => setRemoteApp(a)}><SystemUpdateIcon fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Keystore & Signing"><IconButton size="small" onClick={() => setKsApp(a)}><KeyIcon fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Hapus"><IconButton size="small" onClick={() => setConfirm(a)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {builds?.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mt: 5, mb: 1 }}>Riwayat build</Typography>
          <Card>
            <List dense>
              {builds.map((b) => (
                <ListItemButton key={b.id} component={RouterLink} to={`/build/${b.id}`}>
                  <ListItemText primary={`${b.name || b.appId} • v${b.versionName || ''}`} secondary={new Date(b.createdAt).toLocaleString('id-ID')} />
                  <StatusChip status={b.status} />
                </ListItemButton>
              ))}
            </List>
          </Card>
        </>
      )}

      <RemoteDialog app={remoteApp} onClose={() => setRemoteApp(null)} />
      <KeystoreDialog app={ksApp} isAnon={isAnon} onClose={() => setKsApp(null)} />
      <Dialog open={!!confirm} onClose={() => setConfirm(null)}>
        <DialogTitle>Hapus {confirm?.name}?</DialogTitle>
        <DialogContent>
          <Typography>Aplikasi dan riwayat build akan dihapus dari dashboard. <b>Unduh keystore terlebih dahulu</b> bila aplikasi sudah terbit di Play Store — tanpa kunci yang sama Anda tidak bisa merilis update.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Batal</Button>
          <Button color="error" variant="contained" onClick={removeApp}>Hapus</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
