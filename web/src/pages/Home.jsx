import { useEffect, useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Box, Container, Typography, Button, Stack, InputBase, ToggleButtonGroup, ToggleButton, Tabs, Tab } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckIcon from '@mui/icons-material/Check';
import { api } from '../lib/api';
import { swr } from '../lib/cache';
import { MONO } from '../theme';
import { Eyebrow, Section, SectionTitle, RuleList, CodeBlock, Dot, gridBg } from '../components/ui';

const STEPS = [
  ['Pilih sumber', 'Alamat website, ZIP hasil build atau kode sumber React/Vite, atau satu file HTML.'],
  ['Atur sekali', 'Nama, ikon, warna, navigasi, fitur native, dan iklan — satu konfigurasi untuk semua platform.'],
  ['Unduh hasilnya', 'APK untuk dicoba, AAB untuk Play Store, plus installer desktop dan IPA bila dipilih.']
];

const OUTPUTS = [
  ['Android', 'APK · AAB', 'Ditandatangani kunci tetap per package; siap Google Play'],
  ['iOS', 'IPA · proyek Xcode', 'Bertanda tangan bila sertifikat diunggah; dibangun tanpa Mac'],
  ['Windows', '.exe · .msi', 'Installer ringan berbasis WebView2'],
  ['macOS', '.dmg', 'Universal — Apple Silicon dan Intel'],
  ['Linux', '.AppImage · .deb', 'Ubuntu, Debian, dan distro lain']
];

const REASONS = [
  ['Tanpa watermark, tanpa biaya', 'Build gratis di cloud. Tidak ada logo kami di aplikasi Anda.'],
  ['Kunci tanda tangan tetap', 'Setiap package selalu ditandatangani kunci yang sama, jadi pembaruan terpasang mulus.'],
  ['Konten offline & terenkripsi', 'ZIP/HTML dibundel ke aplikasi dan dienkripsi AES-GCM.'],
  ['Pembaruan tanpa build ulang', 'Kirim pesan, paksa update, atau ganti konten lewat Remote Update.'],
  ['Iklan dari lima jaringan', 'AdMob, AppLovin, Unity, Meta, Start.io — semua format, 100% pendapatan untuk Anda.'],
  ['Build kode sumber', 'Unggah proyek React/Vite apa adanya; kami jalankan npm install dan build.']
];

const SNIPPETS = {
  nfc: ['NFC', `// baca kartu atau tag NFC
const tag = await Apkify.nfc.read();
console.log(tag.id, tag.records[0]?.value);`],
  printer: ['Printer', `// cetak struk ke printer thermal Bluetooth
const struk = Apkify.escpos()
  .align('center').bold(true).text('TOKO MAJU')
  .bold(false).line().text('Kopi susu   x2   30.000')
  .feed(3).cut().base64();
await Apkify.bt.print({ address, base64: struk });`],
  ocr: ['OCR', `// pindai dokumen, lalu baca teksnya — offline
const { pages } = await Apkify.docscan.start();
const { text } = await Apkify.ocr.recognize({ url: pages[0].url });
const nik = text.match(/\\b\\d{16}\\b/)?.[0];`],
  ads: ['Iklan', `// iklan berhadiah dari jaringan pilihan Anda
const r = await Apkify.ads.showRewarded();
if (r.rewarded) tambahKoin(r.amount);`]
};

// ---------- Konsol build ilustratif (hero) ----------
const JOBS = [['android', 'APK · AAB', '3:12'], ['windows', '.exe · .msi', '4:05'], ['macos', '.dmg', null], ['linux', '.AppImage', '2:48'], ['ios', '.ipa', null]];
const LOG = ['prepare  config → app.tokosaya.android', 'source   npm ci && npm run build', 'gradle   assembleRelease bundleRelease', 'sign     keystore SHA-256 3F:A9:…:C1', 'upload   app-release.aab  6.2 MB'];

function BuildConsole() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setTick(LOG.length); return undefined; }
    const id = setInterval(() => setTick((t) => (t >= LOG.length + 3 ? 0 : t + 1)), 900);
    return () => clearInterval(id);
  }, []);
  const lines = Math.min(tick, LOG.length);
  const done = tick >= LOG.length;
  return (
    <Box aria-hidden sx={{
      border: 1, borderColor: 'divider', borderRadius: 2.5, bgcolor: 'background.paper', overflow: 'hidden',
      boxShadow: (t) => (t.palette.mode === 'light' ? '0 1px 2px rgba(15,18,23,.04), 0 24px 48px -24px rgba(15,18,23,.18)' : '0 24px 48px -24px rgba(0,0,0,.8)')
    }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 2, height: 42, borderBottom: 1, borderColor: 'divider', bgcolor: (t) => t.tokens.subtle }}>
        <Dot color={done ? 'success.main' : 'primary.main'} pulse={!done} />
        <Typography sx={{ fontFamily: MONO, fontSize: 12, flex: 1 }} noWrap>build #2481 · Toko Saya</Typography>
        <Typography sx={{ fontFamily: MONO, fontSize: 11, color: 'text.secondary' }}>{done ? 'selesai' : 'berjalan'}</Typography>
      </Stack>
      <Box>
        {JOBS.map(([p, fmt, dur], i) => {
          const state = done ? (dur ? 'ok' : (p === 'ios' ? 'queued' : 'run')) : i * 1.1 < tick ? (dur && tick > i + 2 ? 'ok' : 'run') : 'queued';
          return (
            <Stack key={p} direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, height: 40, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ width: 16, display: 'grid', placeItems: 'center' }}>
                {state === 'ok' ? <CheckIcon sx={{ fontSize: 15, color: 'success.main' }} /> : <Dot color={state === 'run' ? 'primary.main' : 'text.disabled'} pulse={state === 'run'} />}
              </Box>
              <Typography sx={{ fontFamily: MONO, fontSize: 12.5, width: 74 }}>{p}</Typography>
              <Typography sx={{ fontFamily: MONO, fontSize: 12, color: 'text.secondary', flex: 1 }} noWrap>{fmt}</Typography>
              <Typography className="tnum" sx={{ fontFamily: MONO, fontSize: 12, color: state === 'ok' ? 'text.secondary' : 'text.disabled' }}>
                {state === 'ok' ? dur : state === 'run' ? 'berjalan' : 'antre'}
              </Typography>
            </Stack>
          );
        })}
      </Box>
      <Box sx={{ px: 2, py: 1.5, minHeight: 132, bgcolor: (t) => t.tokens.sunken }}>
        {LOG.slice(0, lines).map((l) => {
          const [k, ...rest] = l.split(/\s{2,}/);
          return (
            <Typography key={l} sx={{ fontFamily: MONO, fontSize: 11.5, lineHeight: '22px', color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <Box component="span" sx={{ color: 'primary.main', display: 'inline-block', width: 64 }}>{k}</Box>{rest.join(' ')}
            </Typography>
          );
        })}
        {!done && <Box sx={{ width: 7, height: 14, bgcolor: 'text.secondary', mt: 0.5, animation: 'apkBlink 1s steps(1) infinite', '@keyframes apkBlink': { '50%': { opacity: 0 } } }} />}
      </Box>
    </Box>
  );
}

export default function Home() {
  const nav = useNavigate();
  const [type, setType] = useState('url');
  const [url, setUrl] = useState('');
  const [stats, setStats] = useState(null);
  const [snip, setSnip] = useState('nfc');

  useEffect(() => {
    swr('stats', () => api.get('/api/public/stats', { auth: false }), { ttl: 10 * 60_000, onData: setStats }).catch(() => {});
  }, []);

  const go = (e) => {
    e?.preventDefault();
    const p = new URLSearchParams({ type });
    if (type === 'url' && url) p.set('url', /^https?:\/\//.test(url) ? url : `https://${url}`);
    nav(`/create?${p}`);
  };

  return (
    <>
      {/* ---------- Hero ---------- */}
      <Box sx={{ position: 'relative', borderBottom: 1, borderColor: 'divider', overflow: 'hidden' }}>
        <Box aria-hidden sx={(t) => ({ position: 'absolute', inset: 0, ...gridBg(t), maskImage: 'radial-gradient(ellipse 70% 80% at 30% 0%, #000 30%, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse 70% 80% at 30% 0%, #000 30%, transparent 75%)' })} />
        <Container maxWidth="lg" sx={{ position: 'relative', pt: { xs: 7, md: 12 }, pb: { xs: 7, md: 12 } }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.15fr 1fr' }, gap: { xs: 6, md: 8 }, alignItems: 'center' }}>
            <Box>
              <Eyebrow sx={{ mb: 2.5 }}>Website · ZIP · HTML <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>→ APK · AAB · IPA · EXE · DMG</Box></Eyebrow>
              <Typography variant="h1" sx={{ fontSize: { xs: '2.4rem', sm: '3rem', md: '3.6rem' }, maxWidth: 620 }}>
                Satu konfigurasi.<br />
                <Box component="span" sx={{ color: 'text.secondary' }}>Aplikasi untuk lima platform.</Box>
              </Typography>
              <Typography variant="subtitle1" sx={{ mt: 2.5, maxWidth: 520, fontSize: { md: '1.125rem' } }}>
                Ubah situs atau proyek web Anda menjadi aplikasi Android, iOS, Windows, macOS, dan Linux — dibangun paralel di cloud, gratis, tanpa watermark.
              </Typography>

              <Box component="form" onSubmit={go} sx={{ mt: 4, maxWidth: 560 }}>
                <ToggleButtonGroup exclusive value={type} onChange={(_, v) => v && setType(v)} aria-label="Sumber konten" sx={{ mb: 1.25 }}>
                  <ToggleButton value="url">Website</ToggleButton>
                  <ToggleButton value="zip">ZIP / kode sumber</ToggleButton>
                  <ToggleButton value="html">HTML</ToggleButton>
                </ToggleButtonGroup>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{
                  p: 0.75, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper',
                  transition: 'box-shadow 140ms, border-color 140ms',
                  '&:focus-within': { borderColor: 'primary.main', boxShadow: (t) => `0 0 0 3px ${alpha(t.palette.primary.main, 0.2)}` }
                }}>
                  {type === 'url' ? (
                    <InputBase value={url} onChange={(e) => setUrl(e.target.value)} placeholder="tokosaya.com" inputProps={{ 'aria-label': 'Alamat website', inputMode: 'url', autoCapitalize: 'none' }}
                      startAdornment={<Typography sx={{ fontFamily: MONO, fontSize: 13, color: 'text.disabled', pl: 1.25, pr: 0.25 }}>https://</Typography>}
                      sx={{ flex: 1, fontFamily: MONO, fontSize: 13.5, minHeight: 40 }} />
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1, px: 1.5, display: 'flex', alignItems: 'center', minHeight: 40 }}>
                      {type === 'zip' ? 'Unggah ZIP di langkah berikutnya — kode sumber React/Vite ikut di-build.' : 'Tempel kode HTML di langkah berikutnya.'}
                    </Typography>
                  )}
                  <Button type="submit" variant="contained" size="large" endIcon={<ArrowForwardIcon />}>Buat aplikasi</Button>
                </Stack>
              </Box>

              <Stack direction="row" spacing={2.5} sx={{ mt: 2.5, flexWrap: 'wrap', rowGap: 1 }}>
                {['Gratis', 'Tanpa watermark', 'Tanpa coding'].map((x) => (
                  <Stack key={x} direction="row" spacing={0.75} alignItems="center">
                    <CheckIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">{x}</Typography>
                  </Stack>
                ))}
                {stats?.totalBuilds > 0 && (
                  <Typography variant="body2" color="text.secondary" className="tnum">
                    <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{Number(stats.totalBuilds).toLocaleString('id-ID')}</Box> aplikasi dibuat
                  </Typography>
                )}
              </Stack>
            </Box>
            <BuildConsole />
          </Box>
        </Container>
      </Box>

      {/* ---------- Cara kerja ---------- */}
      <Section>
        <SectionTitle eyebrow="Cara kerja" title="Dari alamat situs ke berkas siap rilis." />
        <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: { xs: 0, md: 5 } }}>
          {STEPS.map(([t, d], i) => (
            <Box component="li" key={t} sx={{ pt: 2.5, pb: { xs: 3, md: 0 }, borderTop: 2, borderColor: i === 0 ? 'primary.main' : 'divider' }}>
              <Typography sx={{ fontFamily: MONO, fontSize: 12, color: i === 0 ? 'primary.main' : 'text.secondary', mb: 1.5 }}>{String(i + 1).padStart(2, '0')}</Typography>
              <Typography variant="h5" component="h3" sx={{ mb: 0.75 }}>{t}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 340 }}>{d}</Typography>
            </Box>
          ))}
        </Box>
      </Section>

      {/* ---------- Keluaran per platform ---------- */}
      <Section top>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.6fr' }, gap: { xs: 4, md: 8 } }}>
          <Box>
            <Eyebrow sx={{ mb: 1.5 }}>Keluaran</Eyebrow>
            <Typography variant="h2" sx={{ mb: 1.5 }}>Lima platform, dibangun bersamaan.</Typography>
            <Typography variant="subtitle1">Setiap platform berjalan sebagai job terpisah. Satu gagal, yang lain tetap selesai — Anda melihat statusnya satu per satu.</Typography>
            <Button component={RouterLink} to="/guides" endIcon={<ArrowForwardIcon />} sx={{ mt: 3, px: 0, '&:hover': { bgcolor: 'transparent', color: 'primary.main' } }} color="inherit">Panduan per platform</Button>
          </Box>
          <Box role="table" aria-label="Format keluaran per platform" sx={{ borderTop: 1, borderColor: 'divider' }}>
            {OUTPUTS.map(([p, f, n]) => (
              <Box role="row" key={p} sx={{
                display: 'grid', gridTemplateColumns: { xs: '1fr auto', sm: '120px 170px 1fr' }, columnGap: 3, rowGap: 0.5,
                py: 2, borderBottom: 1, borderColor: 'divider', alignItems: 'baseline'
              }}>
                <Typography role="cell" variant="h6" component="div">{p}</Typography>
                <Typography role="cell" sx={{ fontFamily: MONO, fontSize: 12.5, color: 'primary.main', textAlign: { xs: 'right', sm: 'left' } }}>{f}</Typography>
                <Typography role="cell" variant="body2" color="text.secondary" sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>{n}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Section>

      {/* ---------- Fitur native ---------- */}
      <Section top>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.15fr' }, gap: { xs: 5, md: 8 }, alignItems: 'start' }}>
          <Box>
            <Eyebrow sx={{ mb: 1.5 }}>Fitur native</Eyebrow>
            <Typography variant="h2" sx={{ mb: 1.5 }}>Kemampuan HP, dari JavaScript Anda.</Typography>
            <Typography variant="subtitle1" sx={{ mb: 3.5 }}>
              Lebih dari 60 API lewat <code>window.Apkify</code>. Hanya SDK fitur yang Anda pilih yang ikut ke aplikasi, jadi ukurannya tetap kecil.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 3 }}>
              {[['Hardware', 'NFC, Bluetooth, USB, sensor'], ['Pemindai', 'Dokumen, OCR, QR, wajah'], ['Lokasi', 'Geofence, deteksi Fake GPS'], ['Notifikasi', 'Lokal, terjadwal, latar'], ['Media', 'Audio latar, PiP, Cast'], ['Bisnis', 'Kiosk, scanner Zebra, MDM']].map(([t, d]) => (
                <Box key={t} sx={{ py: 1.5, borderTop: 1, borderColor: 'divider' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{t}</Typography>
                  <Typography variant="caption" component="div">{d}</Typography>
                </Box>
              ))}
            </Box>
            <Button component={RouterLink} to="/docs/api" variant="outlined" sx={{ mt: 3.5 }} endIcon={<ArrowForwardIcon />}>Referensi API</Button>
          </Box>
          <Box>
            <Tabs value={snip} onChange={(_, v) => setSnip(v)} aria-label="Contoh kode" sx={{ mb: 2 }}>
              {Object.entries(SNIPPETS).map(([k, [l]]) => <Tab key={k} value={k} label={l} />)}
            </Tabs>
            <CodeBlock sx={{ minHeight: 196 }}>{SNIPPETS[snip][1]}</CodeBlock>
            <Typography variant="caption" component="div" sx={{ mt: 1.5 }}>Setiap fungsi mengembalikan Promise <code>{'{ ok, … }'}</code> dan aman dipanggil di browser biasa.</Typography>
          </Box>
        </Box>
      </Section>

      {/* ---------- Alasan ---------- */}
      <Section top>
        <SectionTitle eyebrow="Mengapa Apkify" title="Detail yang biasanya berbayar, di sini bawaan." />
        <RuleList items={REASONS} cols={{ xs: 1, sm: 2, md: 3 }} />
      </Section>

      {/* ---------- Ajakan ---------- */}
      <Container maxWidth="lg">
        <Box sx={(t) => ({
          bgcolor: t.tokens.inverse, color: t.tokens.inverseText, borderRadius: 3, px: { xs: 3, md: 6 }, py: { xs: 5, md: 7 },
          display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.5fr 1fr' }, gap: 4, alignItems: 'center', position: 'relative', overflow: 'hidden'
        })}>
          <Box>
            <Typography variant="h2" sx={{ color: 'inherit' }}>Build pertama Anda, beberapa menit dari sekarang.</Typography>
            <Typography sx={{ mt: 1.5, opacity: 0.7, maxWidth: 480 }}>Tanpa akun pun bisa. Daftar gratis untuk menyimpan aplikasi, riwayat build, dan keystore secara permanen.</Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} justifyContent={{ md: 'flex-end' }}>
            <Button component={RouterLink} to="/create" variant="contained" size="large" endIcon={<ArrowForwardIcon />}>Buat aplikasi</Button>
            <Button component={RouterLink} to="/tools" size="large" sx={(t) => ({ color: 'inherit', border: 1, borderColor: alpha(t.tokens.inverseText, 0.25), '&:hover': { bgcolor: alpha(t.tokens.inverseText, 0.08) } })}>Tools Play Store</Button>
          </Stack>
        </Box>
      </Container>
    </>
  );
}
