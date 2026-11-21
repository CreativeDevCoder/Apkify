import { useState } from 'react';
import { Container, Card, CardContent, TextField, Button, Stack, Alert, MenuItem } from '@mui/material';
import PageHeader from '../components/PageHeader';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Contact() {
  const { user } = useAuth();
  const [f, setF] = useState({ name: user?.displayName || '', email: user?.email || '', topic: 'Pertanyaan', message: '', website: '' });
  const [st, setSt] = useState({});

  const send = async (e) => {
    e.preventDefault();
    setSt({ busy: true });
    try {
      await api.post('/api/public/contact', f, { auth: false });
      setSt({ ok: true });
      setF((x) => ({ ...x, message: '' }));
    } catch (err) {
      setSt({ err: err.message });
    }
  };

  return (
    <>
      <PageHeader title="Hubungi kami" subtitle="Pertanyaan, laporan bug, kerja sama, atau laporan listing marketplace." />
      <Container maxWidth="sm" sx={{ py: 5 }}>
        <Card><CardContent>
          <Stack component="form" spacing={2} onSubmit={send}>
            <TextField label="Nama" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <TextField label="Email" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <TextField select label="Topik" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })}>
              {['Pertanyaan', 'Laporan bug', 'Kerja sama', 'Laporan marketplace', 'Lainnya'].map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField label="Pesan" required multiline minRows={5} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} inputProps={{ maxLength: 3000 }} />
            {/* honeypot anti-bot: disembunyikan dari manusia */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} style={{ position: 'absolute', left: -9999 }} aria-hidden="true" />
            {st.ok && <Alert severity="success">Pesan terkirim. Kami akan membalas ke email Anda.</Alert>}
            {st.err && <Alert severity="error">{st.err}</Alert>}
            <Button type="submit" variant="contained" size="large" disabled={st.busy}>Kirim</Button>
          </Stack>
        </CardContent></Card>
      </Container>
    </>
  );
}
