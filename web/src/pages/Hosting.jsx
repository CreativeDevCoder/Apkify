import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Container, Typography, Card, CardContent, Stack, TextField, Button, Alert, InputAdornment, LinearProgress, List, ListItem,
  ListItemText, IconButton, Tooltip, Tabs, Tab, Link
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AndroidIcon from '@mui/icons-material/Android';
import JSZip from 'jszip';
import PageHeader from '../components/PageHeader';
import FileDrop from '../components/FileDrop';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

/** Ekstrak ZIP di browser (bukan di server) lalu kirim file satu per satu dalam satu request. */
async function zipToForm(file) {
  const zip = await JSZip.loadAsync(file);
  let entries = Object.values(zip.files).filter((e) => !e.dir && !e.name.startsWith('__MACOSX') && !e.name.endsWith('.DS_Store'));
  // ZIP berisi satu folder (mis. dist/) -> naikkan
  if (!entries.some((e) => e.name === 'index.html')) {
    const tops = new Set(entries.map((e) => e.name.split('/')[0]));
    if (tops.size === 1) {
      const top = `${[...tops][0]}/`;
      entries = entries.map((e) => ({ e, name: e.name.slice(top.length) }));
    } else entries = entries.map((e) => ({ e, name: e.name }));
  } else entries = entries.map((e) => ({ e, name: e.name }));
  if (!entries.some((x) => x.name === 'index.html')) throw new Error('ZIP harus berisi index.html di folder utama.');
  if (entries.length > 300) throw new Error('Maksimal 300 file.');
  const fd = new FormData();
  for (const { e, name } of entries) fd.append('f', new File([await e.async('blob')], name));
  return fd;
}

export default function Hosting() {
  const { user, isAnon } = useAuth();
  const nav = useNavigate();
  const [qs] = useSearchParams();
  const [data, setData] = useState(null);
  const [name, setName] = useState(qs.get('name') || '');
  const [tab, setTab] = useState(qs.get('from') === 'ai' ? 'html' : 'zip');
  const [zip, setZip] = useState(null);
  const [html, setHtml] = useState(() => (qs.get('from') === 'ai' ? (JSON.parse(sessionStorage.getItem('apkify:ai') || '{}').html || '') : ''));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(() => {
    if (!user || isAnon) return;
    api.get('/api/sites/mine').then(setData).catch((e) => setMsg({ type: 'error', text: e.message }));
  }, [user, isAnon]);
  useEffect(() => { load(); }, [load]);

  async function publish() {
    setBusy(true); setMsg(null);
    try {
      const fd = tab === 'zip' ? await zipToForm(zip) : (() => { const x = new FormData(); x.append('html', html); return x; })();
      const r = await api.post(`/api/sites/${name.toLowerCase()}`, fd);
      setMsg({ type: 'success', text: `Terbit di ${r.url}`, url: r.url });
      load();
    } catch (e) { setMsg({ type: 'error', text: e.message }); } finally { setBusy(false); }
  }

  const domain = data?.domain || 'domain-anda';

  return (
    <>
      <PageHeader title="Hosting gratis" subtitle="Terbitkan situs statis, hasil build React/Vite, atau aplikasi AI ke subdomain HTTPS — lalu jadikan aplikasi Android." />
      <Container maxWidth="md" sx={{ py: 4 }}>
        {(!user || isAnon) ? (
          <Alert severity="info" action={<Button component={RouterLink} to="/register?next=/hosting">Daftar</Button>}>Hosting membutuhkan akun gratis (maks. 3 situs per akun).</Alert>
        ) : data && !data.enabled ? (
          <Alert severity="warning">Hosting belum diaktifkan oleh admin server (HOSTING_DOMAIN & R2).</Alert>
        ) : (
          <Card sx={{ mb: 3 }}><CardContent><Stack spacing={2}>
            <TextField label="Nama subdomain" value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32))}
              InputProps={{ endAdornment: <InputAdornment position="end">.{domain}</InputAdornment> }} helperText="3–32 karakter: huruf kecil, angka, tanda minus" />
            <Tabs value={tab} onChange={(_, v) => setTab(v)}><Tab value="zip" label="ZIP" /><Tab value="html" label="HTML" /></Tabs>
            {tab === 'zip' ? <FileDrop accept=".zip" file={zip} onFile={setZip} hint="Maks 25 MB / 300 file, index.html di root" />
              : <TextField multiline minRows={8} label="Kode HTML" value={html} onChange={(e) => setHtml(e.target.value)} InputProps={{ sx: { fontFamily: 'monospace', fontSize: 13 } }} />}
            {busy && <LinearProgress />}
            {msg && <Alert severity={msg.type} action={msg.url && <Button color="inherit" onClick={() => nav(`/create?type=url&url=${encodeURIComponent(msg.url)}&name=${encodeURIComponent(name)}`)}>Jadikan APK</Button>}>
              {msg.url ? <>Terbit di <Link href={msg.url} target="_blank" rel="noopener">{msg.url}</Link></> : msg.text}</Alert>}
            <Button variant="contained" size="large" disabled={busy || name.length < 3 || (tab === 'zip' ? !zip : !html.trim())} onClick={publish}>Terbitkan</Button>
          </Stack></CardContent></Card>
        )}

        {data?.sites?.length > 0 && <>
          <Typography variant="h6" gutterBottom>Situs saya</Typography>
          <Card><List>
            {data.sites.map((s) => (
              <ListItem key={s.name} secondaryAction={<>
                <Tooltip title="Buka"><IconButton href={s.url} target="_blank" rel="noopener"><OpenInNewIcon /></IconButton></Tooltip>
                <Tooltip title="Jadikan APK"><IconButton onClick={() => nav(`/create?type=url&url=${encodeURIComponent(s.url)}&name=${encodeURIComponent(s.title || s.name)}`)}><AndroidIcon /></IconButton></Tooltip>
                <Tooltip title="Hapus"><IconButton onClick={async () => { if (window.confirm(`Hapus ${s.name}?`)) { await api.del(`/api/sites/${s.name}`); load(); } }}><DeleteIcon /></IconButton></Tooltip>
              </>}>
                <ListItemText primary={s.url} secondary={`${s.title} • ${s.files} file • ${(s.bytes / 1048576).toFixed(2)} MB • ${new Date(s.updatedAt).toLocaleString('id-ID')}`} />
              </ListItem>
            ))}
          </List></Card>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Terbitkan ulang dengan nama yang sama untuk memperbarui situs (aplikasi berbasis URL langsung ikut ter-update).</Typography>
        </>}
      </Container>
    </>
  );
}
