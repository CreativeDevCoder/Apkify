import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { Container, Card, CardContent, Typography, TextField, Button, Stack, Divider, Alert, Link } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import GitHubIcon from '@mui/icons-material/GitHub';
import { useAuth, authError } from '../context/AuthContext';

export default function Login({ mode: initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // login | register | reset
  const { user, loginEmail, register, loginGoogle, loginGithub, resetPassword } = useAuth();
  const [qs] = useSearchParams();
  const nav = useNavigate();
  const next = qs.get('next') || '/dashboard';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => { setMode(initialMode); }, [initialMode]);
  useEffect(() => { if (user) nav(next, { replace: true }); }, [user, next, nav]);

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

  const titles = { login: 'Masuk', register: 'Daftar akun gratis', reset: 'Lupa kata sandi' };

  return (
    <Container maxWidth="xs" sx={{ py: 6 }}>
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom>{titles[mode]}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Akun dipakai untuk menyimpan aplikasi, riwayat build, dan kunci tanda tangan Anda.</Typography>
          {mode !== 'reset' && (
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              <Button variant="outlined" startIcon={<GoogleIcon />} disabled={busy} onClick={() => run(loginGoogle)}>Lanjut dengan Google</Button>
              <Button variant="outlined" startIcon={<GitHubIcon />} disabled={busy} onClick={() => run(loginGithub)}>Lanjut dengan GitHub</Button>
              <Divider>atau email</Divider>
            </Stack>
          )}
          <Stack component="form" spacing={2} onSubmit={submit}>
            {mode === 'register' && <TextField label="Nama" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
            <TextField label="Email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {mode !== 'reset' && (
              <TextField label="Kata sandi" type="password" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                inputProps={{ minLength: 6 }} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            )}
            {msg.text && <Alert severity={msg.type || 'info'}>{msg.text}</Alert>}
            <Button type="submit" variant="contained" size="large" disabled={busy}>
              {mode === 'login' ? 'Masuk' : mode === 'register' ? 'Daftar' : 'Kirim tautan reset'}
            </Button>
          </Stack>
          <Stack sx={{ mt: 2 }} spacing={0.5}>
            {mode === 'login' && <>
              <Link component="button" onClick={() => setMode('reset')}>Lupa kata sandi?</Link>
              <Typography variant="body2">Belum punya akun? <Link component={RouterLink} to={`/register?next=${encodeURIComponent(next)}`}>Daftar</Link></Typography>
            </>}
            {mode !== 'login' && <Typography variant="body2">Sudah punya akun? <Link component={RouterLink} to={`/login?next=${encodeURIComponent(next)}`} onClick={() => setMode('login')}>Masuk</Link></Typography>}
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
