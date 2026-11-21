import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container, Grid, Card, CardActionArea, CardContent, CardMedia, Typography, Chip, Stack, TextField, MenuItem, Button, Skeleton, Alert, Box, Tabs, Tab
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PageHeader from '../../components/PageHeader';
import { api, fileUrl } from '../../lib/api';
import { swr } from '../../lib/cache';
import { useAuth } from '../../context/AuthContext';

export const rupiah = (n) => (n ? `Rp${Number(n).toLocaleString('id-ID')}` : 'Nego');
const STATUS = { pending: ['Menunggu moderasi', 'warning'], approved: ['Tayang', 'success'], rejected: ['Ditolak', 'error'], sold: ['Terjual', 'default'] };

function ListingCard({ l, mine }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea component={RouterLink} to={mine ? `/market/edit/${l.id}` : `/market/${l.id}`} sx={{ height: '100%' }}>
        {l.imageFileIds?.[0]
          ? <CardMedia component="img" height="170" image={fileUrl(l.imageFileIds[0])} alt="" sx={{ objectFit: 'cover' }} />
          : <Box sx={{ height: 170, bgcolor: 'action.hover', display: 'grid', placeItems: 'center', fontSize: 48 }}>📱</Box>}
        <CardContent>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Chip size="small" label={l.category} />
            {mine && <Chip size="small" color={STATUS[l.status]?.[1]} label={STATUS[l.status]?.[0]} />}
          </Stack>
          <Typography variant="h6" noWrap>{l.title}</Typography>
          <Typography variant="h6" color="primary" fontWeight={800}>{rupiah(l.price)}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l.description}</Typography>
          {mine && l.note && <Typography variant="caption" color="error">Catatan moderator: {l.note}</Typography>}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function Market() {
  const { user, isAnon } = useAuth();
  const [tab, setTab] = useState('all');
  const [data, setData] = useState(null);
  const [mine, setMine] = useState(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Semua');
  const [sort, setSort] = useState('new');
  const [err, setErr] = useState('');

  useEffect(() => {
    swr('market', () => api.get('/api/public/market', { auth: false }), { ttl: 60_000, onData: setData }).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => {
    if (tab === 'mine' && user && !isAnon) api.get('/api/market/mine').then((r) => setMine(r.items)).catch((e) => setErr(e.message));
  }, [tab, user, isAnon]);

  const items = useMemo(() => {
    let list = data?.items || [];
    if (cat !== 'Semua') list = list.filter((l) => l.category === cat);
    if (q) list = list.filter((l) => `${l.title} ${l.description} ${l.tech}`.toLowerCase().includes(q.toLowerCase()));
    if (sort === 'cheap') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'expensive') list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [data, cat, q, sort]);

  return (
    <>
      <PageHeader title="Marketplace aplikasi" subtitle="Jual & beli aplikasi Android, website, dan source code yang sudah jadi.">
        <Button variant="contained" startIcon={<AddIcon />} component={RouterLink} to="/market/sell" sx={{ mt: 2 }}>Jual aplikasi</Button>
      </PageHeader>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          Transaksi dilakukan langsung antara pembeli dan penjual. Gunakan rekening bersama (rekber/escrow), minta demo & bukti kepemilikan, dan jangan transfer sebelum yakin.
          Laporkan listing mencurigakan lewat halaman <RouterLink to="/contact">Kontak</RouterLink>.
        </Alert>
        {user && !isAnon && (
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}><Tab value="all" label="Semua listing" /><Tab value="mine" label="Listing saya" /></Tabs>
        )}
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

        {tab === 'all' ? <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
            <TextField placeholder="Cari aplikasi…" value={q} onChange={(e) => setQ(e.target.value)} />
            <TextField select label="Kategori" value={cat} onChange={(e) => setCat(e.target.value)} sx={{ minWidth: 200 }}>
              {['Semua', ...(data?.categories || [])].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField select label="Urutkan" value={sort} onChange={(e) => setSort(e.target.value)} sx={{ minWidth: 180 }}>
              <MenuItem value="new">Terbaru</MenuItem><MenuItem value="cheap">Termurah</MenuItem><MenuItem value="expensive">Termahal</MenuItem>
            </TextField>
          </Stack>
          {data === null ? (
            <Grid container spacing={2}>{[1, 2, 3].map((i) => <Grid item xs={12} sm={6} md={4} key={i}><Skeleton variant="rounded" height={320} /></Grid>)}</Grid>
          ) : items.length === 0 ? (
            <Typography color="text.secondary">Belum ada listing{q || cat !== 'Semua' ? ' yang cocok' : ''}.</Typography>
          ) : (
            <Grid container spacing={2}>{items.map((l) => <Grid item xs={12} sm={6} md={4} key={l.id}><ListingCard l={l} /></Grid>)}</Grid>
          )}
        </> : (
          mine === null ? <Skeleton variant="rounded" height={200} /> : mine.length === 0
            ? <Typography color="text.secondary">Anda belum punya listing.</Typography>
            : <Grid container spacing={2}>{mine.map((l) => <Grid item xs={12} sm={6} md={4} key={l.id}><ListingCard l={l} mine /></Grid>)}</Grid>
        )}
      </Container>
    </>
  );
}
