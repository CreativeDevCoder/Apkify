import { Link as RouterLink } from 'react-router-dom';
import { Container, Typography, Box, Alert, Link } from '@mui/material';

const APP = import.meta.env.VITE_APP_NAME || 'Apkify';
const EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'halo@domainanda.com';
const UPDATED = '22 November 2026';

// Teks dasar — sesuaikan dengan entitas & praktik Anda, dan konsultasikan dengan ahli hukum sebelum dipakai.
const PRIVACY = [
  ['Siapa kami', `${APP} adalah layanan untuk mengubah website, file ZIP, atau HTML menjadi aplikasi Android. Kebijakan ini menjelaskan data apa yang kami kumpulkan, untuk apa, dan hak Anda, sejalan dengan UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).`],
  ['Data yang kami kumpulkan', [
    'Data akun: email, nama, foto profil (dari Google/GitHub bila Anda memilihnya). Mode tamu tidak meminta data identitas.',
    'Konten yang Anda unggah: alamat website, file ZIP/HTML, ikon, gambar splash, keystore, listing marketplace, dan situs hosting.',
    'Data teknis: konfigurasi aplikasi, riwayat build, alamat IP dalam bentuk hash (untuk batas pemakaian dan anti-penyalahgunaan), serta log server singkat.',
    'Pesan yang Anda kirim lewat formulir kontak.'
  ]],
  ['Untuk apa data dipakai', [
    'Membangun, menyimpan, dan mengirimkan aplikasi Anda (APK/AAB).',
    'Mengirim email transaksional (status build, pesan kontak). Kami tidak mengirim email pemasaran tanpa persetujuan.',
    'Menjaga keamanan layanan: batas pemakaian, deteksi penyalahgunaan, dan moderasi marketplace.',
    'Menjalankan fitur AI Studio: deskripsi yang Anda tulis diproses oleh penyedia model AI untuk menghasilkan kode.'
  ]],
  ['Pihak ketiga yang memproses data', [
    'Google Firebase (autentikasi & database), Cloudflare (hosting, API, AI, penyimpanan), GitHub Actions (proses build).',
    'Penyedia penyimpanan file dan penyedia email transaksional yang kami pakai secara bergantian.',
    'Data hanya dibagikan sebatas yang diperlukan untuk menjalankan layanan. Kami tidak menjual data pribadi.'
  ]],
  ['Keamanan', [
    'Keystore disimpan terenkripsi AES-256-GCM; file sumber ZIP/HTML bersifat privat.',
    'File hasil build (APK/AAB) dapat diunduh siapa pun yang memiliki tautannya — jangan sebarkan tautan bila aplikasi bersifat rahasia.',
    'Log build di GitHub Actions publik tidak memuat rahasia, tetapi dapat menampilkan nama aplikasi dan package name.'
  ]],
  ['Penyimpanan & penghapusan', [
    'Data disimpan selama akun aktif. Menghapus aplikasi dari dashboard juga menghapus file hasil build-nya.',
    'Sesi tamu dapat hilang bila data browser dihapus.',
    `Anda dapat meminta salinan atau penghapusan data akun dengan menghubungi ${EMAIL}. Kami merespons dalam waktu wajar sesuai ketentuan UU PDP.`
  ]],
  ['Hak Anda', 'Anda berhak mengakses, memperbaiki, menghapus, dan menarik persetujuan atas pemrosesan data pribadi Anda, serta mengajukan keberatan. Hubungi kami untuk menggunakan hak tersebut.'],
  ['Aplikasi yang Anda buat', `Aplikasi yang dibuat dengan ${APP} adalah milik Anda. Anda bertanggung jawab menyediakan kebijakan privasi sendiri untuk pengguna aplikasi tersebut (wajib di Google Play), termasuk bila memakai AdMob, OneSignal, Tawk, atau Supabase.`],
  ['Cookie & penyimpanan lokal', 'Kami memakai penyimpanan lokal browser untuk sesi login, preferensi tampilan, dan cache data agar situs lebih cepat. Kami tidak memakai cookie iklan pihak ketiga.'],
  ['Perubahan kebijakan', 'Perubahan penting akan diumumkan di situs ini. Tanggal pembaruan terakhir tercantum di atas.']
];

const TERMS = [
  ['Penerimaan', `Dengan memakai ${APP}, Anda menyetujui ketentuan ini. Jika tidak setuju, jangan gunakan layanan.`],
  ['Layanan', `${APP} menyediakan alat untuk membuat aplikasi Android dari konten Anda, beserta tools pendukung, AI Studio, hosting, dan marketplace. Layanan gratis disediakan “sebagaimana adanya” dengan batas pemakaian wajar yang dapat berubah.`],
  ['Akun', 'Anda bertanggung jawab menjaga keamanan akun dan semua aktivitas di dalamnya. Satu orang tidak boleh membuat banyak akun untuk menghindari batas pemakaian.'],
  ['Konten Anda', [
    'Anda menjamin memiliki hak atas semua konten yang diunggah atau dikonversi (website, merek, gambar, musik, video, dokumen).',
    'Dilarang membuat aplikasi untuk: phishing, malware, penipuan, perjudian ilegal, konten seksual anak, ujaran kebencian, peniruan merek/instansi, atau pelanggaran hak cipta.',
    'Kami berhak menolak build, menghapus konten, menurunkan situs hosting, atau menonaktifkan akun yang melanggar, tanpa pemberitahuan sebelumnya.'
  ]],
  ['Google Play & pihak ketiga', 'Publikasi aplikasi tunduk pada kebijakan Google Play. Kami tidak menjamin aplikasi Anda diterima Google. Penggunaan AdMob, OneSignal, Tawk, Supabase, dan layanan lain tunduk pada ketentuan masing-masing penyedia.'],
  ['Keystore', 'Unduh dan simpan cadangan keystore Anda. Kami berupaya menjaga data tetap aman, tetapi tidak bertanggung jawab atas kerugian akibat hilangnya keystore yang tidak Anda cadangkan.'],
  ['AI Studio', 'Kode hasil AI dapat mengandung kesalahan. Anda wajib memeriksa dan menguji aplikasi sebelum dipublikasikan.'],
  ['Marketplace', [
    `${APP} hanya menyediakan papan iklan. Transaksi terjadi langsung antara pembeli dan penjual; kami bukan pihak dalam transaksi dan tidak memegang dana.`,
    'Penjual bertanggung jawab atas kebenaran informasi listing. Gunakan rekening bersama dan verifikasi kepemilikan sebelum membayar.'
  ]],
  ['Hosting', 'Situs yang dihosting tunduk pada aturan konten yang sama. Kami dapat membatasi atau menghapus situs yang membebani sistem atau melanggar ketentuan.'],
  ['Batasan tanggung jawab', 'Sejauh diizinkan hukum, kami tidak bertanggung jawab atas kerugian tidak langsung, kehilangan pendapatan, atau data akibat penggunaan layanan.'],
  ['Hukum yang berlaku', 'Ketentuan ini diatur oleh hukum Republik Indonesia.'],
  ['Kontak', `Pertanyaan tentang ketentuan ini: ${EMAIL}.`]
];

export default function Legal({ type = 'privacy' }) {
  const privacy = type === 'privacy';
  const sections = privacy ? PRIVACY : TERMS;
  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Typography variant="h3" sx={{ fontSize: { xs: 30, md: 40 } }} gutterBottom>{privacy ? 'Kebijakan Privasi' : 'Syarat & Ketentuan'}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Terakhir diperbarui: {UPDATED}</Typography>
      {sections.map(([h, body], i) => (
        <Box key={h} sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>{i + 1}. {h}</Typography>
          {Array.isArray(body)
            ? <Box component="ul" sx={{ pl: 3, m: 0 }}>{body.map((b) => <li key={b}><Typography sx={{ mb: 0.5 }}>{b}</Typography></li>)}</Box>
            : <Typography>{body}</Typography>}
        </Box>
      ))}
      <Alert severity="info" sx={{ mt: 4 }}>
        Lihat juga {privacy ? <Link component={RouterLink} to="/terms">Syarat & Ketentuan</Link> : <Link component={RouterLink} to="/privacy">Kebijakan Privasi</Link>}.
      </Alert>
    </Container>
  );
}
