import { useMemo, useState } from 'react';
import { Container, Typography, Card, CardContent, Stack, TextField, Grid, MenuItem, Button, Snackbar } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Alert } from '@mui/material';

/** Pemeriksaan otomatis berdasarkan pedoman metadata Google Play (ringkas). */
function policyCheck(name, short, full) {
  const w = [];
  const promo = /\b(terbaik|nomor\s*1|#1|no\.?\s*1|top\s*1|gratis|free|diskon|promo|sale|murah|terlaris|best|top)\b/i;
  if (promo.test(name)) w.push(['error', 'Nama aplikasi memuat kata promosi/peringkat (mis. “terbaik”, “#1”, “gratis”, “diskon”) — dilarang di nama.']);
  if (promo.test(short)) w.push(['warning', 'Deskripsi singkat memuat kata promosi/peringkat — hindari klaim performa atau harga.']);
  if (/[A-Z]{6,}/.test(name) || (name.length > 4 && name === name.toUpperCase())) w.push(['warning', 'Nama memakai huruf kapital berlebihan.']);
  const emoji = /\p{Extended_Pictographic}/u;
  if (emoji.test(name)) w.push(['error', 'Nama aplikasi tidak boleh berisi emoji.']);
  if (emoji.test(short)) w.push(['warning', 'Hindari emoji di deskripsi singkat.']);
  if (/(https?:\/\/|www\.|@\w+\.\w+|\b0?8\d{8,11}\b|\+62)/i.test(short)) w.push(['warning', 'Deskripsi singkat memuat URL/kontak — letakkan di deskripsi lengkap.']);
  if (/[!?]{2,}/.test(name + short)) w.push(['warning', 'Tanda baca berulang (!!, ??) dianggap spam.']);
  const words = full.toLowerCase().match(/[a-z\u00c0-\u024f]{4,}/g) || [];
  const freq = {};
  words.forEach((x) => { freq[x] = (freq[x] || 0) + 1; });
  const stuffed = Object.entries(freq).filter(([, n]) => words.length > 40 && n / words.length > 0.05).map(([x]) => x);
  if (stuffed.length) w.push(['warning', `Kemungkinan keyword stuffing: “${stuffed.slice(0, 3).join('”, “')}” terlalu sering diulang.`]);
  if (/(whatsapp|instagram|tiktok|facebook|google|shopee|tokopedia)/i.test(name)) w.push(['warning', 'Nama memuat merek pihak lain — pastikan Anda berhak memakainya.']);
  if (name.length > 30) w.push(['error', 'Nama lebih dari 30 karakter.']);
  if (short.length > 80) w.push(['error', 'Deskripsi singkat lebih dari 80 karakter.']);
  if (full.length > 4000) w.push(['error', 'Deskripsi lengkap lebih dari 4000 karakter.']);
  return w;
}

const TPL = {
  shop: {
    label: 'Toko online',
    short: (v) => `Belanja ${v.product} di ${v.name} — mudah, cepat, dan aman langsung dari HP.`,
    full: (v) => `${v.name} memudahkan Anda belanja ${v.product} kapan saja dan di mana saja.\n\nKENAPA ${v.name.toUpperCase()}?\n${v.features.map((x) => `• ${x}`).join('\n')}\n\nCARA BELANJA\n1. Pilih produk favorit\n2. Masukkan ke keranjang\n3. Bayar dan tunggu pesanan tiba\n\nButuh bantuan? Hubungi kami di ${v.contact}.\n\nUnduh ${v.name} sekarang dan nikmati promo khusus pengguna aplikasi!`
  },
  news: {
    label: 'Berita / blog',
    short: (v) => `Baca ${v.product} terbaru dari ${v.name} — ringan, cepat, dan selalu terkini.`,
    full: (v) => `${v.name} menghadirkan ${v.product} terkini langsung ke genggaman Anda.\n\nFITUR UNGGULAN\n${v.features.map((x) => `• ${x}`).join('\n')}\n\nAktifkan notifikasi agar tidak ketinggalan kabar penting.\n\nSaran dan masukan: ${v.contact}`
  },
  edu: {
    label: 'Edukasi / sekolah',
    short: (v) => `Belajar ${v.product} lebih seru bersama ${v.name}, kapan saja dan di mana saja.`,
    full: (v) => `${v.name} adalah aplikasi untuk belajar ${v.product} dengan cara yang mudah dipahami.\n\nAPA YANG BISA ANDA LAKUKAN\n${v.features.map((x) => `• ${x}`).join('\n')}\n\nCocok untuk siswa, mahasiswa, guru, dan orang tua.\n\nHubungi kami: ${v.contact}`
  },
  service: {
    label: 'Jasa / layanan lokal',
    short: (v) => `Pesan ${v.product} dari ${v.name} hanya dengan beberapa ketukan.`,
    full: (v) => `Butuh ${v.product}? ${v.name} siap membantu.\n\nLAYANAN KAMI\n${v.features.map((x) => `• ${x}`).join('\n')}\n\nPemesanan mudah, harga transparan, dan tim yang responsif.\n\nKontak: ${v.contact}`
  },
  tool: {
    label: 'Alat / utilitas',
    short: (v) => `${v.name}: ${v.product} praktis, ringan, dan bisa dipakai offline.`,
    full: (v) => `${v.name} adalah ${v.product} yang sederhana namun bertenaga.\n\nFITUR\n${v.features.map((x) => `• ${x}`).join('\n')}\n\nTanpa registrasi, ringan, dan hemat baterai.\n\nMasukan: ${v.contact}`
  }
};

export default function DescriptionTemplates() {
  const [tpl, setTpl] = useState('shop');
  const [v, setV] = useState({ name: 'Toko Saya', product: 'kebutuhan harian', features: 'Gratis ongkir area tertentu\nPembayaran transfer & e-wallet\nLacak pesanan real-time', contact: 'halo@tokosaya.com' });
  const [copied, setCopied] = useState(false);

  const out = useMemo(() => {
    const vals = { ...v, features: v.features.split('\n').map((s) => s.trim()).filter(Boolean) };
    return { short: TPL[tpl].short(vals), full: TPL[tpl].full(vals) };
  }, [tpl, v]);
  const copy = (t) => { navigator.clipboard?.writeText(t); setCopied(true); };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Description Templates</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Isi data aplikasi, pilih jenis, lalu salin deskripsi singkat (≤80) dan lengkap (≤4000 karakter) untuk Play Console.</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Card><CardContent><Stack spacing={2}>
            <TextField select label="Jenis aplikasi" value={tpl} onChange={(e) => setTpl(e.target.value)}>
              {Object.entries(TPL).map(([k, t]) => <MenuItem key={k} value={k}>{t.label}</MenuItem>)}
            </TextField>
            <TextField label="Nama aplikasi" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
            <TextField label="Produk / topik / layanan" value={v.product} onChange={(e) => setV({ ...v, product: e.target.value })} />
            <TextField label="Fitur (satu per baris)" multiline minRows={4} value={v.features} onChange={(e) => setV({ ...v, features: e.target.value })} />
            <TextField label="Kontak (email/WA)" value={v.contact} onChange={(e) => setV({ ...v, contact: e.target.value })} />
          </Stack></CardContent></Card>
        </Grid>
        <Grid item xs={12} md={7}>
          <Stack spacing={2}>
            <Card><CardContent>
              <Stack direction="row" alignItems="center"><Typography fontWeight={700} sx={{ flex: 1 }}>Deskripsi singkat</Typography>
                <Typography variant="caption" color={out.short.length > 80 ? 'error' : 'text.secondary'}>{out.short.length}/80</Typography>
                <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => copy(out.short)}>Salin</Button></Stack>
              <Typography sx={{ mt: 1 }}>{out.short}</Typography>
            </CardContent></Card>
            <Card><CardContent>
              <Stack direction="row" alignItems="center"><Typography fontWeight={700} sx={{ flex: 1 }}>Deskripsi lengkap</Typography>
                <Typography variant="caption" color={out.full.length > 4000 ? 'error' : 'text.secondary'}>{out.full.length}/4000</Typography>
                <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => copy(out.full)}>Salin</Button></Stack>
              <Typography sx={{ mt: 1, whiteSpace: 'pre-line' }}>{out.full}</Typography>
            </CardContent></Card>
            <Card><CardContent>
              <Typography fontWeight={700} gutterBottom>Cek kebijakan otomatis</Typography>
              {(() => { const w = policyCheck(v.name, out.short, out.full); return w.length
                ? <Stack spacing={1}>{w.map(([sev, m]) => <Alert key={m} severity={sev}>{m}</Alert>)}</Stack>
                : <Alert severity="success">Tidak ditemukan masalah umum. Tetap tinjau Kebijakan Metadata Google Play sebelum publikasi.</Alert>; })()}
            </CardContent></Card>
          </Stack>
        </Grid>
      </Grid>
      <Snackbar open={copied} autoHideDuration={1500} onClose={() => setCopied(false)} message="Disalin" />
    </Container>
  );
}
