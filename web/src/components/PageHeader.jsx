import { Box, Container, Typography } from '@mui/material';
import { Eyebrow } from './ui';

/** Kepala halaman: ringkas, rata kiri, dipisah garis rambut — bukan banner. */
export default function PageHeader({ title, subtitle, eyebrow, children, maxWidth = 'lg' }) {
  return (
    <Box component="header" sx={{ borderBottom: 1, borderColor: 'divider', pt: { xs: 5, md: 8 }, pb: { xs: 4, md: 5 } }}>
      <Container maxWidth={maxWidth}>
        {eyebrow && <Eyebrow sx={{ mb: 1.5 }}>{eyebrow}</Eyebrow>}
        <Typography variant="h2" component="h1" sx={{ maxWidth: 820 }}>{title}</Typography>
        {subtitle && <Typography variant="subtitle1" sx={{ mt: 1.5, maxWidth: 680 }}>{subtitle}</Typography>}
        {children && <Box sx={{ mt: 3 }}>{children}</Box>}
      </Container>
    </Box>
  );
}
