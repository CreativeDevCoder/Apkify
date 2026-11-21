import { useState } from 'react';
import { Container, Typography, Card, CardContent, Stack, TextField, Grid, Box, Avatar, Button, Chip, Rating } from '@mui/material';
import FileDrop from '../../components/FileDrop';
import { fileToDataUrl } from '../../lib/iconGen';

const LIM = { name: 30, short: 80, full: 4000 };
const counter = (v, max) => `${v.length}/${max}`;

export default function ListingPreview() {
  const [f, setF] = useState({ name: 'Nama Aplikasi', dev: 'Nama Developer', short: 'Deskripsi singkat yang menjelaskan manfaat utama aplikasi.', full: 'Tulis deskripsi lengkap di sini…', category: 'Belanja' });
  const [icon, setIcon] = useState('');
  const [graphic, setGraphic] = useState('');
  const [shots, setShots] = useState([]);
  const [more, setMore] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Listing Preview</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Pratinjau kira-kira tampilan halaman aplikasi Anda di Google Play sebelum dipublikasikan (tampilan asli bisa sedikit berbeda).</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card><CardContent><Stack spacing={2}>
            <TextField label="Nama aplikasi" value={f.name} onChange={set('name')} helperText={counter(f.name, LIM.name)} error={f.name.length > LIM.name} />
            <TextField label="Nama developer" value={f.dev} onChange={set('dev')} />
            <TextField label="Kategori" value={f.category} onChange={set('category')} />
            <TextField label="Deskripsi singkat" value={f.short} onChange={set('short')} helperText={counter(f.short, LIM.short)} error={f.short.length > LIM.short} />
            <TextField label="Deskripsi lengkap" multiline minRows={6} value={f.full} onChange={set('full')} helperText={counter(f.full, LIM.full)} error={f.full.length > LIM.full} />
            <Grid container spacing={1}>
              <Grid item xs={6}><FileDrop accept="image/*" label="Ikon 512×512" onFile={async (x) => setIcon(await fileToDataUrl(x))} /></Grid>
              <Grid item xs={6}><FileDrop accept="image/*" label="Feature graphic" onFile={async (x) => setGraphic(await fileToDataUrl(x))} /></Grid>
            </Grid>
            <FileDrop accept="image/*" label="Tambah screenshot" onFile={async (x) => { const d = await fileToDataUrl(x); setShots((s) => [...s, d].slice(0, 8)); }} />
          </Stack></CardContent></Card>
        </Grid>
        <Grid item xs={12} md={6}>
          {/* Mockup halaman Play Store di bingkai HP */}
          <Box sx={{ mx: 'auto', maxWidth: 380, border: '10px solid #111', borderRadius: 6, overflow: 'hidden', bgcolor: '#fff', color: '#202124', fontFamily: 'Roboto, system-ui, sans-serif' }}>
            <Box sx={{ height: 600, overflowY: 'auto' }}>
              {graphic && <Box component="img" src={graphic} sx={{ width: '100%', aspectRatio: '1024/500', objectFit: 'cover', display: 'block' }} />}
              <Box sx={{ p: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar variant="rounded" src={icon} sx={{ width: 64, height: 64, borderRadius: 3 }}>{f.name[0]}</Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={500} fontSize={20} lineHeight={1.2} noWrap>{f.name.slice(0, LIM.name)}</Typography>
                    <Typography color="#01875f" fontSize={14} fontWeight={500}>{f.dev}</Typography>
                    <Typography color="#5f6368" fontSize={12}>Berisi iklan · Pembelian dalam aplikasi</Typography>
                  </Box>
                </Stack>
                <Stack direction="row" justifyContent="space-around" sx={{ my: 2, color: '#5f6368', fontSize: 12, textAlign: 'center' }}>
                  <Box><b style={{ color: '#202124' }}>4,8 ★</b><br />12 rb ulasan</Box>
                  <Box><b style={{ color: '#202124' }}>100 rb+</b><br />Download</Box>
                  <Box><b style={{ color: '#202124' }}>E</b><br />Semua umur</Box>
                </Stack>
                <Button fullWidth variant="contained" sx={{ bgcolor: '#01875f', borderRadius: 2, '&:hover': { bgcolor: '#016e4e' } }}>Instal</Button>
                <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', my: 2 }}>
                  {(shots.length ? shots : [null, null, null]).map((s, i) => (
                    <Box key={i} sx={{ flex: '0 0 auto', width: 110, height: 200, borderRadius: 2, bgcolor: '#eee', overflow: 'hidden' }}>
                      {s && <img src={s} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </Box>
                  ))}
                </Stack>
                <Typography fontWeight={500} fontSize={18}>Tentang aplikasi ini</Typography>
                <Typography fontSize={14} color="#5f6368" sx={{ my: 1 }}>{f.short.slice(0, LIM.short)}</Typography>
                {more && <Typography fontSize={14} color="#5f6368" sx={{ whiteSpace: 'pre-line' }}>{f.full.slice(0, LIM.full)}</Typography>}
                <Button size="small" onClick={() => setMore(!more)} sx={{ color: '#01875f', px: 0 }}>{more ? 'Lebih sedikit' : 'Selengkapnya'}</Button>
                <Box sx={{ mt: 1 }}><Chip size="small" label={f.category} variant="outlined" /></Box>
                <Typography fontWeight={500} fontSize={18} sx={{ mt: 2 }}>Rating dan ulasan</Typography>
                <Rating value={4.8} precision={0.1} readOnly size="small" />
              </Box>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}
