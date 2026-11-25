import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Button, Typography, Stack, Box, Dialog, DialogTitle, DialogContent } from '@mui/material';
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
      <PageHeader eyebrow="Template" title="Mulai dari yang sudah jadi." subtitle="Pilih template, sesuaikan, lalu build. Template HTML berjalan sepenuhnya offline." />
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Stack direction="row" role="tablist" aria-label="Kategori" sx={{ mb: 3, flexWrap: 'wrap', gap: 0.75 }}>
          {cats.map((c) => (
            <Button key={c} role="tab" aria-selected={c === cat} size="small" onClick={() => setCat(c)} variant={c === cat ? 'contained' : 'outlined'}
              color={c === cat ? 'secondary' : 'primary'} sx={{ borderRadius: 5 }}>{c}</Button>
          ))}
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, borderTop: 1, borderLeft: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper' }}>
          {list.map((t) => (
            <Box key={t.id} sx={{ p: 2.5, borderRight: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: t.color }} aria-hidden />
                <Typography variant="overline" color="text.secondary">{t.category} · {t.source === 'html' ? 'offline' : 'website'}</Typography>
              </Stack>
              <Typography variant="h6" component="h3">{t.name}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{t.desc}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" variant="contained" onClick={() => nav(`/create?template=${t.id}`)}>Pakai</Button>
                {t.html && <Button size="small" variant="outlined" onClick={() => setPreview(t)}>Pratinjau</Button>}
              </Stack>
            </Box>
          ))}
        </Box>
      </Container>
      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{preview?.name}</DialogTitle>
        <DialogContent sx={{ pb: 3 }}>
          {preview && <Box component="iframe" title={`Pratinjau ${preview.name}`} sandbox="allow-scripts" srcDoc={previewDoc(preview.html)}
            sx={{ width: '100%', height: 560, border: 1, borderColor: 'divider', borderRadius: 2, display: 'block' }} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
