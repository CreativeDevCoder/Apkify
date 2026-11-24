import { useMemo, useState } from 'react';
import { Container, Typography, TextField, Card, CardContent, Chip, Stack, Box, Alert, Grid } from '@mui/material';
import PageHeader from '../components/PageHeader';

// [namespace, fitur Apkify, ringkasan, metode, contoh]
const API = [
  ['Dasar', 'jsApi', 'Selalu ada bila JavaScript API aktif', 'toast vibrate share copy open keepScreenOn exit device app on off call has',
    `if (window.Apkify) {
  Apkify.toast('Tersimpan');
  Apkify.has('nfc');              // fitur yang ikut di build ini
  Apkify.on('theme', (d) => console.log('mode gelap:', d.dark));
}`],
  ['device', 'jsApi', 'Info perangkat, baterai, jaringan, kecerahan, volume, senter, getar pola, haptic, deteksi root',
    'info battery network brightness volume flashlight vibrate haptic security',
    `const { level, charging } = await Apkify.device.battery();
await Apkify.device.flashlight({ on: true });
await Apkify.device.vibrate({ pattern: [100, 50, 100] });
const { rooted, developerMode } = await Apkify.device.security();`],
  ['sensor', 'sensors', 'Akselerometer, giroskop, kompas, cahaya, proximity, barometer, langkah', 'list start stop',
    `Apkify.on('sensor', (d) => d.type === 'compass' && (arrow.style.rotate = -d.heading + 'deg'));
await Apkify.sensor.start({ type: 'compass', interval: 100 });`],
  ['nfc', 'nfc', 'Baca/tulis tag NDEF, UID kartu, emulasi kartu (HCE)', 'status read watch write stop emulate emulateApdu emulateStop',
    `const tag = await Apkify.nfc.read();          // {id:'04A1…', records:[{recordType,value}]}
await Apkify.nfc.write({ records: [{ type: 'uri', value: 'https://toko.id/p/12' }] });
await Apkify.nfc.emulate({ records: [{ type: 'text', value: 'MEMBER-001' }] }); // HCE`],
  ['bt / ble', 'bluetooth', 'Printer thermal Bluetooth (ESC/POS) & perangkat BLE', 'bt.paired bt.discover bt.print bt.enable · ble.scan ble.connect ble.read ble.write ble.notify ble.disconnect',
    `const { devices } = await Apkify.bt.paired();
const struk = Apkify.escpos().align('center').bold(true).text('TOKO MAJU').bold(false)
  .line().align('left').text('Kopi susu   x2   30.000').line().qr('INV-001').feed(3).cut().base64();
await Apkify.bt.print({ address: devices[0].address, base64: struk });

await Apkify.ble.connect({ address });
Apkify.on('ble.notify', (d) => console.log(atob(d.value)));
await Apkify.ble.notify({ address, service, characteristic });`],
  ['usb', 'usb', 'USB OTG: printer USB & serial CDC', 'list requestPermission open write read close',
    `const { devices } = await Apkify.usb.list();
await Apkify.usb.write({ deviceName: devices[0].deviceName, base64: struk });`],
  ['ir', 'infrared', 'IR blaster', 'available transmit', `await Apkify.ir.transmit({ frequency: 38000, pattern: [9000, 4500, 560, 560] });`],
  ['camera / files / shareFiles', 'nativeCamera, shareFiles', 'Kamera native, pilih/buka/bagikan berkas. Hasil berupa URL lokal yang bisa dipakai di <img> atau fetch()',
    'camera.photo camera.video files.pick files.open shareFiles',
    `const foto = await Apkify.camera.photo({ maxWidth: 1280, quality: 80 });
img.src = foto.url;
const blob = await (await fetch(foto.url)).blob();   // unggah ke server Anda
await Apkify.shareFiles({ files: [{ url: foto.url, name: 'bukti.jpg' }], text: 'Bukti transfer' });`],
  ['docscan / ocr / face / barcode', 'docScanner, ocr, faceDetection, qrGenerate', 'ML Kit on-device: pindai dokumen, OCR, deteksi wajah, buat QR',
    'docscan.start ocr.recognize face.detect barcode.generate',
    `const { pages, pdf } = await Apkify.docscan.start({ pages: 5 });
const { text } = await Apkify.ocr.recognize({ url: pages[0].url });
const nik = text.match(/\\b\\d{16}\\b/)?.[0];
const { count } = await Apkify.face.detect({ url: selfie.url });
const { dataUrl } = await Apkify.barcode.generate({ text: 'INV-001', format: 'QR_CODE', size: 512 });`],
  ['location / geofence / activity', 'locationApi, geofence, activityRecognition', 'Lokasi presisi + deteksi Fake GPS, geofence absensi, pengenalan aktivitas',
    'location.current location.watch location.stop location.distance geofence.check geofence.watch geofence.stop activity.start activity.stop',
    `const r = await Apkify.geofence.check({ fences: [{ id: 'kantor', lat: -6.2, lng: 106.8, radius: 100 }] });
if (r.mock) alert('Fake GPS terdeteksi');
else if (r.inside) absenMasuk(r.lat, r.lng);`],
  ['notify / badge', 'localNotifications', 'Notifikasi lokal, terjadwal, berulang; badge', 'requestPermission show schedule cancel cancelAll pending createChannel · badge.set badge.clear',
    `await Apkify.notify.schedule({ id: 1, title: 'Minum obat', body: 'Jam 08.00', at: Date.parse('2026-12-01T08:00'), every: 'day', url: '/obat' });
Apkify.on('notificationClick', (d) => console.log(d.id));`],
  ['sync', 'backgroundSync', 'Panggil URL Anda berkala walau aplikasi ditutup (min. 15 menit)', 'register runNow cancel last',
    `await Apkify.sync.register({ url: 'https://api.toko.id/notif?user=12', minutes: 30 });
// server membalas {"notifications":[{"title":"Pesanan dikirim","body":"…","url":"/pesanan/9"}]}`],
  ['media / pip / cast', 'backgroundAudio, pip, cast', 'Audio latar + kontrol layar kunci, Picture-in-Picture, Chromecast',
    'media.start media.update media.stop pip.enter pip.auto cast.load cast.play cast.pause cast.stop cast.status',
    `audio.play();
await Apkify.media.start({ title: 'Radio Kita', artist: 'Live', artwork: 'https://…/logo.png', playing: true });
Apkify.on('media', ({ action }) => action === 'pause' ? audio.pause() : action === 'play' && audio.play());
await Apkify.pip.auto({ enable: true });
await Apkify.cast.load({ url: 'https://…/video.m3u8', title: 'Kajian' });`],
  ['tts / stt / recorder', 'tts, speech, audioRecord', 'Suara: baca teks, dikte, rekam audio', 'tts.speak tts.stop stt.listen recorder.start recorder.stop',
    `await Apkify.tts.speak({ text: 'Pesanan nomor 12', lang: 'id-ID' });
const { text } = await Apkify.stt.listen({ lang: 'id-ID' });
await Apkify.recorder.start(); const rec = await Apkify.recorder.stop(); // {url, durationMs}`],
  ['print / pdf / gallery / download', 'print, pdfViewer, saveGallery, downloads', 'Cetak, penampil PDF, simpan ke galeri, unduhan dengan progres',
    'print pdf.open gallery.save download.start download.cancel',
    `window.print();                                   // halaman ini
await Apkify.print({ url: 'https://…/invoice.pdf' });
await Apkify.gallery.save({ url: foto.url, album: 'Toko' });
Apkify.on('download', (d) => bar.value = d.progress);
await Apkify.download.start({ url: 'https://…/katalog.pdf' });`],
  ['contacts / calendar / phone / sms', 'contacts, calendar, phoneCall, smsOtp', 'Kontak, kalender, telepon, SMS, OTP otomatis tanpa izin baca SMS',
    'contacts.pick contacts.list calendar.add phone.call sms.compose sms.otp',
    `const { name, phone } = await Apkify.contacts.pick();
await Apkify.calendar.add({ title: 'Servis motor', start: Date.now() + 864e5 });
const { code } = await Apkify.sms.otp();  // panggil sebelum server mengirim SMS OTP
otpInput.value = code;`],
  ['fs (folder pilihan)', 'fileSystem', 'Akses folder yang dipilih pengguna (Storage Access Framework), izin permanen', 'pickDirectory directories release list stat read write copy mkdir delete saveAs',
    `const dir = await Apkify.fs.pickDirectory();            // mis. Download/Laporan
await Apkify.fs.write({ dir: dir.uri, name: 'stok.csv', data: csv });
const { files } = await Apkify.fs.list({ uri: dir.uri });
await Apkify.fs.saveAs({ name: 'laporan.pdf', url: pdfUrl });`],
  ['secure / db', 'secureStorage, sqlite', 'Penyimpanan terenkripsi (Android Keystore) & SQLite native', 'secure.get secure.set secure.remove secure.keys · db.query db.exec db.batch db.close',
    `await Apkify.secure.set({ key: 'token', value: jwt });
await Apkify.db.exec({ sql: 'CREATE TABLE IF NOT EXISTS stok(id INTEGER PRIMARY KEY, nama TEXT, qty INT)' });
await Apkify.db.exec({ sql: 'INSERT INTO stok(nama, qty) VALUES(?, ?)', params: ['Kopi', 10] });
const { rows } = await Apkify.db.query({ sql: 'SELECT * FROM stok WHERE qty < ?', params: [5] });`],
  ['google / facebook', 'googleSignIn, facebookLogin', 'Login native (Google memblokir login di WebView)', 'google.signIn google.signOut facebook.login facebook.logout',
    `import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
const r = await Apkify.google.signIn();
if (r.ok) await signInWithCredential(auth, GoogleAuthProvider.credential(r.idToken));`],
  ['analytics / crashlytics', 'firebaseAnalytics, crashlytics', 'Firebase Analytics & Crashlytics (butuh google-services.json)', 'analytics.log analytics.screen analytics.setUserId crashlytics.log crashlytics.recordError',
    `Apkify.analytics.log({ name: 'checkout', params: { value: 150000 } });
window.addEventListener('error', (e) => Apkify.crashlytics.recordError({ message: e.message, stack: e.error?.stack }));`],
  ['update / integrity / referrer / pay', 'inAppUpdate, playIntegrity, installReferrer, payments', 'Pembaruan dari Play Store, verifikasi integritas, referrer, halaman bayar',
    'update.check update.start update.complete integrity.token referrer.get pay.open',
    `const u = await Apkify.update.check(); if (u.available) Apkify.update.start({ type: 'flexible' });
const { token } = await Apkify.integrity.token({ nonce });   // verifikasi di server Anda
await Apkify.pay.open({ url: snapRedirectUrl });               // Midtrans/Xendit; resolve saat kembali`],
  ['dialog / picker / ui', 'jsApi', 'Dialog & action sheet native, date/time picker, status bar & orientasi saat runtime',
    'dialog.alert dialog.confirm dialog.prompt dialog.actionSheet dialog.toast picker.date picker.time ui.statusBar ui.fullscreen ui.orientation ui.theme ui.toolbar ui.refresh',
    `const { value } = await Apkify.dialog.confirm({ title: 'Hapus?', message: 'Data tidak bisa kembali' });
const { index } = await Apkify.dialog.actionSheet({ options: ['Kamera', 'Galeri', { label: 'Hapus', destructive: true }] });
const { value: tgl } = await Apkify.picker.date({ value: '2026-12-01' });
await Apkify.ui.statusBar({ color: '#000000' });`],
  ['widget / tile / icon / lock / kiosk', 'widget, quickTile, altIcons, appLock, kiosk', 'Widget layar utama, Quick Settings, ganti ikon, kunci aplikasi, mode kiosk',
    'widget.update tile.update icon.list icon.set lock.now kiosk.start kiosk.stop kiosk.status',
    `await Apkify.widget.update({ title: 'Saldo', text: 'Rp 1.250.000', url: '/dompet' });
await Apkify.icon.set({ name: '1' });     // ikon alternatif #1
await Apkify.kiosk.start();`],
  ['scanner / mdm', 'barcodeScanner, mdm', 'Scanner industri (Zebra DataWedge + RFID, Honeywell, Sunmi, Urovo, Newland, iData) & konfigurasi MDM',
    'scanner.start scanner.stop scanner.trigger · mdm.config',
    `Apkify.on('scan', ({ data, symbology }) => tambahKeKeranjang(data));
const { config } = await Apkify.mdm.config();`],
  ['ads', 'ads', 'Iklan: banner, interstitial, rewarded, rewarded interstitial, app open — AdMob/AppLovin/Unity/Meta/Start.io',
    'showInterstitial showRewarded showRewardedInterstitial showAppOpen hideBanner showBanner network',
    `const r = await Apkify.ads.showRewarded();
if (r.rewarded) tambahKoin(r.amount);
await Apkify.ads.hideBanner();    // mis. di halaman checkout`],
  ['Pembelian & lainnya (rilis 4)', 'qrScanner, biometric, billing, fcm…', 'Scanner QR, biometrik, Google Play Billing, push FCM, penyimpanan native',
    'scanQR biometric requestReview iap.products iap.purchase iap.restore getPushToken storage.get storage.set',
    `const { value } = await Apkify.scanQR();
const { ok } = await Apkify.biometric('Konfirmasi pembayaran');`]
];

export default function DocsApi() {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? API.filter((a) => a.join(' ').toLowerCase().includes(s)) : API;
  }, [q]);
  return (
    <>
      <PageHeader title="Referensi JavaScript API" subtitle="Panggil fitur native Android dari kode situs/React Anda lewat window.Apkify" />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          Semua fungsi asinkron mengembalikan Promise berisi <code>{'{ ok: true, … }'}</code> atau <code>{'{ ok: false, error }'}</code> — tidak pernah melempar error.
          Pakai <code>Apkify.call.strict('nfc.read')</code> bila ingin <i>reject</i> saat gagal. Event: <code>Apkify.on('nama', fn)</code> atau
          <code> document.addEventListener('apkify:nama', e =&gt; e.detail)</code>. Selalu cek <code>if (window.Apkify)</code> agar situs tetap berjalan di browser biasa.
          Aktifkan fitur yang dipakai di halaman Buat Aplikasi → “Fitur native lengkap”, lalu build ulang.
        </Alert>
        <TextField fullWidth placeholder="Cari: nfc, printer, ocr, absensi, notifikasi…" value={q} onChange={(e) => setQ(e.target.value)} sx={{ mb: 3 }} />
        <Grid container spacing={2}>
          {list.map(([ns, feat, desc, methods, code]) => (
            <Grid item xs={12} md={6} key={ns}>
              <Card variant="outlined" sx={{ height: '100%' }}><CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                  <Typography variant="h6" fontFamily="monospace">{ns}</Typography>
                  <Chip size="small" label={`fitur: ${feat}`} />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{desc}</Typography>
                <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace', mb: 1 }}>{methods}</Typography>
                <Box component="pre" sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 2, fontSize: 12, overflow: 'auto', m: 0 }}>{code}</Box>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </>
  );
}
