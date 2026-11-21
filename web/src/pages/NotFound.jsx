import { Link as RouterLink } from 'react-router-dom';
import { Container, Typography, Button } from '@mui/material';

export default function NotFound() {
  return (
    <Container sx={{ py: 10, textAlign: 'center' }}>
      <Typography variant="h2">404</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Halaman tidak ditemukan.</Typography>
      <Button variant="contained" component={RouterLink} to="/">Ke beranda</Button>
    </Container>
  );
}
