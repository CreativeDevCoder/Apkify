import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { Box, Typography, TextField, Button, Stack, Divider, Alert, Link } from '@mui/material';
import { MONO } from '../theme';
import GoogleIcon from '@mui/icons-material/Google';
import GitHubIcon from '@mui/icons-material/GitHub';
import { useAuth, authError } from '../context/AuthContext';

export default function Login({ mode: initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // login | register | reset
  const { user, isAnon, loginEmail, register, loginGoogle, loginGithub, resetPassword } = useAuth();
  const [qs] = useSearchParams();
  const nav = useNavigate();
  const next = qs.get('next') || '/dashboard';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => { setMode(initialMode); }, [initialMode]);
  useEffect(() => { if (user && !user.isAnonymous) nav(next, { replace: true }); }, [user, next, nav]);

  const run = async (fn) => {
    setBusy(true);
    setMsg({});
    try { await fn(); } catch (e) { setMsg({ type: 'error', text: authError(e) }); } finally { setBusy(false); }
  };

  const submit = (e) => {
    e.preventDefault();
    if (mode === 'login') run(() => loginEmail(form.email, form.password));
    else if (mode === 'register') run(() => register(form.name, form.email, form.password));
    else run(async () => {
      await resetPassword(form.email);
      setMsg({ type: 'success', text: 'Tautan reset kata sandi sudah dikirim ke email Anda.' });
    });
  };

  const titles = { login: 'Masuk', register: 'Buat akun', reset: 'Atur ulang kata sandi' };

  const subtitles = {
    login: 'Lanjutkan ke Studio untuk mengelola aplikasi dan build Anda.',
    register: 'Gratis. Aplikasi, riwayat build, dan kunci tanda tangan tersimpan permanen.',
    reset: 'Masukkan email akun Anda. Kami kirimkan tautan untuk membuat kata sandi baru.'
  };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, minHeight: { md: 'calc(100vh - 57px)' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2.5, py: { xs: 6, md: 8 } }}>
        <Box sx={{ width: '100%', maxWidth: 360 }}>
          <Typography variant="h3" component="h1">{titles[mode]}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 4 }}>{subtitles[mode]}</Typography>
          {isAnon && <Alert severity="info" sx={{ mb: 3 }}>Anda sedang memakai mode tamu. Daftar agar aplikasi yang sudah dibuat tersimpan permanen.</Alert>}
          {mode !== 'reset' && (
            <Stack spacing={1} sx={{ mb: 3 }}>
              <Button variant="outlined" size="large" startIcon={<GoogleIcon />} disabled={busy} onClick={() => run(loginGoogle)}>Lanjut dengan Google</Button>
              <Button variant="outlined" size="large" startIcon={<GitHubIcon />} disabled={busy} onClick={() => run(loginGithub)}>Lanjut dengan GitHub</Button>
              <Divider sx={{ pt: 2, '&::before, &::after': { borderColor: 'divider' } }}><Typography variant="caption">atau dengan email</Typography></Divider>
            </Stack>
          )}
          <Stack component="form" spacing={2} onSubmit={submit} noValidate={false}>
            {mode === 'register' && <TextField label="Nama" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
            <TextField label="Email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {mode !== 'reset' && (
              <TextField label="Kata sandi" type="password" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                helperText={mode === 'register' ? 'Minimal 6 karakter' : undefined}
                inputProps={{ minLength: 6 }} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            )}
            {mode === 'login' && (
              <Link component="button" type="button" variant="body2" onClick={() => setMode('reset')} sx={{ alignSelf: 'flex-end', mt: '-4px !important' }}>Lupa kata sandi?</Link>
            )}
            {msg.text && <Alert severity={msg.type || 'info'}>{msg.text}</Alert>}
            <Button type="submit" variant="contained" size="large" disabled={busy}>
              {busy ? 'Memproses…' : mode === 'login' ? 'Masuk' : mode === 'register' ? 'Buat akun' : 'Kirim tautan reset'}
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            {mode === 'login'
              ? <>Belum punya akun? <Link component={RouterLink} to={`/register?next=${encodeURIComponent(next)}`}>Daftar gratis</Link></>
              : <>Sudah punya akun? <Link component={RouterLink} to={`/login?next=${encodeURIComponent(next)}`} onClick={() => setMode('login')}>Masuk</Link></>}
          </Typography>
        </Box>
      </Box>
      <Box aria-hidden sx={(t) => ({
        display: { xs: 'none', md: 'flex' }, flexDirection: 'column', justifyContent: 'space-between', p: 6,
        bgcolor: t.tokens.inverse, color: t.tokens.inverseText, position: 'relative', overflow: 'hidden'
      })}>
        <Box sx={(t) => ({ position: 'absolute', inset: 0, opacity: 0.6, backgroundImage: `linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)`, backgroundSize: '48px 48px', ...(t.palette.mode === 'dark' && { backgroundImage: 'linear-gradient(rgba(0,0,0,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.06) 1px, transparent 1px)' }) })} />
        <Typography variant="overline" sx={{ opacity: 0.6, position: 'relative' }}>Yang tersimpan di akun Anda</Typography>
        <Box sx={{ position: 'relative' }}>
          {[['Keystore', 'satu kunci per package, terenkripsi'], ['Riwayat build', 'semua versi & berkas unduhan'], ['Platform', 'Android, iOS, Windows, macOS, Linux'], ['Notifikasi', 'email saat build selesai']].map(([k, v]) => (
            <Stack key={k} direction="row" spacing={2} sx={{ py: 1.75, borderTop: '1px solid', borderColor: 'rgba(127,127,127,.25)' }}>
              <Typography sx={{ fontFamily: MONO, fontSize: 12.5, width: 120, opacity: 0.6 }}>{k}</Typography>
              <Typography sx={{ fontSize: 14 }}>{v}</Typography>
            </Stack>
          ))}
        </Box>
        <Typography variant="h3" sx={{ color: 'inherit', position: 'relative', maxWidth: 440 }}>Satu akun, semua aplikasi Anda — di satu tempat.</Typography>
      </Box>
    </Box>
  );
}
