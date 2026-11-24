// Panduan per platform: langkah spesifik mengubah situs/proyek menjadi APK.
export const GUIDES = [
  {
    id: 'wordpress', name: 'WordPress', source: 'url',
    intro: 'Situs WordPress paling mudah dikonversi lewat alamat website.',
    steps: [
      'Pastikan situs memakai HTTPS (plugin Really Simple SSL atau SSL dari hosting).',
      'Gunakan tema responsif dan cek tampilan di HP (Appearance → Customize → pratinjau mobile).',
      'Matikan pop-up atau banner cookie yang menutupi layar penuh di mobile.',
      'Di Apkify pilih tab Website, isi alamat situs, aktifkan “Tarik untuk refresh” dan “Link luar dibuka di browser”.',
      'Untuk WooCommerce: aktifkan “Upload file” bila pelanggan perlu mengunggah bukti transfer.',
      'Isi Akhiran User-Agent (mis. ApkifyApp) bila ingin menyembunyikan elemen tertentu khusus di aplikasi lewat CSS/JS.'
    ]
  },
  {
    id: 'shopify', name: 'Shopify', source: 'url',
    intro: 'Toko Shopify dikonversi lewat domain toko Anda.',
    steps: [
      'Gunakan domain toko (mis. tokoanda.com atau tokoanda.myshopify.com).',
      'Checkout Shopify berjalan di domain checkout yang sama — biarkan tetap di dalam aplikasi dengan menonaktifkan “Link luar dibuka di browser” bila checkout terbuka ke browser.',
      'Aktifkan menu samping untuk tautan Instagram/WhatsApp toko.',
      'Aktifkan OneSignal untuk notifikasi promo.'
    ]
  },
  {
    id: 'wix', name: 'Wix', source: 'url',
    intro: 'Situs Wix bisa dikonversi selama sudah dipublikasikan.',
    steps: [
      'Publikasikan situs dan aktifkan tampilan mobile di Wix Editor (ikon HP di bagian atas).',
      'Salin URL publik situs (domain sendiri atau username.wixsite.com/nama).',
      'Buat aplikasi lewat tab Website. Wix memuat banyak skrip; pilih mode cache “Utamakan cache” agar pembukaan berikutnya lebih cepat.'
    ]
  },
  {
    id: 'webflow', name: 'Webflow', source: 'url',
    intro: 'Publikasikan dulu proyek Webflow, lalu gunakan alamatnya.',
    steps: [
      'Publish ke domain .webflow.io atau domain sendiri.',
      'Atur breakpoint mobile portrait dengan rapi di Designer.',
      'Alternatif offline: Export code (paket berbayar) → zip foldernya → pilih tab ZIP.'
    ]
  },
  {
    id: 'lovable', name: 'Lovable', source: 'zip',
    intro: 'Proyek Lovable adalah React + Vite, bisa sebagai URL atau ZIP offline.',
    steps: [
      'Cara cepat: klik Publish di Lovable, salin URL .lovable.app, pakai tab Website.',
      'Cara offline: sinkronkan ke GitHub lalu unduh ZIP repositori (Code → Download ZIP) — tanpa perlu build sendiri.',
      'Unggah ZIP itu di tab ZIP: Apkify menjalankan npm install + npm run build otomatis. BrowserRouter tetap berjalan, tidak perlu diganti.',
      'Butuh fitur HP (NFC, printer, OCR, notifikasi)? Aktifkan di “Fitur native lengkap” dan panggil window.Apkify dari kode React.',
      'Jika memakai Supabase, tambahkan https://appassets.androidplatform.net ke daftar URL yang diizinkan (Auth → URL Configuration).'
    ]
  },
  {
    id: 'bolt', name: 'Bolt.new', source: 'zip',
    intro: 'Bolt menghasilkan proyek Vite yang bisa di-deploy atau diunduh.',
    steps: [
      'Deploy ke Netlify dari Bolt lalu pakai URL-nya, ATAU unduh proyek (Download).',
      'Untuk ZIP: set base: "./" di vite.config, gunakan HashRouter, npm run build, zip isi dist.'
    ]
  },
  {
    id: 'v0', name: 'v0 (Vercel)', source: 'url',
    intro: 'Proyek v0 berbasis Next.js — paling mudah lewat URL deploy Vercel.',
    steps: [
      'Klik Deploy di v0 dan salin URL .vercel.app (atau domain sendiri).',
      'Untuk offline, aktifkan output: "export" di next.config, set images.unoptimized: true, assetPrefix: "./", build, lalu zip folder out.'
    ]
  },
  {
    id: 'replit', name: 'Replit', source: 'url',
    intro: 'Gunakan URL deployment Replit, bukan URL editor.',
    steps: [
      'Buat Deployment (Autoscale/Static) agar aplikasi selalu aktif.',
      'Salin URL .replit.app dan pakai tab Website.',
      'Proyek statis: unduh sebagai ZIP dan pastikan index.html ada di folder utama.'
    ]
  },
  {
    id: 'blogger', name: 'Blogger', source: 'url',
    intro: 'Blog Blogger dikonversi lewat alamat blog.',
    steps: [
      'Settings → HTTPS → aktifkan HTTPS redirect.',
      'Theme → Customize → Mobile: pilih tema responsif.',
      'Buat aplikasi lewat tab Website dan aktifkan menu samping untuk halaman Tentang/Kontak.'
    ]
  },
  {
    id: 'google-sites', name: 'Google Sites', source: 'url',
    intro: 'Google Sites hanya bisa lewat URL publik.',
    steps: [
      'Publish situs dengan akses “Siapa saja”.',
      'Salin URL sites.google.com/view/nama dan pakai tab Website.',
      'Nonaktifkan “Link luar dibuka di browser” bila halaman internal Google Sites ikut terbuka ke browser.'
    ]
  },
  {
    id: 'google-ai-studio', name: 'Google AI Studio', source: 'zip',
    intro: 'Aplikasi dari Google AI Studio (Build) berbasis React dan bisa dijadikan APK.',
    steps: [
      'Klik Deploy (Cloud Run) dan pakai URL-nya di tab Website, ATAU unduh kode (Download app).',
      'Untuk ZIP: npm install, set base: "./" di vite.config, npm run build, zip ISI folder dist.',
      'Kunci API Gemini jangan disimpan di kode klien — panggil lewat server/proxy Anda sendiri.'
    ]
  },
  {
    id: 'base44', name: 'Base44', source: 'url',
    intro: 'Aplikasi Base44 dihosting otomatis — pakai URL publiknya.',
    steps: [
      'Publish aplikasi di Base44 dan pastikan akses publik (atau login di dalam aplikasi).',
      'Salin URL aplikasi dan pilih tab Website.',
      'Aktifkan “Sembunyikan UA WebView” bila login berbasis Google bermasalah, atau gunakan login email.'
    ]
  },
  {
    id: 'framer', name: 'Framer', source: 'url',
    intro: 'Situs Framer dikonversi lewat domain yang sudah dipublikasikan.',
    steps: [
      'Publish ke domain .framer.website atau domain sendiri.',
      'Cek breakpoint Phone di Framer agar tampilan HP rapi.',
      'Animasi berat? Pilih indikator loading “Lingkaran di tengah” dan mode cache tinggi.'
    ]
  },
  {
    id: 'bubble', name: 'Bubble', source: 'url',
    intro: 'Aplikasi Bubble berjalan di URL live (bukan versi test).',
    steps: [
      'Deploy ke Live, lalu pakai URL tanpa /version-test.',
      'Atur halaman responsif (Responsive engine) untuk lebar HP.',
      'Aktifkan upload file & kamera bila aplikasi memakai Picture/File Uploader.'
    ]
  },
  {
    id: 'squarespace', name: 'Squarespace', source: 'url',
    intro: 'Situs Squarespace bisa dikonversi lewat domain publik.',
    steps: [
      'Pastikan situs tidak memakai Site-wide password (atau gunakan login member).',
      'Salin domain situs dan pilih tab Website.',
      'Aktifkan menu samping untuk tautan media sosial & kontak.'
    ]
  },
  {
    id: 'godaddy', name: 'GoDaddy Website Builder', source: 'url',
    intro: 'Situs GoDaddy Websites + Marketing memakai domain yang sudah terhubung.',
    steps: [
      'Publish situs dan pastikan domain sudah aktif HTTPS.',
      'Pakai alamat domain di tab Website.',
      'Untuk toko online GoDaddy, aktifkan unduh file dan link luar ke browser untuk pembayaran.'
    ]
  },
  {
    id: 'html5-game', name: 'Game HTML5', source: 'zip',
    intro: 'Game HTML5 (Phaser, Construct, GDevelop, Godot Web) cocok dibundel offline.',
    steps: [
      'Ekspor game sebagai HTML5/Web, lalu zip ISI folder ekspor (index.html di root).',
      'Atur orientasi (lanskap/potret), aktifkan layar penuh dan layar tetap menyala.',
      'Matikan tarik untuk refresh dan seleksi teks agar tidak mengganggu kontrol sentuh.',
      'Ukuran besar? Batas ZIP 50 MB — kompres audio ke OGG/MP3 dan gambar ke WebP.'
    ]
  },
  {
    id: 'any-builder', name: 'Builder lainnya', source: 'url',
    intro: 'Hampir semua website builder bisa dikonversi selama punya URL publik HTTPS.',
    steps: [
      'Publikasikan situs dan salin URL publiknya.',
      'Uji URL di browser HP — yang tampil di sana itulah yang tampil di aplikasi.',
      'Bisa mengekspor HTML? Zip hasil ekspor dan pakai tab ZIP agar berjalan offline.'
    ]
  },
  {
    id: 'react-vite', name: 'React / Vue / Vite', source: 'zip',
    intro: 'Proyek SPA sendiri paling cocok dibundel offline lewat ZIP.',
    steps: [
      'Set base: "./" di vite.config.js (Vue CLI: publicPath: "./").',
      'Gunakan hash routing (HashRouter / createWebHashHistory).',
      'npm run build, lalu zip ISI folder dist (index.html di level teratas).',
      'API eksternal harus mengizinkan CORS dari https://appassets.androidplatform.net.'
    ]
  },
  {
    id: 'html', name: 'HTML statis', source: 'html',
    intro: 'Satu halaman HTML (landing page, kalkulator, kuis) bisa langsung ditempel.',
    steps: [
      'Gabungkan CSS dan JS ke dalam satu file (tag <style> dan <script>).',
      'Pilih tab HTML, tempel kode, lalu build.',
      'Lebih dari satu file? Zip semuanya dan gunakan tab ZIP.'
    ]
  }
];
