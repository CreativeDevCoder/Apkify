import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack, Alert, Typography, FormControlLabel, Checkbox, LinearProgress, Divider
} from '@mui/material';
import { api, apiUrl } from '../lib/api';
import { auth } from '../firebase';
import FileDrop from './FileDrop';

/** Remote Update: pesan, paksa update, dan update konten OTA */
export function RemoteDialog({ app, onClose }) {
  const [r, setR] = useState(null);
  const [msg, setMsg] = useState(null);
  const [zip, setZip] = useState(null);
  const [up, setUp] = useState(0);
  const local = app && app.config?.source?.type !== 'url';
  const enabled = app?.config?.features?.remoteUpdate;

  useEffect(() => {
    if (!app) return;
    setR(null); setMsg(null); setZip(null);
    api.get(`/api/apps/${app.id}/remote`).then((d) => setR({ message: d.message || '', minVersionCode: d.minVersionCode || 0, updateUrl: d.updateUrl || '', bundleVersion: d.bundleVersion || 0 }))
      .catch((e) => setMsg({ type: 'error', text: e.message }));
  }, [app]);

  async function save() {
    try { await api.put(`/api/apps/${app.id}/remote`, r); setMsg({ type: 'success', text: 'Tersimpan. Pengguna menerima perubahan saat membuka aplikasi (≤ 1 menit).' }); } catch (e) { setMsg({ type: 'error', text: e.message }); }
  }
  async function pushBundle() {
    try {
      const d = await api.upload(`/api/apps/${app.id}/bundle`, zip, { kind: 'bundle', onProgress: setUp });
      setR((x) => ({ ...x, bundleVersion: d.bundleVersion }));
      setZip(null);
      setMsg({ type: 'success', text: `Konten v${d.bundleVersion} terkirim. Aplikasi mengunduhnya otomatis saat dibuka.` });
    } catch (e) { setMsg({ type: 'error', text: e.message }); } finally { setUp(0); }
  }

  return (
    <Dialog open={!!app} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Remote Update — {app?.name}</DialogTitle>
      <DialogContent>
        {!enabled && <Alert severity="warning" sx={{ mb: 2 }}>Aktifkan “Remote Update” di pengaturan Developer lalu build ulang sekali agar aplikasi bisa menerima perubahan ini.</Alert>}
        {r && <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Pesan untuk pengguna (tampil sekali)" multiline minRows={2} value={r.message} onChange={(e) => setR({ ...r, message: e.target.value })} inputProps={{ maxLength: 500 }} />
          <TextField label="Versi minimum (versionCode)" type="number" value={r.minVersionCode} onChange={(e) => setR({ ...r, minVersionCode: e.target.value })}
            helperText={`Aplikasi dengan kode versi di bawah ini wajib update. Versi terbaru Anda: ${app.versionCode}`} />
          <TextField label="URL update (opsional)" value={r.updateUrl} onChange={(e) => setR({ ...r, updateUrl: e.target.value })} helperText="Kosong = halaman Play Store aplikasi" />
          <Button variant="contained" onClick={save}>Simpan</Button>
          {local && <>
            <Divider />
            <Typography fontWeight={700}>Update konten OTA (tanpa build ulang)</Typography>
            <Typography variant="body2" color="text.secondary">Unggah ZIP baru (index.html di root). Versi konten saat ini: {r.bundleVersion || 'bawaan APK'}. Catatan: konten OTA disimpan tanpa enkripsi di HP.</Typography>
            <FileDrop accept=".zip" file={zip} onFile={setZip} />
            {up > 0 && <LinearProgress variant="determinate" value={up} />}
            <Button variant="outlined" disabled={!zip || up > 0} onClick={pushBundle}>Kirim update konten</Button>
          </>}
        </Stack>}
        {msg && <Alert severity={msg.type} sx={{ mt: 2 }}>{msg.text}</Alert>}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Tutup</Button></DialogActions>
    </Dialog>
  );
}

/** Keystore & Signing: unduh cadangan atau unggah keystore sendiri */
export function KeystoreDialog({ app, onClose, isAnon }) {
  const [file, setFile] = useState(null);
  const [f, setF] = useState({ storePass: '', keyPass: '', alias: '', replace: false });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setFile(null); setMsg(null); setF({ storePass: '', keyPass: '', alias: '', replace: false }); }, [app]);

  async function download() {
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(apiUrl(`/api/apps/${app.id}/keystore`), { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json()).error || 'Gagal');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(await res.blob());
      a.download = `${app.packageName}-keystore.zip`;
      a.click();
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  }

  async function upload() {
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('packageName', app.packageName);
      fd.append('storePass', f.storePass); fd.append('keyPass', f.keyPass || f.storePass); fd.append('alias', f.alias);
      fd.append('replace', String(f.replace));
      const r = await api.post('/api/keystores', fd);
      setMsg({ type: 'success', text: r.note });
    } catch (e) { setMsg({ type: 'error', text: e.message }); } finally { setBusy(false); }
  }

  return (
    <Dialog open={!!app} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Keystore & Signing — {app?.packageName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Button variant="outlined" onClick={download}>Unduh cadangan keystore saat ini</Button>
          <Divider>atau pakai keystore sendiri</Divider>
          {isAnon ? <Alert severity="info">Daftar akun untuk mengunggah keystore sendiri.</Alert> : <>
            <Typography variant="body2" color="text.secondary">Untuk aplikasi yang sudah terbit dengan kunci lain (mis. dari Android Studio). File .jks / .keystore / .p12, disimpan terenkripsi AES-256-GCM.</Typography>
            <FileDrop accept=".jks,.keystore,.p12,.pfx" file={file} onFile={setFile} />
            <TextField label="Alias kunci" value={f.alias} onChange={(e) => setF({ ...f, alias: e.target.value })} />
            <TextField label="Password keystore" type="password" value={f.storePass} onChange={(e) => setF({ ...f, storePass: e.target.value })} />
            <TextField label="Password kunci (kosong = sama)" type="password" value={f.keyPass} onChange={(e) => setF({ ...f, keyPass: e.target.value })} />
            <FormControlLabel control={<Checkbox checked={f.replace} onChange={(e) => setF({ ...f, replace: e.target.checked })} />}
              label="Ganti keystore yang sudah ada (aplikasi terbit dengan kunci lama tidak bisa di-update tanpa reset upload key)" />
            <Button variant="contained" disabled={!file || !f.alias || !f.storePass || busy} onClick={upload}>Unggah keystore</Button>
          </>}
          {msg && <Alert severity={msg.type}>{msg.text}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Tutup</Button></DialogActions>
    </Dialog>
  );
}
