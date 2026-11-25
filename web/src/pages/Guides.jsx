import { Link as RouterLink, useParams, useNavigate } from 'react-router-dom';
import { Container, Typography, Button, Box, Stack, Breadcrumbs, Link } from '@mui/material';
import { CellGrid } from '../components/ui';
import { MONO } from '../theme';
import PageHeader from '../components/PageHeader';
import { GUIDES } from '../lib/guides';

const SRC = { url: 'Website', zip: 'ZIP', html: 'HTML' };

export default function Guides() {
  const { platform } = useParams();
  const nav = useNavigate();
  const g = GUIDES.find((x) => x.id === platform);

  if (platform && g) {
    return (
      <>
        <PageHeader eyebrow={`Panduan · ${SRC[g.source]}`} title={`${g.name} ke aplikasi`} subtitle={g.intro} maxWidth="md">
          <Breadcrumbs sx={{ fontSize: 13 }}>
            <Link component={RouterLink} to="/guides">Semua panduan</Link>
            <Typography variant="body2" color="text.secondary">{g.name}</Typography>
          </Breadcrumbs>
        </PageHeader>
        <Container maxWidth="md" sx={{ py: { xs: 5, md: 7 } }}>
          <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0, counterReset: 'step' }}>
            {g.steps.map((s, i) => (
              <Box component="li" key={s} sx={{ display: 'grid', gridTemplateColumns: '44px 1fr', py: 2, borderTop: 1, borderColor: 'divider' }}>
                <Typography sx={{ fontFamily: MONO, fontSize: 12, color: 'primary.main', pt: 0.3 }}>{String(i + 1).padStart(2, '0')}</Typography>
                <Typography>{s}</Typography>
              </Box>
            ))}
          </Box>
          <Stack direction="row" spacing={1.5} sx={{ mt: 4 }}>
            <Button variant="contained" size="large" onClick={() => nav(`/create?type=${g.source}`)}>Buat aplikasi {g.name}</Button>
            <Button variant="outlined" size="large" component={RouterLink} to="/docs#publish">Panduan publikasi</Button>
          </Stack>
        </Container>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Panduan" title="Panduan per platform" subtitle="Langkah khusus untuk WordPress, Shopify, Wix, Webflow, Lovable, Bolt, v0, Replit, dan lainnya." />
      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 } }}>
        <CellGrid items={GUIDES.map((x) => ({ to: `/guides/${x.id}`, title: x.name, desc: x.intro, meta: SRC[x.source] }))} />
      </Container>
    </>
  );
}
