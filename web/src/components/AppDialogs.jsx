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

/** Analitik: instalasi & pengguna aktif harian (30 hari) */
export function AnalyticsDialog({ app, onClose }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!app) return;
    setD(null); setErr('');
    api.get(`/api/apps/${app.id}/analytics`).then(setD).catch((e) => setErr(e.message));
  }, [app]);
  const max = Math.max(1, ...(d?.days || []).map((x) => x.active));
  const total = (d?.days || []).reduce((s, x) => s + x.active, 0);
  return (
    <Dialog open={!!app} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Analitik — {app?.name}</DialogTitle>
      <DialogContent>
        {!app?.config?.features?.analytics && <Alert severity="info" sx={{ mb: 2 }}>Aktifkan “Analitik pengguna aktif” di Plugin native lalu build ulang.</Alert>}
        {err && <Alert severity="error">{err}</Alert>}
        {d && <>
          <Stack direction="row" spacing={4} sx={{ mb: 2 }}>
            <div><Typography variant="h4" fontWeight={800}>{d.installs.toLocaleString('id-ID')}</Typography><Typography variant="caption">instalasi (perangkat baru)</Typography></div>
            <div><Typography variant="h4" fontWeight={800}>{total.toLocaleString('id-ID')}</Typography><Typography variant="caption">pengguna aktif · 30 hari (jumlah harian)</Typography></div>
          </Stack>
          <Stack direction="row" alignItems="flex-end" spacing={0.5} sx={{ height: 140 }}>
            {d.days.map((x) => (
              <div key={x.day} title={`${x.day.slice(6)}/${x.day.slice(4, 6)}: ${x.active}`} style={{ flex: 1, height: `${Math.max(2, (x.active / max) * 100)}%`, background: '#4f46e5', borderRadius: 3, opacity: x.active ? 1 : 0.2 }} />
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary">Pengguna aktif harian (1 perangkat dihitung sekali per hari). Data anonim, tanpa identitas pengguna.</Typography>
        </>}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Tutup</Button></DialogActions>
    </Dialog>
  );
}

/** Android App Links: file assetlinks.json untuk verifikasi domain */
export function AppLinksDialog({ app, onClose }) {
  const host = (() => { try { return new URL(app?.config?.source?.url).host; } catch { return 'domainanda.com'; } })();
  const json = app?.signingSha256 ? JSON.stringify([{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: app.packageName, sha256_cert_fingerprints: [app.signingSha256] } }], null, 2) : '';
  return (
    <Dialog open={!!app} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>App Links & sidik jari — {app?.name}</DialogTitle>
      <DialogContent>
        {!app?.signingSha256 ? <Alert severity="info">Sidik jari tersedia setelah build Android berikutnya selesai.</Alert> : <Stack spacing={2}>
          <Typography variant="body2">SHA-256 upload key: <code style={{ wordBreak: 'break-all' }}>{app.signingSha256}</code></Typography>
          <Typography variant="body2">Simpan sebagai <code>https://{host}/.well-known/assetlinks.json</code> agar link ke situs Anda langsung terbuka di aplikasi (aktifkan juga “Deep linking”). Bila memakai Play App Signing, tambahkan juga SHA-256 “App signing key” dari Play Console ke array.</Typography>
          <TextField multiline value={json} InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 12 } }} />
          <Button onClick={() => navigator.clipboard?.writeText(json)}>Salin</Button>
        </Stack>}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Tutup</Button></DialogActions>
    </Dialog>
  );
}

/** Sertifikat iOS: .p12 + provisioning profile untuk IPA bertanda tangan */
export function IosSigningDialog({ app, onClose }) {
  const [st, setSt] = useState(null);
  const [p12, setP12] = useState(null);
  const [profile, setProfile] = useState(null);
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (!app) return;
    setP12(null); setProfile(null); setPass(''); setMsg(null);
    api.get(`/api/apps/${app.id}/ios-signing`).then(setSt).catch(() => setSt({ configured: false }));
  }, [app]);
  async function save() {
    try {
      const fd = new FormData();
      fd.append('p12', p12); fd.append('profile', profile); fd.append('password', pass);
      const r = await api.post(`/api/apps/${app.id}/ios-signing`, fd);
      setSt({ configured: true, teamId: r.teamId });
      setMsg({ type: 'success', text: `Tersimpan (Team ${r.teamId}, metode ${r.method}). Build iOS berikutnya menghasilkan IPA bertanda tangan.` });
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  }
  return (
    <Dialog open={!!app} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Sertifikat iOS — {app?.packageName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {st?.configured ? <Alert severity="success" action={<Button color="inherit" onClick={async () => { await api.del(`/api/apps/${app.id}/ios-signing`); setSt({ configured: false }); }}>Hapus</Button>}>Sertifikat aktif (Team {st.teamId}).</Alert>
            : <Alert severity="info">Butuh Apple Developer Program. Buat sertifikat “Apple Distribution” (ekspor .p12 dari Keychain) dan provisioning profile App Store/Ad Hoc untuk bundle ID <b>{app?.packageName}</b>.</Alert>}
          <FileDrop accept=".p12,.pfx" file={p12} onFile={setP12} label="Sertifikat .p12" />
          <TextField type="password" label="Password .p12" value={pass} onChange={(e) => setPass(e.target.value)} />
          <FileDrop accept=".mobileprovision" file={profile} onFile={setProfile} label="Provisioning profile (.mobileprovision)" />
          <Button variant="contained" disabled={!p12 || !profile} onClick={save}>Simpan terenkripsi</Button>
          {msg && <Alert severity={msg.type}>{msg.text}</Alert>}
          <Typography variant="caption" color="text.secondary">Unggah IPA ke App Store Connect lewat aplikasi Transporter (Mac) atau proyek Xcode yang ikut diunduh.</Typography>
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Tutup</Button></DialogActions>
    </Dialog>
  );
}
