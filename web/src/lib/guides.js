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
      'Cara offline: sinkronkan ke GitHub, clone, ubah vite.config.ts menjadi base: "./".',
      'Ganti BrowserRouter menjadi HashRouter agar navigasi berjalan dari aset lokal.',
      'Jalankan npm install && npm run build, lalu zip ISI folder dist dan unggah lewat tab ZIP.',
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
