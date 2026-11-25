import { useEffect, useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container, Typography, Card, CardContent, TextField, Button, Stack, Chip, Alert, Grid, Box, Tabs, Tab, LinearProgress, FormControlLabel, Checkbox
} from '@mui/material';
import { ToolHeader } from '../components/ui';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import DownloadIcon from '@mui/icons-material/Download';
import PublicIcon from '@mui/icons-material/Public';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { downloadBlob } from '../lib/canvas';
import { previewDoc } from '../lib/preview';

const EXAMPLES = [
  'Aplikasi kasir sederhana untuk warung kopi: daftar menu, keranjang, total, dan riwayat transaksi harian',
  'Pencatat keuangan pribadi: pemasukan & pengeluaran per kategori dengan ringkasan bulanan',
  'Daftar tugas (to-do) dengan prioritas, tenggat, dan filter selesai/belum',
  'Kuis tebak ibu kota provinsi Indonesia dengan skor dan timer',
  'Kalkulator zakat penghasilan dan zakat mal',
  'Absensi kelas: daftar siswa, centang hadir/izin/sakit, rekap per tanggal'
];
const KEY = 'apkify:ai:last';

export default function AiStudio() {
  const { user, isAnon } = useAuth();
  const nav = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [html, setHtml] = useState(() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}').html || ''; } catch { return ''; } });
  const [title, setTitle] = useState('');
  const [tab, setTab] = useState('preview');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [credits, setCredits] = useState(null);
  const [supabase, setSupabase] = useState(false);

  const canUse = user && !isAnon;
  useEffect(() => {
    if (canUse) api.get('/api/ai/quota').then(setCredits).catch(() => {});
  }, [canUse]);

  async function generate(refine) {
    setErr('');
    setBusy(true);
    try {
      const r = await api.post('/api/ai/generate', { prompt, html: refine ? html : undefined, supabase });
      setHtml(r.html);
      if (r.title) setTitle(r.title);
      setCredits((c) => ({ ...(c || {}), remaining: r.remaining }));
      try { localStorage.setItem(KEY, JSON.stringify({ html: r.html })); } catch { /* */ }
      setTab('preview');
      if (refine) setPrompt('');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  function toApp() {
    sessionStorage.setItem('apkify:ai', JSON.stringify({ html, appName: title || 'Aplikasi AI', source: 'html' }));
    nav('/create?from=ai');
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
      <ToolHeader title="AI Studio" crumb={null}>Jelaskan aplikasi yang Anda inginkan. AI menulis kode HTML-nya, Anda pratinjau dan perbaiki, lalu jadikan aplikasi yang berjalan offline.</ToolHeader>

      {!canUse && (
        <Alert severity="info" sx={{ mb: 2 }} action={<Button color="inherit" component={RouterLink} to="/register?next=/ai-studio">Daftar</Button>}>
          AI Studio membutuhkan akun gratis. Setiap akun mendapat kredit AI harian.
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Card><CardContent>
            <Stack spacing={2}>
              <TextField multiline minRows={5} label={html ? 'Minta perubahan (mis. “ganti warna jadi hijau, tambah tombol hapus semua”)' : 'Deskripsikan aplikasi Anda'}
                value={prompt} onChange={(e) => setPrompt(e.target.value)} inputProps={{ maxLength: 2000 }} disabled={!canUse} />
              {!html && (
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {EXAMPLES.map((e) => <Chip key={e} label={e.split(':')[0]} onClick={() => setPrompt(e)} variant="outlined" disabled={!canUse} />)}
                </Stack>
              )}
              <FormControlLabel disabled={!canUse} control={<Checkbox checked={supabase} onChange={(e) => setSupabase(e.target.checked)} />}
                label="Pakai backend Supabase (login & database)" />
              {busy && <Box><LinearProgress /><Typography variant="caption" color="text.secondary">AI sedang menulis kode… biasanya 20–60 detik.</Typography></Box>}
              {err && <Alert severity="error">{err}</Alert>}
              <Stack direction="row" spacing={1}>
                <Button variant="contained" startIcon={<AutoAwesomeIcon />} disabled={!canUse || busy || prompt.trim().length < 8} onClick={() => generate(false)}>
                  {html ? 'Buat ulang dari awal' : 'Buat dengan AI'}
                </Button>
                {html && <Button variant="outlined" disabled={!canUse || busy || prompt.trim().length < 8} onClick={() => generate(true)}>Perbaiki</Button>}
              </Stack>
              {credits && <Typography variant="body2" color="text.secondary">Sisa kredit AI hari ini: <b>{credits.remaining}</b>{credits.limit ? ` / ${credits.limit}` : ''}</Typography>}
              <Typography variant="caption" color="text.secondary">Hasil AI bisa keliru. Periksa aplikasi sebelum dipublikasikan.</Typography>
            </Stack>
          </CardContent></Card>
          {html && (
            <Stack spacing={1} sx={{ mt: 2 }}>
              <TextField label="Nama aplikasi" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 30))} />
              <Button size="large" variant="contained" color="secondary" startIcon={<RocketLaunchIcon />} onClick={toApp}>Jadikan aplikasi Android</Button>
              <Button variant="outlined" startIcon={<PublicIcon />} onClick={() => {
                sessionStorage.setItem('apkify:ai', JSON.stringify({ html, appName: title || 'Aplikasi AI', source: 'html' }));
                nav(`/hosting?from=ai&name=${encodeURIComponent((title || 'aplikasi-ai').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32))}`);
              }}>Terbitkan ke subdomain</Button>
              <Button startIcon={<DownloadIcon />} onClick={() => downloadBlob(new Blob([html], { type: 'text/html' }), 'index.html')}>Unduh HTML</Button>
            </Stack>
          )}
        </Grid>
        <Grid item xs={12} md={7}>
          <Card>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}><Tab value="preview" label="Pratinjau" /><Tab value="code" label="Kode" /></Tabs>
            <CardContent>
              {!html ? (
                <Box sx={{ height: 560, display: 'grid', placeItems: 'center', color: 'text.secondary', textAlign: 'center' }}>Pratinjau aplikasi muncul di sini.</Box>
              ) : tab === 'preview' ? (
                <Box sx={{ mx: 'auto', width: 340, height: 640, border: '10px solid #111', borderRadius: 6, overflow: 'hidden' }}>
                  <Box component="iframe" title="pratinjau" sandbox="allow-scripts allow-forms allow-modals" srcDoc={previewDoc(html)} sx={{ width: '100%', height: '100%', border: 0, bgcolor: '#fff' }} />
                </Box>
              ) : (
                <TextField multiline minRows={20} maxRows={30} value={html} onChange={(e) => setHtml(e.target.value)}
                  InputProps={{ sx: { fontFamily: 'monospace', fontSize: 12 } }} helperText="Anda bisa mengedit kode secara manual." />
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
