import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Grid, Card, CardContent, CardActions, Button, Typography, Chip, Stack, Box, Dialog, DialogTitle, DialogContent } from '@mui/material';
import PageHeader from '../components/PageHeader';
import { TEMPLATES } from '../lib/templates';
import { previewDoc } from '../lib/preview';

export default function Templates() {
  const nav = useNavigate();
  const [cat, setCat] = useState('Semua');
  const [preview, setPreview] = useState(null);
  const cats = ['Semua', ...new Set(TEMPLATES.map((t) => t.category))];
  const list = useMemo(() => TEMPLATES.filter((t) => cat === 'Semua' || t.category === cat), [cat]);

  return (
    <>
      <PageHeader title="Template aplikasi" subtitle="Mulai dari template, sesuaikan, lalu build. Template HTML berjalan 100% offline." />
      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
          {cats.map((c) => <Chip key={c} label={c} color={c === cat ? 'primary' : 'default'} onClick={() => setCat(c)} />)}
        </Stack>
        <Grid container spacing={2}>
          {list.map((t) => (
            <Grid item xs={12} sm={6} md={4} key={t.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ height: 8, bgcolor: t.color }} />
                <CardContent sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                    <Chip size="small" label={t.category} />
                    <Chip size="small" variant="outlined" label={t.source === 'html' ? 'Offline (HTML)' : 'Untuk website'} />
                  </Stack>
                  <Typography variant="h6">{t.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{t.desc}</Typography>
                </CardContent>
                <CardActions>
                  <Button variant="contained" onClick={() => nav(`/create?template=${t.id}`)}>Pakai template</Button>
                  {t.html && <Button onClick={() => setPreview(t)}>Pratinjau</Button>}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{preview?.name}</DialogTitle>
        <DialogContent>
          {preview && <Box component="iframe" title="pratinjau" sandbox="allow-scripts" srcDoc={previewDoc(preview.html)}
            sx={{ width: '100%', height: 560, border: 1, borderColor: 'divider', borderRadius: 3 }} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
