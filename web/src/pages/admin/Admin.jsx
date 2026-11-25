import { useEffect, useState, useCallback } from 'react';
import { PostsAdmin, MarketAdmin, MessagesAdmin } from './ContentAdmin';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container, Typography, Tabs, Tab, Card, Table, TableHead, TableRow, TableCell, TableBody, Switch,
  Chip, LinearProgress, TextField, Button, Stack, Alert, Box, IconButton, Tooltip, CardContent, TableContainer
} from '@mui/material';
import { ToolHeader } from '../../components/ui';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import { api } from '../../lib/api';
import StatusChip from '../../components/StatusChip';

const gb = (b) => (b / 1024 ** 3).toFixed(2);

function ProviderTable({ kind, rows, onSave }) {
  const [edit, setEdit] = useState({});
  const val = (r, k) => (edit[r.id]?.[k] ?? r[k]);
  const ch = (id, k, v) => setEdit((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Prioritas</TableCell>
            <TableCell>Penyedia</TableCell>
            <TableCell>Status</TableCell>
            {kind === 'email' ? <>
              <TableCell>Hari ini</TableCell><TableCell>Bulan ini</TableCell><TableCell>Limit/hari</TableCell><TableCell>Limit/bulan</TableCell>
            </> : <>
              <TableCell>Pemakaian</TableCell><TableCell>Kapasitas (GB)</TableCell><TableCell>File</TableCell>
            </>}
            <TableCell>Aktif</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => {
            const pct = kind === 'storage' ? Math.min(100, (r.usedBytes / (r.capacityBytes || 1)) * 100) : null;
            return (
              <TableRow key={r.id}>
                <TableCell sx={{ width: 90 }}><TextField type="number" value={val(r, 'priority')} onChange={(e) => ch(r.id, 'priority', Number(e.target.value))} /></TableCell>
                <TableCell><b>{r.name}</b><Typography variant="caption" display="block" color="text.secondary">{r.note}</Typography></TableCell>
                <TableCell>
                  {!r.configured ? <Chip size="small" label="Belum dikonfigurasi" /> :
                    r.coolingUntil > Date.now() ? <Tooltip title={r.lastError || ''}><Chip size="small" color="warning" label="Jeda (error)" /></Tooltip> :
                      <Chip size="small" color="success" label="Siap" />}
                </TableCell>
                {kind === 'email' ? <>
                  <TableCell>{r.usage?.today || 0}</TableCell>
                  <TableCell>{r.usage?.month || 0}</TableCell>
                  <TableCell sx={{ width: 110 }}><TextField type="number" value={val(r, 'daily') ?? ''} onChange={(e) => ch(r.id, 'daily', e.target.value === '' ? null : Number(e.target.value))} /></TableCell>
                  <TableCell sx={{ width: 120 }}><TextField type="number" value={val(r, 'monthly') ?? ''} onChange={(e) => ch(r.id, 'monthly', e.target.value === '' ? null : Number(e.target.value))} /></TableCell>
                </> : <>
                  <TableCell sx={{ minWidth: 140 }}>
                    <LinearProgress variant="determinate" value={pct} color={pct > 85 ? 'error' : 'primary'} />
                    <Typography variant="caption">{gb(r.usedBytes || 0)} GB ({pct.toFixed(0)}%)</Typography>
                  </TableCell>
                  <TableCell sx={{ width: 110 }}><TextField type="number" value={edit[r.id]?.capacityGb ?? gb(r.capacityBytes)} onChange={(e) => ch(r.id, 'capacityGb', e.target.value)} /></TableCell>
                  <TableCell>{r.files || 0}</TableCell>
                </>}
                <TableCell><Switch checked={!!val(r, 'enabled')} onChange={(e) => ch(r.id, 'enabled', e.target.checked)} /></TableCell>
                <TableCell>
                  <IconButton disabled={!edit[r.id]} onClick={async () => {
                    const p = { ...edit[r.id] };
                    if (p.capacityGb !== undefined) { p.capacityBytes = Math.round(Number(p.capacityGb) * 1024 ** 3); delete p.capacityGb; }
                    await onSave(r.id, p);
                    setEdit((e) => { const n = { ...e }; delete n[r.id]; return n; });
                  }}><SaveIcon /></IconButton>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('email');
  const [data, setData] = useState(null);
  const [builds, setBuilds] = useState([]);
  const [settings, setSettings] = useState({ dailyBuildLimit: 10, anonDailyLimit: 2, anonIpDailyLimit: 5, aiDailyLimit: 5, aiGlobalDailyLimit: 60, marketAutoApprove: false, maintenance: false });
  const notify = useCallback((type, text) => setMsg({ type, text }), []);
  const [testTo, setTestTo] = useState('');
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      const [p, b, s] = await Promise.all([api.get('/api/admin/providers'), api.get('/api/admin/builds'), api.get('/api/admin/settings')]);
      setData(p); setBuilds(b.builds || []); setSettings((x) => ({ ...x, ...s }));
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = (kind) => async (id, patch) => {
    try { await api.put(`/api/admin/providers/${kind}/${id}`, patch); setMsg({ type: 'success', text: 'Tersimpan' }); load(); } catch (e) { setMsg({ type: 'error', text: e.message }); }
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      <ToolHeader title="Admin" crumb={null} actions={<IconButton onClick={load} aria-label="Muat ulang" sx={{ border: 1, borderColor: 'divider' }}><RefreshIcon sx={{ fontSize: 18 }} /></IconButton>}>Penyedia email & penyimpanan, build terbaru, batas pemakaian, dan konten.</ToolHeader>
      {msg && <Alert severity={msg.type} onClose={() => setMsg(null)} sx={{ mb: 2 }}>{msg.text}</Alert>}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable">
        <Tab value="email" label="10 Penyedia Email" />
        <Tab value="storage" label="10 Penyedia Drive" />
        <Tab value="builds" label="Build terbaru" />
        <Tab value="market" label="Moderasi marketplace" />
        <Tab value="posts" label="Berita" />
        <Tab value="messages" label="Pesan kontak" />
        <Tab value="settings" label="Pengaturan" />
      </Tabs>
      {!data && <LinearProgress />}

      {data && tab === 'email' && (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">Email dikirim lewat penyedia siap dengan prioritas terkecil yang masih punya sisa kuota (berhenti di 90% limit). Jika gagal, otomatis pindah ke penyedia berikutnya; penyedia error dijeda 10 menit.</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <TextField label="Kirim email uji ke" value={testTo} onChange={(e) => setTestTo(e.target.value)} sx={{ maxWidth: 320 }} />
              <Button variant="outlined" onClick={async () => {
                try { const r = await api.post('/api/admin/test-email', { to: testTo }); setMsg({ type: 'success', text: `Terkirim via ${r.provider}` }); load(); } catch (e) { setMsg({ type: 'error', text: e.message }); }
              }}>Kirim uji</Button>
            </Stack>
          </CardContent>
          <ProviderTable kind="email" rows={data.email} onSave={save('email')} />
        </Card>
      )}

      {data && tab === 'storage' && (
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">File baru disimpan di penyedia siap dengan persentase pemakaian terendah (prioritas sebagai pemecah seri), dan dilewati bila pemakaian melebihi 90% kapasitas.</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>Total terpakai: <b>{gb(data.storage.reduce((s, r) => s + (r.usedBytes || 0), 0))} GB</b> dari <b>{gb(data.storage.filter((r) => r.configured && r.enabled).reduce((s, r) => s + (r.capacityBytes || 0), 0))} GB</b> (penyedia aktif)</Typography>
          </CardContent>
          <ProviderTable kind="storage" rows={data.storage} onSave={save('storage')} />
        </Card>
      )}

      {tab === 'builds' && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead><TableRow><TableCell>Waktu</TableCell><TableCell>Aplikasi</TableCell><TableCell>User</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
              <TableBody>
                {builds.map((b) => (
                  <TableRow key={b.id} hover component={RouterLink} to={`/build/${b.id}`} sx={{ textDecoration: 'none' }}>
                    <TableCell>{new Date(b.createdAt).toLocaleString('id-ID')}</TableCell>
                    <TableCell>{b.name}<Typography variant="caption" display="block" color="text.secondary">{b.packageName}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{b.uid}</Typography></TableCell>
                    <TableCell><StatusChip status={b.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {tab === 'market' && <MarketAdmin notify={notify} />}
      {tab === 'posts' && <PostsAdmin notify={notify} />}
      {tab === 'messages' && <MessagesAdmin notify={notify} />}

      {tab === 'settings' && (
        <Card><CardContent>
          <Stack spacing={2} sx={{ maxWidth: 360 }}>
            {[
              ['dailyBuildLimit', 'Batas build per akun per hari'],
              ['anonDailyLimit', 'Batas build tamu (tanpa login) per hari'],
              ['anonIpDailyLimit', 'Batas build tamu per IP per hari'],
              ['aiDailyLimit', 'Kredit AI Studio per akun per hari'],
              ['aiGlobalDailyLimit', 'Total generate AI per hari (semua user)']
            ].map(([k, label]) => (
              <TextField key={k} type="number" label={label} value={settings[k] ?? ''} onChange={(e) => setSettings({ ...settings, [k]: Number(e.target.value) })} />
            ))}
            <Box>
              <Switch checked={!!settings.marketAutoApprove} onChange={(e) => setSettings({ ...settings, marketAutoApprove: e.target.checked })} /> Listing marketplace langsung tayang (tanpa moderasi)
            </Box>
            <Box>
              <Switch checked={!!settings.maintenance} onChange={(e) => setSettings({ ...settings, maintenance: e.target.checked })} /> Mode perawatan (tolak build baru)
            </Box>
            <Button variant="contained" onClick={async () => {
              try { await api.put('/api/admin/settings', settings); setMsg({ type: 'success', text: 'Pengaturan tersimpan' }); } catch (e) { setMsg({ type: 'error', text: e.message }); }
            }}>Simpan</Button>
          </Stack>
        </CardContent></Card>
      )}
    </Container>
  );
}
