import { Box, Container, Typography } from '@mui/material';

export default function PageHeader({ title, subtitle, children }) {
  return (
    <Box sx={{ background: (t) => (t.palette.mode === 'light' ? 'linear-gradient(135deg,#eef2ff,#ecfeff)' : 'linear-gradient(135deg,#1e1b4b,#083344)'), py: { xs: 5, md: 7 } }}>
      <Container maxWidth="lg">
        <Typography variant="h3" sx={{ fontSize: { xs: 30, md: 42 } }} gutterBottom>{title}</Typography>
        {subtitle && <Typography variant="h6" color="text.secondary" fontWeight={400}>{subtitle}</Typography>}
        {children}
      </Container>
    </Box>
  );
}
