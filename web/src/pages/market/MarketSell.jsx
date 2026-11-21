import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom';
import {
  Container, Typography, Card, CardContent, Stack, TextField, MenuItem, Button, Alert, Grid, FormControlLabel, Checkbox,
  Box, IconButton, InputAdornment, LinearProgress
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { api, fileUrl } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { clearCache } from '../../lib/cache';
import FileDrop from '../../components/FileDrop';

const CATS = ['Toko online', 'Konten & berita', 'Edukasi', 'Utilitas', 'Game', 'Bisnis & jasa', 'Lainnya'];
const INCLUDES = [['source', 'Source code'], ['apk', 'File APK/AAB + keystore'], ['playAccount', 'Transfer aplikasi Play Store'], ['domain', 'Domain'], ['content', 'Konten & database'], ['support', 'Dukungan setelah penjualan']];
const EMPTY = { title: '', category: 'Lainnya', price: '', description: '', tech: '', monthlyUsers: '', monthlyRevenue: '', demoUrl: '', playUrl: '', whatsapp: '', email: '', imageFileIds: [], includes: {} };

export default function MarketSell() {
  const { id } = useParams();
  const { user, isAnon } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ ...EMPTY, email: user?.email || '' });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(0);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!id) return;
    api.get(`/api/public/market/${id}`).then((l) => {
      if (!l.isOwner) return nav('/market');
      setStatus(l.status);
      setF({ ...EMPTY, ...l, whatsapp: l.contact?.whatsapp || '', email: l.contact?.email || '', price: String(l.price), monthlyUsers: String(l.monthlyUsers || ''), monthlyRevenue: String(l.monthlyRevenue || '') });
    }).catch((e) => setMsg({ type: 'error', text: e.message }));
  }, [id, nav]);

  if (isAnon) return <Container sx={{ py: 4 }}><Alert severity="info" action={<Button component={RouterLink} to="/register?next=/market/sell">Daftar</Button>}>Daftar gratis untuk menjual aplikasi.</Alert></Container>;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function addImage(file) {
    if (f.imageFileIds.length >= 6) return;
    try {
      const r = await api.upload('/api/uploads', file, { kind: 'image', onProgress: setUp });
      setF((x) => ({ ...x, imageFileIds: [...x.imageFileIds, r.fileId] }));
    } catch (e) { setMsg({ type: 'error', text: e.message }); } finally { setUp(0); }
  }

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const body = { ...f, price: Number(f.price || 0), monthlyUsers: Number(f.monthlyUsers || 0), monthlyRevenue: Number(f.monthlyRevenue || 0) };
      const r = id ? await api.put(`/api/market/${id}`, body) : await api.post('/api/market', body);
      clearCache('market');
      setMsg({ type: 'success', text: r.status === 'approved' ? 'Listing tayang.' : 'Listing tersimpan dan menunggu moderasi admin.' });
      if (!id) nav(`/market/edit/${r.id}`, { replace: true });
      setStatus(r.status);
    } catch (e) { setMsg({ type: 'error', text: e.message }); } finally { setBusy(false); }
  }

  async function act(kind) {
    if (kind === 'delete' && !window.confirm('Hapus listing ini?')) return;
    try {
      if (kind === 'delete') await api.del(`/api/market/${id}`); else await api.post(`/api/market/${id}/sold`, {});
      clearCache('market');
      nav('/market');
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>{id ? 'Edit listing' : 'Jual aplikasi'}</Typography>
      {status && <Typography color="text.secondary" sx={{ mb: 2 }}>Status: <b>{status}</b> {status !== 'approved' && '— listing baru/diubah ditinjau admin sebelum tayang.'}</Typography>}
      <Card><CardContent><Stack spacing={2}>
        <TextField label="Judul" value={f.title} onChange={set('title')} inputProps={{ maxLength: 80 }} required />
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField select label="Kategori" value={f.category} onChange={set('category')}>{CATS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}</TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Harga" type="number" value={f.price} onChange={set('price')} helperText="0 = nego"
              InputProps={{ startAdornment: <InputAdornment position="start">Rp</InputAdornment> }} />
          </Grid>
        </Grid>
        <TextField label="Deskripsi" multiline minRows={6} value={f.description} onChange={set('description')} inputProps={{ maxLength: 5000 }}
          helperText="Jelaskan fitur, alasan menjual, kondisi aplikasi, dan proses serah terima." />
        <TextField label="Teknologi" value={f.tech} onChange={set('tech')} placeholder="mis. WordPress + WooCommerce, React + Firebase" />
        <Grid container spacing={2}>
          <Grid item xs={6}><TextField label="Pengguna aktif/bulan" type="number" value={f.monthlyUsers} onChange={set('monthlyUsers')} /></Grid>
          <Grid item xs={6}><TextField label="Pendapatan/bulan (Rp)" type="number" value={f.monthlyRevenue} onChange={set('monthlyRevenue')} /></Grid>
        </Grid>
        <TextField label="URL demo" value={f.demoUrl} onChange={set('demoUrl')} />
        <TextField label="URL Google Play" value={f.playUrl} onChange={set('playUrl')} />
        <Typography fontWeight={700}>Yang didapat pembeli</Typography>
        <Grid container>{INCLUDES.map(([k, label]) => (
          <Grid item xs={12} sm={6} key={k}>
            <FormControlLabel label={label} control={<Checkbox checked={!!f.includes[k]} onChange={(e) => setF({ ...f, includes: { ...f.includes, [k]: e.target.checked } })} />} />
          </Grid>
        ))}</Grid>
        <Typography fontWeight={700}>Gambar (maks 6)</Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {f.imageFileIds.map((fid) => (
            <Box key={fid} sx={{ position: 'relative' }}>
              <img src={fileUrl(fid)} alt="" width={96} height={96} style={{ objectFit: 'cover', borderRadius: 8 }} />
              <IconButton size="small" sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'background.paper' }}
                onClick={() => setF({ ...f, imageFileIds: f.imageFileIds.filter((x) => x !== fid) })}><DeleteIcon fontSize="inherit" /></IconButton>
            </Box>
          ))}
        </Stack>
        {up > 0 && <LinearProgress variant="determinate" value={up} />}
        {f.imageFileIds.length < 6 && <FileDrop accept="image/png,image/jpeg,image/webp" onFile={addImage} label="Tambah gambar (PNG/JPG/WebP, maks 2 MB)" />}
        <Typography fontWeight={700}>Kontak (hanya terlihat oleh pengguna yang masuk)</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}><TextField label="WhatsApp" placeholder="6281234567890" value={f.whatsapp} onChange={set('whatsapp')} /></Grid>
          <Grid item xs={12} sm={6}><TextField label="Email" value={f.email} onChange={set('email')} /></Grid>
        </Grid>
        {msg && <Alert severity={msg.type}>{msg.text}</Alert>}
        <Stack direction="row" spacing={1}>
          <Button variant="contained" size="large" disabled={busy} onClick={save}>{id ? 'Simpan perubahan' : 'Kirim listing'}</Button>
          {id && <Button onClick={() => nav(`/market/${id}`)}>Lihat</Button>}
          <Box sx={{ flex: 1 }} />
          {id && status !== 'sold' && <Button onClick={() => act('sold')}>Tandai terjual</Button>}
          {id && <Button color="error" onClick={() => act('delete')}>Hapus</Button>}
        </Stack>
        <Typography variant="caption" color="text.secondary">Dengan mengirim listing, Anda menyatakan memiliki hak penuh atas aplikasi yang dijual. Listing palsu atau melanggar hukum akan dihapus.</Typography>
      </Stack></CardContent></Card>
    </Container>
  );
}
