import { Link as RouterLink } from 'react-router-dom';
import { Container, Typography, Button, Stack } from '@mui/material';
import { MONO } from '../theme';

export default function NotFound() {
  return (
    <Container maxWidth="sm" sx={{ py: { xs: 10, md: 16 } }}>
      <Typography sx={{ fontFamily: MONO, fontSize: 13, color: 'text.secondary' }}>404 · halaman tidak ditemukan</Typography>
      <Typography variant="h2" component="h1" sx={{ mt: 1.5 }}>Alamat ini tidak mengarah ke mana pun.</Typography>
      <Typography variant="subtitle1" sx={{ mt: 1.5 }}>Mungkin tautannya salah ketik, atau halaman sudah dipindahkan.</Typography>
      <Stack direction="row" spacing={1.5} sx={{ mt: 4 }}>
        <Button variant="contained" component={RouterLink} to="/">Ke beranda</Button>
        <Button variant="outlined" component={RouterLink} to="/docs">Buka panduan</Button>
      </Stack>
    </Container>
  );
}
