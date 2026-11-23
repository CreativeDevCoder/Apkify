import { useState } from 'react';
import { Grid, Stack, TextField, MenuItem, IconButton, Button, Typography, Box, Alert, FormControlLabel, Switch, Chip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { NAV_ICON_EL, NAV_ICONS } from './icons';
import FileDrop from '../FileDrop';
import { api } from '../../lib/api';

const IconSelect = ({ value, onChange, label = 'Ikon' }) => (
  <TextField select label={label} value={value} onChange={(e) => onChange(e.target.value)} sx={{ minWidth: 110 }}>
    {NAV_ICONS.map((k) => <MenuItem key={k} value={k}><Stack direction="row" spacing={1} alignItems="center">{NAV_ICON_EL[k]}<span>{k}</span></Stack></MenuItem>)}
  </TextField>
);

/** Editor daftar baris (navigasi bawah, shortcut, aturan link) */
function Rows({ rows, max, onChange, render, empty, addLabel }) {
  return (
    <Stack spacing={1.5} sx={{ mt: 1 }}>
      {rows.map((r, i) => (
        <Stack key={i} direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
          {render(r, (patch) => onChange(rows.map((x, j) => (j === i ? { ...x, ...patch } : x))))}
          <IconButton onClick={() => onChange(rows.filter((_, j) => j !== i))}><DeleteIcon /></IconButton>
        </Stack>
      ))}
      {rows.length < max && <Button startIcon={<AddIcon />} onClick={() => onChange([...rows, { ...empty }])} sx={{ alignSelf: 'flex-start' }}>{addLabel}</Button>}
    </Stack>
  );
}

const urlHelp = 'URL lengkap atau path relatif: /keranjang, #/profil, about.html';

export function BottomNavSection({ cfg, set, Toggle }) {
  const f = cfg.features;
  return (
    <>
      <Toggle k="bottomNav" label="Navigasi bawah (tab bar)" hint="2–5 tab dengan ikon, seperti aplikasi native" />
      {f.bottomNav && (
        <Rows rows={cfg.bottomNav.items} max={5} onChange={(v) => set('bottomNav.items', v)} addLabel="Tambah tab" empty={{ label: '', icon: 'home', url: '/' }}
          render={(r, up) => <>
            <IconSelect value={r.icon} onChange={(v) => up({ icon: v })} />
            <TextField label="Label" value={r.label} onChange={(e) => up({ label: e.target.value.slice(0, 16) })} sx={{ maxWidth: { sm: 160 } }} />
            <TextField label="URL" value={r.url} onChange={(e) => up({ url: e.target.value })} helperText={urlHelp} />
          </>} />
      )}
      <Box sx={{ mt: 2 }}><Toggle k="fab" label="Tombol mengambang (FAB)" hint="Tombol bulat di pojok kanan bawah" /></Box>
      {f.fab && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
          <IconSelect value={cfg.fab.icon} onChange={(v) => set('fab.icon', v)} />
          <TextField select label="Aksi" value={cfg.fab.action} onChange={(e) => set('fab.action', e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="url">Buka URL (mis. WhatsApp)</MenuItem>
            <MenuItem value="scan">Scan QR / barcode</MenuItem>
            <MenuItem value="share">Bagikan halaman</MenuItem>
            <MenuItem value="top">Kembali ke atas</MenuItem>
          </TextField>
          {cfg.fab.action === 'url' && <TextField label="URL" value={cfg.fab.url} onChange={(e) => set('fab.url', e.target.value)} placeholder="https://wa.me/628123456789" />}
        </Stack>
      )}
    </>
  );
}

const PLUGINS = [
  ['qrScanner', 'Scanner QR & barcode', 'Apkify.scanQR() — UI native Google, tanpa izin kamera'],
  ['biometric', 'Sidik jari / Face unlock', 'Apkify.biometric("alasan")'],
  ['inAppReview', 'Ulasan dalam aplikasi', 'Apkify.requestReview() — dialog rating Google Play'],
  ['billing', 'Pembelian dalam aplikasi (Google Play Billing)', 'Apkify.iap.products/purchase/restore — untuk barang digital & langganan'],
  ['nativeStorage', 'Penyimpanan native', 'Apkify.storage.get/set — bertahan walau cache dibersihkan'],
  ['shareTarget', 'Terima bagikan dari aplikasi lain', 'Event "apkifyshare" berisi teks/link yang dibagikan'],
  ['shortcuts', 'Shortcut ikon aplikasi', 'Menu saat ikon ditekan lama'],
  ['androidTv', 'Dukungan Android TV', 'Muncul di launcher TV dengan banner'],
  ['analytics', 'Analitik pengguna aktif', 'Jumlah instalasi & pengguna aktif harian (anonim) di Studio'],
  ['fcm', 'Push Firebase Cloud Messaging', 'Apkify.getPushToken() — kirim dari Firebase Console/server Anda']
];

export function PluginsSection({ cfg, set, Toggle, onFcm }) {
  const f = cfg.features;
  const [fcmMsg, setFcmMsg] = useState(null);
  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Fitur native dipanggil dari JavaScript situs Anda lewat <code>window.Apkify</code> (cek <code>if (window.Apkify)</code> agar situs tetap jalan di browser).</Typography>
      <Grid container>
        {PLUGINS.map(([k, label, hint]) => <Grid item xs={12} sm={6} key={k}><Toggle k={k} label={label} hint={hint} /></Grid>)}
      </Grid>
      {f.billing && <Alert severity="info" sx={{ mt: 1 }}>Google Play mewajibkan Billing untuk barang/konten digital. Verifikasi token pembelian di server Anda (Google Play Developer API) sebelum memberi akses, lalu panggil <code>Apkify.iap.acknowledge(token)</code>.</Alert>}
      {f.shortcuts && (
        <Rows rows={cfg.shortcuts} max={4} onChange={(v) => set('shortcuts', v)} addLabel="Tambah shortcut" empty={{ label: '', url: '/' }}
          render={(r, up) => <>
            <TextField label="Label" value={r.label} onChange={(e) => up({ label: e.target.value.slice(0, 24) })} sx={{ maxWidth: { sm: 200 } }} />
            <TextField label="URL" value={r.url} onChange={(e) => up({ url: e.target.value })} helperText={urlHelp} />
          </>} />
      )}
      {f.fcm && (
        <Box sx={{ mt: 1 }}>
          <FileDrop accept=".json,application/json" label={cfg.fcmFileId ? 'google-services.json tersimpan — klik untuk ganti' : 'Unggah google-services.json'}
            hint="Firebase Console → Project settings → Aplikasi Android dengan package yang sama"
            onFile={async (file) => {
              setFcmMsg(null);
              try {
                const r = await api.upload('/api/uploads', file, { kind: 'fcm' });
                onFcm(r.fileId);
                const okPkg = r.packages.includes(cfg.packageName);
                setFcmMsg({ type: okPkg ? 'success' : 'warning', text: okPkg ? 'google-services.json valid.' : `File tidak memuat package ${cfg.packageName} (berisi: ${r.packages.join(', ') || '-'}).` });
              } catch (e) { setFcmMsg({ type: 'error', text: e.message }); }
            }} />
          {fcmMsg && <Alert severity={fcmMsg.type} sx={{ mt: 1 }}>{fcmMsg.text}</Alert>}
        </Box>
      )}
    </>
  );
}

export function CodeSection({ cfg, set, Toggle }) {
  const f = cfg.features;
  return (
    <>
      <Toggle k="customCode" label="CSS & JavaScript kustom" hint="Disuntikkan ke setiap halaman — mis. sembunyikan header/footer situs khusus di aplikasi" />
      {f.customCode && (
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="CSS" multiline minRows={4} value={cfg.customCss} onChange={(e) => set('customCss', e.target.value)} placeholder=".site-header, .cookie-banner { display: none !important; }" InputProps={{ sx: { fontFamily: 'monospace', fontSize: 13 } }} />
          <TextField label="JavaScript" multiline minRows={4} value={cfg.customJs} onChange={(e) => set('customJs', e.target.value)} placeholder="document.querySelectorAll('a[target=_blank]').forEach(a => a.removeAttribute('target'));" InputProps={{ sx: { fontFamily: 'monospace', fontSize: 13 } }} />
        </Stack>
      )}
      <Box sx={{ mt: 2 }}><Toggle k="linkRules" label="Aturan link (regex)" hint="Tentukan link mana dibuka di aplikasi, di browser, atau diblokir" /></Box>
      {f.linkRules && (
        <Rows rows={cfg.linkRules} max={20} onChange={(v) => set('linkRules', v)} addLabel="Tambah aturan" empty={{ pattern: '', action: 'external' }}
          render={(r, up) => <>
            <TextField label="Pola (regex)" value={r.pattern} onChange={(e) => up({ pattern: e.target.value })} placeholder="wa\.me|facebook\.com" InputProps={{ sx: { fontFamily: 'monospace' } }} />
            <TextField select label="Aksi" value={r.action} onChange={(e) => up({ action: e.target.value })} sx={{ minWidth: 170 }}>
              <MenuItem value="internal">Buka di aplikasi</MenuItem><MenuItem value="external">Buka di browser/aplikasi lain</MenuItem><MenuItem value="block">Blokir</MenuItem>
            </TextField>
          </>} />
      )}
    </>
  );
}

export function DesktopSection({ cfg, set }) {
  const d = cfg.desktop;
  const sw = (k, label) => <FormControlLabel control={<Switch checked={!!d[k]} onChange={(e) => set(`desktop.${k}`, e.target.checked)} />} label={label} />;
  return (
    <>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>{['windows', 'macos', 'linux'].filter((k) => cfg.platforms[k]).map((k) => <Chip key={k} size="small" label={k} />)}</Stack>
      <Grid container spacing={2}>
        <Grid item xs={6}><TextField type="number" label="Lebar jendela (px)" value={d.width} onChange={(e) => set('desktop.width', Number(e.target.value))} /></Grid>
        <Grid item xs={6}><TextField type="number" label="Tinggi jendela (px)" value={d.height} onChange={(e) => set('desktop.height', Number(e.target.value))} /></Grid>
      </Grid>
      <Grid container sx={{ mt: 1 }}>
        <Grid item xs={6}>{sw('resizable', 'Bisa diubah ukuran')}</Grid>
        <Grid item xs={6}>{sw('maximized', 'Mulai maksimal')}</Grid>
        <Grid item xs={6}>{sw('fullscreen', 'Layar penuh (kiosk)')}</Grid>
        <Grid item xs={6}>{sw('alwaysOnTop', 'Selalu di atas')}</Grid>
      </Grid>
      <Typography variant="caption" color="text.secondary">Dibangun dengan Tauri: ukuran installer kecil (± 3–10 MB), memakai WebView bawaan sistem.</Typography>
    </>
  );
}
