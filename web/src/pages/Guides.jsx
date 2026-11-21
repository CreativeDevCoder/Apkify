import { Link as RouterLink, useParams, useNavigate } from 'react-router-dom';
import { Container, Grid, Card, CardActionArea, CardContent, Typography, Button, Box, Chip, Stack, Breadcrumbs, Link } from '@mui/material';
import PageHeader from '../components/PageHeader';
import { GUIDES } from '../lib/guides';

const SRC = { url: 'Website', zip: 'ZIP', html: 'HTML' };

export default function Guides() {
  const { platform } = useParams();
  const nav = useNavigate();
  const g = GUIDES.find((x) => x.id === platform);

  if (platform && g) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link component={RouterLink} to="/guides">Panduan platform</Link>
          <Typography color="text.primary">{g.name}</Typography>
        </Breadcrumbs>
        <Typography variant="h4" gutterBottom>{g.name} ke aplikasi Android</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>{g.intro}</Typography>
        <Card><CardContent>
          <Box component="ol" sx={{ pl: 2.5, m: 0, '& li': { mb: 1.5 } }}>
            {g.steps.map((s) => <li key={s}><Typography>{s}</Typography></li>)}
          </Box>
        </CardContent></Card>
        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button variant="contained" onClick={() => nav(`/create?type=${g.source}`)}>Buat aplikasi {g.name}</Button>
          <Button component={RouterLink} to="/docs#publish">Panduan publikasi</Button>
        </Stack>
      </Container>
    );
  }

  return (
    <>
      <PageHeader title="Panduan per platform" subtitle="Langkah khusus untuk WordPress, Shopify, Wix, Webflow, Lovable, Bolt, v0, Replit, dan lainnya." />
      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Grid container spacing={2}>
          {GUIDES.map((x) => (
            <Grid item xs={12} sm={6} md={4} key={x.id}>
              <Card sx={{ height: '100%' }}>
                <CardActionArea component={RouterLink} to={`/guides/${x.id}`} sx={{ height: '100%' }}>
                  <CardContent>
                    <Chip size="small" label={SRC[x.source]} sx={{ mb: 1 }} />
                    <Typography variant="h6">{x.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{x.intro}</Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </>
  );
}
