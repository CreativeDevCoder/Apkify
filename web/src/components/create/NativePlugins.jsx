import { useState } from 'react';
import {
  Grid, Stack, TextField, MenuItem, Typography, Box, Alert, Chip, FormControlLabel, Switch, Checkbox, Slider, Link, Divider, Avatar
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import FileDrop from '../FileDrop';
import { api, fileUrl } from '../../lib/api';
import { NAV_ICONS } from './icons';
import { MONO } from '../../theme';

// [kunci, label, contoh API JS / penjelasan, catatan izin]
export const NATIVE_GROUPS = [
  ['Hardware & sensor', [
    ['nfc', 'NFC baca/tulis', 'Apkify.nfc.read() · write({records}) · watch() — kartu NFC, tag NDEF, UID'],
    ['nfcHce', 'Emulasi kartu NFC (HCE)', 'Apkify.nfc.emulate({records}) — HP berperilaku seperti kartu/tag NFC'],
    ['bluetooth', 'Bluetooth & BLE (printer thermal)', 'Apkify.bt.print({address, base64}) · Apkify.ble.scan/connect/read/write/notify · Apkify.escpos()'],
    ['usb', 'USB OTG (printer USB, serial)', 'Apkify.usb.list() · write({deviceName, base64}) · open({baudRate})'],
    ['sensors', 'Sensor perangkat', 'Apkify.sensor.start({type:"accelerometer"|"gyroscope"|"compass"|"light"|"proximity"|"pressure"|"stepCounter"}) + event "sensor"'],
    ['infrared', 'IR blaster (remote TV/AC)', 'Apkify.ir.transmit({frequency, pattern})']
  ]],
  ['Kamera & pemindai', [
    ['nativeCamera', 'Kamera native (foto & video)', 'Apkify.camera.photo({maxWidth, quality}) · video({maxSeconds})'],
    ['docScanner', 'Pemindai dokumen (auto-crop, PDF)', 'Apkify.docscan.start({pages}) — ML Kit, multi-halaman + PDF'],
    ['ocr', 'OCR teks (KTP, struk, nota)', 'Apkify.ocr.recognize({url}) — offline, ML Kit'],
    ['faceDetection', 'Deteksi wajah', 'Apkify.face.detect({url}) — jumlah wajah, senyum, mata terbuka'],
    ['qrGenerate', 'Buat gambar QR / barcode', 'Apkify.barcode.generate({text, format, size}) → dataUrl PNG']
  ]],
  ['Lokasi', [
    ['locationApi', 'Lokasi presisi + deteksi Fake GPS', 'Apkify.location.current() · watch() — {lat, lng, accuracy, mock}'],
    ['geofence', 'Geofence absensi', 'Apkify.geofence.check({fences:[{id,lat,lng,radius}]}) — di dalam area kantor?'],
    ['activityRecognition', 'Pengenalan aktivitas', 'Apkify.activity.start() — diam/jalan/lari/sepeda/kendaraan']
  ]],
  ['Notifikasi & latar belakang', [
    ['localNotifications', 'Notifikasi lokal & terjadwal', 'Apkify.notify.schedule({title, body, at, every:"day"}) · badge.set(3)'],
    ['backgroundSync', 'Sinkronisasi latar (WorkManager)', 'Apkify.sync.register({url, minutes:60}) — cek URL Anda berkala & tampilkan notifikasi'],
    ['autoStart', 'Mulai otomatis saat HP menyala', 'Untuk perangkat kiosk/kasir (Android 10+ butuh mode kiosk/launcher)']
  ]],
  ['Media', [
    ['backgroundAudio', 'Audio latar + kontrol layar kunci', 'Apkify.media.start({title, artist, artwork}) + event "media" (play/pause/next) — radio, podcast, murottal'],
    ['pip', 'Picture-in-Picture', 'Apkify.pip.enter() · pip.auto({enable:true}) — video tetap tampil saat keluar aplikasi'],
    ['cast', 'Chromecast', 'Apkify.cast.load({url, title, image}) — putar video di TV'],
    ['tts', 'Text-to-speech', 'Apkify.tts.speak({text, lang:"id-ID"})'],
    ['speech', 'Speech-to-text', 'Apkify.stt.listen({lang:"id-ID"}) → {text}'],
    ['audioRecord', 'Rekam audio', 'Apkify.recorder.start() · stop() → {url, durationMs}'],
    ['print', 'Cetak (Android Print)', 'Apkify.print() / window.print() · print({url:"…pdf"})'],
    ['pdfViewer', 'Penampil PDF native', 'Link .pdf langsung terbuka · Apkify.pdf.open({url})'],
    ['saveGallery', 'Simpan ke galeri', 'Apkify.gallery.save({url|base64, album})']
  ]],
  ['Data & sistem', [
    ['contacts', 'Pilih kontak', 'Apkify.contacts.pick() → {name, phone} (tanpa izin)'],
    ['contactsRead', 'Baca semua kontak', 'Apkify.contacts.list({query}) — butuh izin kontak'],
    ['calendar', 'Tambah ke kalender', 'Apkify.calendar.add({title, start, end, location})'],
    ['phoneCall', 'Telepon & SMS', 'Apkify.phone.call({number}) · sms.compose({number, body})'],
    ['directCall', 'Telepon langsung (tanpa dialer)', 'Apkify.phone.call({number, direct:true}) — butuh izin telepon'],
    ['smsOtp', 'OTP SMS otomatis', 'Apkify.sms.otp() → {code} — SMS User Consent, tanpa izin baca SMS'],
    ['shareFiles', 'Bagikan & buka berkas', 'Apkify.shareFiles({files:[{url, name}]}) · files.pick() · files.open({url})'],
    ['fileSystem', 'Akses folder pilihan pengguna', 'Apkify.fs.pickDirectory() → baca/tulis/daftar berkas di folder itu (permanen)'],
    ['secureStorage', 'Penyimpanan terenkripsi', 'Apkify.secure.set({key, value}) — Android Keystore'],
    ['sqlite', 'Database SQLite native', 'Apkify.db.query({sql, params}) · batch({statements})'],
    ['installReferrer', 'Install referrer', 'Apkify.referrer.get() — lacak kampanye/afiliasi dari link Play Store']
  ]],
  ['Login & integrasi', [
    ['googleSignIn', 'Login Google native', 'Apkify.google.signIn() → idToken (Firebase/Supabase). Login Google di WebView diblokir Google'],
    ['facebookLogin', 'Login Facebook', 'Apkify.facebook.login() → accessToken'],
    ['firebaseAnalytics', 'Firebase Analytics', 'Apkify.analytics.log({name, params})'],
    ['crashlytics', 'Firebase Crashlytics', 'Crash native otomatis · Apkify.crashlytics.recordError({message, stack})'],
    ['playIntegrity', 'Play Integrity', 'Apkify.integrity.token({nonce}) — cegah APK modifikasi/emulator'],
    ['inAppUpdate', 'In-App Update', 'Apkify.update.check() · start({type:"flexible"})'],
    ['autoUpdate', 'Cek pembaruan otomatis saat dibuka', 'Prioritas ≥4 di Play Console = update wajib'],
    ['payments', 'Halaman pembayaran (Midtrans/Xendit)', 'Apkify.pay.open({url: snap/invoice URL}) — Custom Tab, kembali otomatis']
  ]],
  ['UI native', [
    ['widget', 'Widget layar utama', 'Apkify.widget.update({title, text, url})'],
    ['quickTile', 'Tombol Quick Settings', 'Tombol di panel notifikasi untuk membuka halaman tertentu'],
    ['altIcons', 'Ganti ikon aplikasi', 'Apkify.icon.set({name:"1"}) — ikon musiman/premium'],
    ['appLock', 'Kunci aplikasi (PIN/sidik jari)', 'Minta verifikasi saat aplikasi dibuka kembali'],
    ['kiosk', 'Mode kiosk', 'Apkify.kiosk.start() — kunci layar ke aplikasi (POS, absensi, tablet tamu)'],
    ['barcodeScanner', 'Scanner industri (Zebra, Honeywell, Sunmi…)', 'Event "scan" dari tombol scan fisik; Zebra DataWedge dikonfigurasi otomatis (termasuk RFID)'],
    ['mdm', 'Konfigurasi MDM/EMM', 'Apkify.mdm.config() — URL awal & mode kiosk dari Android Enterprise']
  ]]
];

export function NativePluginsSection({ cfg, set, Toggle }) {
  const f = cfg.features;
  const [altMsg, setAltMsg] = useState('');
  const count = NATIVE_GROUPS.flatMap(([, l]) => l).filter(([k]) => f[k]).length;
  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>
        Semua fitur dipanggil dari JavaScript situs Anda lewat <code>window.Apkify</code> (otomatis mengaktifkan JavaScript API). Setiap fungsi mengembalikan Promise
        <code> {'{ok, …}'}</code>. Hanya izin & SDK fitur yang dipilih yang masuk ke APK. Tidak memakai izin yang butuh persetujuan khusus Google Play
        (lokasi latar, baca SMS/log panggilan, aksesibilitas). <Link component={RouterLink} to="/docs/api">Dokumentasi lengkap API →</Link>
      </Alert>
      {count > 0 && <Chip color="primary" size="small" label={`${count} plugin aktif`} sx={{ mb: 1 }} />}
      {NATIVE_GROUPS.map(([title, list]) => (
        <Box key={title} sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" color="primary" sx={{ mt: 1 }}>{title}</Typography>
          <Grid container>
            {list.map(([k, label, hint]) => <Grid item xs={12} sm={6} key={k}><Toggle k={k} label={label} hint={hint} /></Grid>)}
          </Grid>
        </Box>
      ))}

      {f.googleSignIn && (
        <TextField fullWidth sx={{ mt: 1 }} label="Google Web client ID" value={cfg.google.webClientId} onChange={(e) => set('google.webClientId', e.target.value.trim())}
          placeholder="1234-abc.apps.googleusercontent.com"
          helperText="Google Cloud Console → Credentials → OAuth client 'Web application' (Firebase: Authentication → Google → Web SDK config). Tambahkan juga OAuth client Android dengan SHA-1 keystore build." />
      )}
      {f.facebookLogin && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
          <TextField label="Facebook App ID" value={cfg.facebook.appId} onChange={(e) => set('facebook.appId', e.target.value.trim())} />
          <TextField label="Client Token" value={cfg.facebook.clientToken} onChange={(e) => set('facebook.clientToken', e.target.value.trim())} helperText="App settings → Advanced → Client token" />
        </Stack>
      )}
      {f.playIntegrity && (
        <TextField sx={{ mt: 2 }} label="Cloud project number (opsional)" value={cfg.integrity.cloudProjectNumber || ''} onChange={(e) => set('integrity.cloudProjectNumber', e.target.value.replace(/\D/g, ''))}
          helperText="Wajib bila aplikasi tidak dipasang dari Play Store" />
      )}
      {f.nfcHce && (
        <TextField fullWidth sx={{ mt: 2 }} label="AID tambahan (opsional, pisahkan koma)" value={(cfg.nfc.aids || []).join(',')}
          onChange={(e) => set('nfc.aids', e.target.value.toUpperCase().split(',').map((x) => x.trim()).filter(Boolean))}
          helperText="Default: NDEF Type 4 (D2760000850101). Isi AID kustom untuk kartu akses/loyalty Anda; respons diatur lewat Apkify.nfc.emulateApdu()" />
      )}
      {f.appLock && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2">Kunci lagi setelah di latar belakang {cfg.appLock.timeoutSec} detik</Typography>
          <Slider value={cfg.appLock.timeoutSec} min={0} max={600} step={10} onChange={(_, v) => set('appLock.timeoutSec', v)} sx={{ maxWidth: 360 }} />
        </Box>
      )}
      {f.widget && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
          <TextField label="Judul widget" value={cfg.widget.title} onChange={(e) => set('widget.title', e.target.value.slice(0, 40))} />
          <TextField label="Teks awal" value={cfg.widget.text} onChange={(e) => set('widget.text', e.target.value.slice(0, 120))} />
          <TextField label="URL saat diketuk" value={cfg.widget.url} onChange={(e) => set('widget.url', e.target.value)} placeholder="/" />
        </Stack>
      )}
      {f.quickTile && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
          <TextField label="Label tombol" value={cfg.tile.label} onChange={(e) => set('tile.label', e.target.value.slice(0, 24))} />
          <TextField select label="Ikon" value={cfg.tile.icon} onChange={(e) => set('tile.icon', e.target.value)} sx={{ minWidth: 120 }}>
            {NAV_ICONS.map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
          </TextField>
          <TextField label="URL" value={cfg.tile.url} onChange={(e) => set('tile.url', e.target.value)} placeholder="/scan" />
        </Stack>
      )}
      {f.kiosk && (
        <Stack sx={{ mt: 1 }}>
          <FormControlLabel control={<Checkbox checked={cfg.kiosk.autoStart} onChange={(e) => set('kiosk.autoStart', e.target.checked)} />} label="Langsung masuk mode kiosk saat aplikasi dibuka" />
          <FormControlLabel control={<Checkbox checked={cfg.kiosk.launcher} onChange={(e) => set('kiosk.launcher', e.target.checked)} />} label="Jadikan launcher (aplikasi utama perangkat, terbuka saat HP menyala)" />
          <Typography variant="caption" color="text.secondary">Tanpa device owner, Android menampilkan konfirmasi “sematkan layar”. Untuk kiosk penuh, jadikan device owner lewat MDM/ADB.</Typography>
        </Stack>
      )}
      {f.altIcons && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>Ikon alternatif (maks. 3, PNG persegi ≥ 192 px). Dipilih dari JS: <code>Apkify.icon.set({'{'}name:"1"{'}'})</code>, kembali: <code>name:"default"</code>.</Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            {cfg.altIconFileIds.map((id, i) => (
              <Chip key={id} avatar={<Avatar src={fileUrl(id)} />} label={`Ikon ${i + 1}`} onDelete={() => set('altIconFileIds', cfg.altIconFileIds.filter((x) => x !== id))} />
            ))}
          </Stack>
          {cfg.altIconFileIds.length < 3 && (
            <FileDrop accept="image/png" label="Tambah ikon alternatif" onFile={async (file) => {
              setAltMsg('');
              try { const r = await api.upload('/api/uploads', file, { kind: 'icon' }); set('altIconFileIds', [...cfg.altIconFileIds, r.fileId]); }
              catch (e) { setAltMsg(e.message); }
            }} />
          )}
          {altMsg && <Alert severity="error" sx={{ mt: 1 }}>{altMsg}</Alert>}
        </Box>
      )}
      {(f.backgroundAudio || f.locationApi || f.contactsRead || f.directCall) && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Formulir Play Console yang perlu diisi saat rilis:{' '}
          {[f.backgroundAudio && 'deklarasi foreground service “mediaPlayback”', f.locationApi && 'Data safety: lokasi', f.contactsRead && 'Data safety: kontak', f.directCall && 'izin telepon (CALL_PHONE)'].filter(Boolean).join(', ')}.
          Bukan izin terbatas, cukup dijelaskan penggunaannya.
        </Alert>
      )}
    </>
  );
}

// ---------------- Iklan ----------------
export const AD_NETWORKS = [
  ['admob', 'Google AdMob', 'Semua format + mediasi (Meta, AppLovin, Unity, Pangle, Mintegral, ironSource)'],
  ['applovin', 'AppLovin MAX', 'Banner, interstitial, rewarded, app open — mediasi bidding sendiri'],
  ['unity', 'Unity Ads', 'Banner, interstitial, rewarded — eCPM video tinggi'],
  ['meta', 'Meta Audience Network', 'Banner, interstitial, rewarded video'],
  ['startio', 'Start.io', 'Banner, interstitial, rewarded — mudah disetujui, cocok untuk pemula']
];
const FIELDS = {
  admob: [['appId', 'App ID', 'ca-app-pub-xxx~yyy'], ['bannerId', 'Banner', 'ca-app-pub-xxx/yyy'], ['interstitialId', 'Interstitial'], ['rewardedId', 'Rewarded'],
    ['rewardedInterstitialId', 'Rewarded interstitial'], ['appOpenId', 'App open'], ['nativeId', 'Native (untuk banner gaya native)']],
  applovin: [['sdkKey', 'SDK key'], ['bannerId', 'Banner ad unit'], ['interstitialId', 'Interstitial ad unit'], ['rewardedId', 'Rewarded ad unit'], ['appOpenId', 'App open ad unit']],
  unity: [['gameId', 'Game ID (Android)'], ['bannerId', 'Banner placement', 'Banner_Android'], ['interstitialId', 'Interstitial placement', 'Interstitial_Android'], ['rewardedId', 'Rewarded placement', 'Rewarded_Android']],
  meta: [['bannerId', 'Banner placement ID', '123_456'], ['interstitialId', 'Interstitial placement ID'], ['rewardedId', 'Rewarded video placement ID']],
  startio: [['appId', 'App ID']]
};
const MEDIATION = [['meta', 'Meta Audience Network'], ['applovin', 'AppLovin'], ['unity', 'Unity Ads'], ['pangle', 'Pangle (TikTok)'], ['mintegral', 'Mintegral'], ['ironsource', 'ironSource']];

export function AdsSection({ cfg, set, Toggle, error }) {
  const f = cfg.features;
  const a = cfg.ads;
  const net = a.network || 'admob';
  const ids = a[net] || {};
  return (
    <>
      <Toggle k="ads" label="Aktifkan iklan" hint="Pendapatan iklan 100% masuk ke akun jaringan iklan Anda" />
      {f.ads && (
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField select label="Jaringan iklan" value={net} onChange={(e) => set('ads.network', e.target.value)}>
            {AD_NETWORKS.map(([k, label, hint]) => <MenuItem key={k} value={k}><Stack><span>{label}</span><Typography variant="caption" color="text.secondary">{hint}</Typography></Stack></MenuItem>)}
          </TextField>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {FIELDS[net].map(([k, label, ph]) => (
              <TextField key={k} label={label} placeholder={ph || ''} value={ids[k] || ''} onChange={(e) => set(`ads.${net}.${k}`, e.target.value.trim())} InputProps={{ sx: { fontFamily: MONO, fontSize: 12.5 } }} />
            ))}
          </Box>
          {(net === 'unity' || net === 'startio') && (
            <FormControlLabel control={<Switch checked={!!ids.testMode} onChange={(e) => set(`ads.${net}.testMode`, e.target.checked)} />} label="Mode uji (iklan percobaan)" />
          )}
          {error && <Alert severity="error">{error}</Alert>}
          <Divider />
          <Typography variant="subtitle2">Format & penempatan</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
            <Box>
              <TextField select fullWidth label="Banner" value={a.banner} onChange={(e) => set('ads.banner', e.target.value)}>
                <MenuItem value="bottom">Bawah</MenuItem><MenuItem value="top">Atas</MenuItem><MenuItem value="none">Tidak ada</MenuItem>
              </TextField>
            </Box>
            {net === 'admob' && (
              <Box>
                <TextField select fullWidth label="Gaya banner" value={a.bannerStyle} onChange={(e) => set('ads.bannerStyle', e.target.value)}>
                  <MenuItem value="adaptive">Adaptif</MenuItem><MenuItem value="collapsible">Collapsible (CTR tinggi)</MenuItem><MenuItem value="native">Native (menyatu dengan UI)</MenuItem>
                </TextField>
              </Box>
            )}
          </Box>
          <FormControlLabel control={<Switch checked={a.interstitial} onChange={(e) => set('ads.interstitial', e.target.checked)} />} label="Interstitial otomatis saat pindah halaman" />
          {a.interstitial && (
            <Box>
              <Typography variant="body2">Setiap {a.interstitialEvery} perpindahan halaman, jeda minimal {a.minGapSec} detik</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
                <Slider value={a.interstitialEvery} min={1} max={20} onChange={(_, v) => set('ads.interstitialEvery', v)} sx={{ maxWidth: 260 }} />
                <Slider value={a.minGapSec} min={0} max={300} step={15} onChange={(_, v) => set('ads.minGapSec', v)} sx={{ maxWidth: 260 }} />
              </Stack>
            </Box>
          )}
          {(net === 'admob' || net === 'applovin') && (
            <FormControlLabel control={<Switch checked={a.appOpen} onChange={(e) => set('ads.appOpen', e.target.checked)} />} label="App open (saat aplikasi dibuka / kembali dari latar)" />
          )}
          {net === 'admob' && (
            <Box>
              <Typography variant="subtitle2">Mediasi AdMob (opsional)</Typography>
              <Typography variant="caption" color="text.secondary">Adaptor SDK ikut ter-bundle; atur waterfall/bidding di dashboard AdMob → Mediation.</Typography>
              <Grid container>
                {MEDIATION.map(([k, label]) => (
                  <Grid item xs={6} sm={4} key={k}>
                    <FormControlLabel control={<Checkbox checked={a.mediation.includes(k)} onChange={(e) => set('ads.mediation', e.target.checked ? [...a.mediation, k] : a.mediation.filter((x) => x !== k))} />} label={label} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
          <Alert severity="info">
            Rewarded & lainnya dari JavaScript: <code>const r = await Apkify.ads.showRewarded(); if (r.rewarded) beriHadiah(r.amount);</code> · <code>Apkify.ads.showInterstitial()</code> ·{' '}
            <code>showRewardedInterstitial()</code> · <code>showAppOpen()</code> · <code>hideBanner()</code>. Jangan klik iklan sendiri; gunakan mode uji/ID uji saat mencoba.
          </Alert>
        </Stack>
      )}
    </>
  );
}
