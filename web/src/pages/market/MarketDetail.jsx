import { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { Container, Grid, Card, CardContent, Typography, Chip, Stack, Button, Alert, Skeleton, Box, Divider, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import EmailIcon from '@mui/icons-material/Email';
import CheckIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { api, fileUrl } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { rupiah } from './Market';

const INCLUDES = { source: 'Source code', apk: 'File APK/AAB + keystore', playAccount: 'Transfer aplikasi Play Store', domain: 'Domain', content: 'Konten & database', support: 'Dukungan setelah penjualan' };

export default function MarketDetail() {
  const { id } = useParams();
  const { user, isAnon, loading } = useAuth();
  const [l, setL] = useState(undefined);
  const [img, setImg] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (loading) return;
    api.get(`/api/public/market/${id}`, { auth: !!user }).then(setL).catch((e) => { setErr(e.message); setL(null); });
  }, [id, user, loading]);

  if (l === undefined) return <Container sx={{ py: 4 }}><Skeleton variant="rounded" height={400} /></Container>;
  if (l === null) return <Container sx={{ py: 4 }}><Alert severity="error">{err}</Alert></Container>;

  const waText = encodeURIComponent(`Halo, saya tertarik dengan "${l.title}" di marketplace ${import.meta.env.VITE_APP_NAME || 'Apkify'}.`);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button component={RouterLink} to="/market" sx={{ mb: 2 }}>← Marketplace</Button>
      {l.isOwner && l.status !== 'approved' && <Alert severity="info" sx={{ mb: 2 }}>Status listing: {l.status}. {l.note}</Alert>}
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          {l.imageFileIds.length > 0 ? <>
            <Box component="img" src={fileUrl(l.imageFileIds[img])} alt="" sx={{ width: '100%', maxHeight: 460, objectFit: 'contain', borderRadius: 3, bgcolor: 'action.hover' }} />
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              {l.imageFileIds.map((f, i) => (
                <Box key={f} component="img" src={fileUrl(f)} onClick={() => setImg(i)} alt=""
                  sx={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 2, cursor: 'pointer', border: 2, borderColor: i === img ? 'primary.main' : 'transparent' }} />
              ))}
            </Stack>
          </> : <Box sx={{ height: 300, bgcolor: 'action.hover', borderRadius: 3, display: 'grid', placeItems: 'center', fontSize: 80 }}>📱</Box>}
          <Typography variant="h6" sx={{ mt: 3 }}>Deskripsi</Typography>
          <Typography sx={{ whiteSpace: 'pre-line' }}>{l.description}</Typography>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card><CardContent>
            <Chip size="small" label={l.category} sx={{ mb: 1 }} />
            <Typography variant="h5">{l.title}</Typography>
            <Typography variant="h4" color="primary" fontWeight={800} sx={{ my: 1 }}>{rupiah(l.price)}</Typography>
            <Typography variant="body2" color="text.secondary">Penjual: {l.sellerName} • Diperbarui {new Date(l.updatedAt).toLocaleDateString('id-ID')}</Typography>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={0.5}>
              {l.tech && <Typography variant="body2"><b>Teknologi:</b> {l.tech}</Typography>}
              {l.monthlyUsers > 0 && <Typography variant="body2"><b>Pengguna/bulan:</b> {l.monthlyUsers.toLocaleString('id-ID')}</Typography>}
              {l.monthlyRevenue > 0 && <Typography variant="body2"><b>Pendapatan/bulan (klaim penjual):</b> {rupiah(l.monthlyRevenue)}</Typography>}
            </Stack>
            {Object.keys(l.includes).length > 0 && <>
              <Typography fontWeight={700} sx={{ mt: 2 }}>Yang didapat pembeli</Typography>
              <List dense>{Object.keys(l.includes).map((k) => (
                <ListItem key={k} disableGutters><ListItemIcon sx={{ minWidth: 30 }}><CheckIcon color="success" fontSize="small" /></ListItemIcon><ListItemText primary={INCLUDES[k]} /></ListItem>
              ))}</List>
            </>}
            <Stack spacing={1} sx={{ mt: 2 }}>
              {l.demoUrl && <Button variant="outlined" endIcon={<OpenInNewIcon />} href={l.demoUrl} target="_blank" rel="noopener noreferrer nofollow">Lihat demo</Button>}
              {l.playUrl && <Button variant="outlined" endIcon={<OpenInNewIcon />} href={l.playUrl} target="_blank" rel="noopener noreferrer nofollow">Lihat di Play Store</Button>}
              {l.contact ? <>
                {l.contact.whatsapp && <Button variant="contained" color="success" startIcon={<WhatsAppIcon />} href={`https://wa.me/${l.contact.whatsapp}?text=${waText}`} target="_blank" rel="noopener noreferrer">Hubungi via WhatsApp</Button>}
                {l.contact.email && <Button variant="contained" startIcon={<EmailIcon />} href={`mailto:${l.contact.email}?subject=${encodeURIComponent(l.title)}`}>Kirim email</Button>}
              </> : (
                <Button variant="contained" component={RouterLink} to={`/${user && isAnon ? 'register' : 'login'}?next=/market/${id}`}>Masuk untuk melihat kontak penjual</Button>
              )}
              {l.isOwner && <Button component={RouterLink} to={`/market/edit/${id}`}>Edit listing</Button>}
            </Stack>
          </CardContent></Card>
          <Alert severity="warning" sx={{ mt: 2 }}>Pendapatan & jumlah pengguna adalah klaim penjual — minta bukti (screenshot AdMob/Play Console) dan gunakan rekber.</Alert>
        </Grid>
      </Grid>
    </Container>
  );
}
