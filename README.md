# Apkify — Website/ZIP/HTML ke APK & AAB (adopsi freewebtoapk.com)

Platform gratis untuk mengubah **website, ZIP (hasil build React/Vite/Vue), atau HTML** menjadi aplikasi Android **APK + AAB** bertanda tangan, siap Google Play — **tanpa VPS**.

| Lapisan | Teknologi | Biaya |
|---|---|---|
| Frontend | React + Vite + MUI (JSX), PWA → **Cloudflare Pages** | Gratis |
| API | **Cloudflare Workers** (JS) | Gratis (100rb req/hari) |
| Database | **Firebase Realtime Database** | Spark (gratis) |
| Login | **Firebase Auth**: Email/Password, Google, GitHub | Gratis |
| Build Android | **GitHub Actions** (repo publik = menit gratis) | Gratis |
| Email | **10 penyedia berbeda**, rotasi otomatis | Paket gratis |
| Penyimpanan file | **10 drive berbeda**, rotasi otomatis | Paket gratis |

---

## 1. Hasil analisa freewebtoapk.com & apa yang diadopsi

| Fitur referensi | Di Apkify |
|---|---|
| Sumber: Website / ZIP / HTML | ✅ 3 tab yang sama; ZIP ber-folder tunggal (mis. `dist/`) otomatis dinaikkan |
| Kustom nama, ikon (upload/generate), splash, warna | ✅ + warna status bar, orientasi, mode cache WebView |
| AdMob, OneSignal, menu samping (About/Contact/Share/sosial) | ✅ AdMob & OneSignal hanya ikut ter-bundle bila diaktifkan (APK lebih kecil) |
| APK + AAB dari satu build | ✅ |
| Kunci sama per package name agar update mulus | ✅ keystore per package, AES-256-GCM, bisa diunduh pemilik |
| Gratis, tanpa watermark | ✅ (batas build harian per akun untuk anti-abuse, diatur admin) |
| Free tools Play Store (9) | ✅ Icon Resizer, Feature Graphic, Screenshot Mockups, Promo Video & GIF, Color Palette, Listing Preview, Description Templates, Play Listing Checklist, QR Code |
| Docs / Publishing guide / FAQ / Pricing | ✅ dengan pencarian |
| Templates, Compare, Features, About, Contact, News | ✅ (News dikelola dari Admin; Contact → email admin + inbox Admin) |
| Panduan per platform | ✅ WordPress, Shopify, Wix, Webflow, Lovable, Bolt, v0, Replit, Blogger, Google Sites, React/Vite, HTML |
| Enkripsi halaman bundel | ✅ AES-256-GCM per build, didekripsi saat dimuat di WebView |
| AI Studio (kredit “Mints”) | ✅ Workers AI, kredit harian per akun + batas global |
| Buy & Sell Apps | ✅ Marketplace dengan moderasi admin; transaksi langsung antar pengguna |
| Studio cloud | ✅ Dashboard “Studio — Aplikasi Saya” |
| Aplikasi Android pendamping | ✅ Halaman /get-app (PWA install + link APK/Play dari build Apkify sendiri) |
| Tanpa login | ✅ Mode tamu (Firebase Anonymous Auth) dengan batas per sesi & per IP; bisa ditautkan ke akun tanpa kehilangan aplikasi |

Tambahan dibanding referensi: dashboard “Aplikasi Saya”, riwayat build, update versi (versionCode otomatis naik), status build realtime + QR unduh, notifikasi email, halaman offline, panel admin untuk kuota 10 email & 10 drive.

### Fitur ala Website 2 APK Builder Pro (rilis 3)
Splash kustom + durasi + pratinjau, skema warna Material (utama/gelap/aksen), indikator loading (garis/lingkaran/tanpa), toolbar + judul live + tombol Home, konfirmasi keluar dengan teks sendiri, halaman error HTML sendiri, pilihan izin (kamera, mikrofon, lokasi, getar), mode cache 3 tingkat, User-Agent (sembunyikan WebView/Mobile, mode desktop), zoom & tombol zoom, scrollbar, seleksi teks, simpan form, larang screenshot, hanya-HTTPS, akses file, cross-origin untuk konten lokal, deep linking, pop-up blocker, JavaScript API (`window.Apkify`), kode versi manual, dan **keystore sendiri** (Keystore & Signing).

### Fitur AppMint yang diadopsi (rilis 3)
AI App Builder (+ opsi backend Supabase), hosting subdomain HTTPS gratis, aplikasi dokumen/audio/video/foto (Media App Maker), Remote Update (pesan, paksa update, konten OTA), keystore sendiri, plugin native lewat JavaScript API, dan tombol dukungan/donasi. *Penjualan dalam aplikasi* tersedia sebagai template katalog + checkout WhatsApp; Google Play Billing untuk barang digital belum didukung.

## 2. Arsitektur

```
Browser (Pages, PWA) ──Firebase Auth──► ID token
   │  RTDB (baca data milik sendiri)
   └─► Worker /api/*  ── verifikasi token (jose, JWKS di-cache)
         ├─ RTDB REST (service account, token di-cache)
         ├─ 10 drive  (rotasi berdasarkan % pemakaian)
         ├─ 10 email  (rotasi berdasarkan prioritas & kuota harian/bulanan)
         └─ GitHub API: workflow_dispatch(build_id)
                 │
      GitHub Actions (builder) ── ambil config/ikon/ZIP dari Worker (BUILDER_SECRET)
                 ├─ generate proyek Android (Kotlin WebView) + ikon/splash (sharp)
                 ├─ keystore: pakai lama / buat baru → simpan terenkripsi via Worker
                 ├─ gradle assembleRelease bundleRelease
                 └─ upload APK & AAB → Worker → drive; finish → email ke user
```

Struktur folder:
```
web/       Frontend React (Cloudflare Pages)
worker/    API Cloudflare Worker
builder/   Script & template Android untuk GitHub Actions (.github/workflows/build-apk.yml)
database.rules.json   Rules RTDB
```

### Skema RTDB (denormalisasi, mudah dipindah ke PostgreSQL)
| Path | Isi | Akses klien |
|---|---|---|
| `users/{uid}` | profil | baca/tulis sendiri |
| `apps/{uid}/{appId}` | ringkasan + config terakhir | baca sendiri |
| `builds/{buildId}` | status, fileId APK/AAB | baca pemilik/admin |
| `userBuilds/{uid}/{buildId}` | indeks riwayat | baca sendiri |
| `buildConfigs/{buildId}` | config lengkap (dihapus saat selesai) | ❌ |
| `files/{fileId}` | provider, ref, ukuran, owner | ❌ |
| `packages/{pkg}` | uid pemilik package name | ❌ |
| `keystores/{pkg}` | keystore terenkripsi | ❌ |
| `quota/{uid}/{yyyymmdd}` | jumlah build harian | ❌ |
| `providerUsage/*`, `config/*` | kuota & konfigurasi penyedia | admin |
| `stats/public` | total build | publik |

File besar (ikon, ZIP, HTML, APK, AAB) **tidak pernah** masuk RTDB — hanya metadata kecil.

## 3. Strategi cache

| Lapisan | Strategi |
|---|---|
| Aset Vite ber-hash | `Cache-Control: immutable, 1 tahun` (`public/_headers`) + precache service worker |
| `index.html`, `sw.js` | `no-cache` → update tersebar cepat, SW `autoUpdate` |
| Halaman | Code-splitting per route (`React.lazy`), chunk terpisah react/mui/firebase |
| `/api/public/*` | Edge Cache API 5 menit + SW `StaleWhileRevalidate` |
| Unduhan APK/AAB/ikon | File immutable → edge Cache API (stream di-*tee*), `immutable 1 tahun`; unduhan berikutnya **tidak** menyentuh RTDB maupun drive |
| Token OAuth (Firebase SA, Google Drive, Dropbox, OneDrive, Box, SendPulse) | Memori isolate + Cache API per data center, *single-flight* (tanpa kuota tulis KV) |
| JWKS Firebase | Cache memori 6 jam |
| Konfigurasi/kuota penyedia & metadata file | Memo memori 30 dtk–10 mnt |
| Data dashboard di klien | `localStorage` stale-while-revalidate (TTL 2 mnt), `get()` sekali, bukan listener |
| Status build | Listener realtime **hanya** selama build berjalan, otomatis dilepas saat selesai |
| Gradle di GitHub Actions | `gradle/actions/setup-gradle` cache dependency → build ke-2 dst lebih cepat |
| WebView di APK | Mode cache bisa dipilih user: standar / utamakan cache / selalu terbaru |

> Catatan: Cache API Workers **tidak aktif di `*.workers.dev`**. Pasang Worker di domain sendiri (route `domainanda.com/api/*`) agar cache edge bekerja.

## 4. 10 penyedia email & 10 drive

Limit/kapasitas di bawah adalah **perkiraan paket gratis — cek ulang di situs masing-masing** dan sesuaikan dari halaman Admin (angka tersimpan di RTDB, tanpa deploy ulang).

**Email** (HTTP API, berhenti di 90% limit, error → jeda 10 menit & pindah penyedia):
1. Brevo (±300/hari) 2. Resend (±100/hari, 3.000/bln) 3. Mailjet (±200/hari) 4. Mailgun (±100/hari) 5. Postmark (±100/bln) 6. SMTP2GO (±1.000/bln) 7. MailerSend (±500/bln) 8. Elastic Email (±100/hari) 9. Mailtrap Sending (±1.000/bln) 10. SendPulse (±12.000/bln)

**Drive** (pilih % pemakaian terendah, lewati bila >90% atau file melebihi batas per-file):
1. Cloudflare R2 (10 GB, binding) 2. Backblaze B2 (10 GB, S3) 3. Google Drive (15 GB) 4. Dropbox (2 GB) 5. OneDrive (5 GB) 6. Box (10 GB) 7. pCloud (10 GB) 8. Supabase Storage (1 GB) 9. GitHub Releases (aset ≤2 GB) 10. Koofr (10 GB, WebDAV)

Penyedia yang secret-nya belum diisi otomatis dilewati — Anda bisa mulai dari 1 email + R2 saja, lalu menambah bertahap.

## 5. Setup langkah demi langkah

### A. Firebase
1. Buat proyek di console.firebase.google.com.
2. **Authentication → Sign-in method**: aktifkan *Email/Password*, *Google*, *GitHub* (buat OAuth App di GitHub → Settings → Developer settings; callback URL dari Firebase).
3. **Authentication → Settings → Authorized domains**: tambahkan domain Pages Anda.
4. **Realtime Database** → buat (mis. region `asia-southeast1`) → tab *Rules* → tempel `database.rules.json`.
5. **Project settings → Service accounts → Generate new private key** → simpan JSON (dipakai Worker).
6. Jadikan diri Anda admin: di RTDB tambahkan `admins/<UID-anda>: true`.

### A2. Fitur rilis 2
- **Mode tamu:** Firebase Authentication → Sign-in method → aktifkan **Anonymous**.
- **AI Studio:** binding `[ai]` sudah ada di `wrangler.toml` (Workers AI, jatah gratis harian dalam *neurons*). Model diatur lewat `AI_MODEL`; batas kredit di Admin → Pengaturan.
- **Formulir kontak:** isi `ADMIN_EMAIL` di `wrangler.toml` (pesan juga tersimpan di Admin → Pesan kontak).
- **Aplikasi pendamping:** build situs Apkify Anda sendiri lewat Apkify (sumber Website), lalu isi `VITE_COMPANION_APK_URL` (link unduh APK dari halaman build) atau `VITE_COMPANION_PLAY_URL`.
- **Rules RTDB:** tempel ulang `database.rules.json` (ada indeks baru untuk posts, market, messages).

### A3. Fitur rilis 3
- **Hosting subdomain:** isi `HOSTING_DOMAIN` (mis. `apps.domainanda.com`) di `wrangler.toml`, buat DNS wildcard `*.apps` (proxied/oranye) ke domain Anda, dan aktifkan route `*.apps.domainanda.com/*` ke Worker. File situs disimpan di R2.
- **Remote Update:** isi `PUBLIC_API_BASE` (URL publik API) agar aplikasi Android bisa mengecek pesan/paksa update/konten OTA.
- **Halaman legal & donasi:** isi `VITE_CONTACT_EMAIL` dan (opsional) `VITE_DONATE_URL` di `.env` Pages. Teks Privasi/Ketentuan adalah draf — tinjau dengan ahli hukum.

### B. GitHub builder
1. Repo ini (**publik**) sudah berisi workflow `.github/workflows/build-apk.yml` yang memakai `builder/scripts` & `builder/android-template` — tidak perlu repo terpisah.
2. Repo → Settings → Secrets → Actions: `API_BASE` = URL API (mis. `https://apkify.domainanda.com`), `BUILDER_SECRET` = string acak panjang (`openssl rand -hex 32`).
3. Buat **fine-grained token** (Settings → Developer settings) dengan akses repo `CreativeDevCoder/Apkify`: *Actions: Read and write*. Ini `GITHUB_TOKEN` untuk Worker.
4. (Opsional, drive #9) Buat repo terpisah untuk penyimpanan, mis. `username/apkify-files`, + token *Contents: Read and write* → `GHSTORE_REPO`, `GHSTORE_TOKEN`.

### C. Cloudflare Worker
```bash
cd worker
npm install
npx wrangler login
npx wrangler r2 bucket create apkify-files
# edit wrangler.toml: APP_ORIGIN, FIREBASE_*, GITHUB_BUILDER_REPO, EMAIL_FROM, routes
npx wrangler secret put FIREBASE_SA_EMAIL        # client_email dari JSON
npx wrangler secret put FIREBASE_SA_PRIVATE_KEY  # private_key dari JSON (apa adanya)
npx wrangler secret put BUILDER_SECRET           # sama dengan di GitHub
npx wrangler secret put KEYSTORE_ENC_KEY         # openssl rand -base64 32  (SIMPAN cadangannya!)
npx wrangler secret put GITHUB_TOKEN
# lalu secret penyedia email & drive yang Anda pakai (daftar ada di wrangler.toml)
npx wrangler deploy
```

### D. Cloudflare Pages (frontend)
1. Salin `web/.env.example` → `.env`, isi config Firebase. Kosongkan `VITE_API_BASE` bila Worker di route yang sama (`/api/*`).
2. Pages → Create project → hubungkan repo → *Root directory* `web`, *Build command* `npm run build`, *Output* `dist`, tambahkan variabel `VITE_*` di Settings → Environment variables.
3. Hubungkan custom domain, lalu pasang route Worker `domainanda.com/api/*` di domain yang sama.

Pengembangan lokal: `cd worker && npx wrangler dev` (port 8787) dan `cd web && npm run dev` (Vite mem-proxy `/api` ke 8787).

### E. Kredensial penyedia (ringkas)
| Penyedia | Secret | Cara dapat |
|---|---|---|
| Brevo | `BREVO_API_KEY` | SMTP & API → API Keys; verifikasi domain/pengirim |
| Resend | `RESEND_API_KEY` | API Keys; verifikasi domain |
| Mailjet | `MAILJET_API_KEY`, `MAILJET_API_SECRET` | Account → API Key Management |
| Mailgun | `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_REGION` (`us`/`eu`) | Sending → Domains |
| Postmark | `POSTMARK_TOKEN` | Server → API Tokens |
| SMTP2GO | `SMTP2GO_API_KEY` | Sending → API Keys |
| MailerSend | `MAILERSEND_API_KEY` | Integrations → API tokens |
| Elastic Email | `ELASTICEMAIL_API_KEY` | Settings → Create API key |
| Mailtrap | `MAILTRAP_API_TOKEN` | Sending Domains → API token |
| SendPulse | `SENDPULSE_CLIENT_ID`, `SENDPULSE_CLIENT_SECRET` | Account settings → API |
| Backblaze B2 | `B2_KEY_ID`, `B2_APP_KEY`, `B2_BUCKET`, `B2_ENDPOINT` (mis. `https://s3.us-west-004.backblazeb2.com`) | App Keys |
| Google Drive | `GDRIVE_CLIENT_ID`, `GDRIVE_CLIENT_SECRET`, `GDRIVE_REFRESH_TOKEN`, `GDRIVE_FOLDER_ID` | OAuth client (Desktop/Web) + OAuth Playground, scope `drive.file`. Publikasikan OAuth app ke *Production* agar refresh token tidak kedaluwarsa 7 hari |
| Dropbox | `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN` | App Console; otorisasi dengan `token_access_type=offline` |
| OneDrive | `ONEDRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_SECRET`, `ONEDRIVE_REFRESH_TOKEN` | Azure App registration (akun pribadi), scope `Files.ReadWrite offline_access` |
| Box | `BOX_CLIENT_ID`, `BOX_CLIENT_SECRET`, `BOX_USER_ID`, `BOX_FOLDER_ID` | Dev Console → Custom App → *Client Credentials Grant*, otorisasi app |
| pCloud | `PCLOUD_TOKEN`, `PCLOUD_API_HOST` (`api`/`eapi.pcloud.com`), `PCLOUD_FOLDER_ID` | OAuth app pCloud (token tidak kedaluwarsa) |
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET` | Buat bucket privat; Settings → API |
| GitHub Releases | `GHSTORE_REPO`, `GHSTORE_TOKEN` | lihat langkah B.4 |
| Koofr | `KOOFR_EMAIL`, `KOOFR_APP_PASSWORD` | Preferences → Password → App passwords |

Email: pastikan `EMAIL_FROM` memakai domain yang sudah diverifikasi (SPF/DKIM) di **setiap** penyedia email yang Anda aktifkan.

## 6. Keamanan
- Semua input divalidasi ulang di Worker (`worker/src/config.js`); package name dikunci per pemilik.
- Builder hanya menerima `build_id` sebagai input (input workflow terlihat publik); konfigurasi & keystore diambil lewat `BUILDER_SECRET` dan password di-*mask* dari log.
- Keystore dienkripsi AES-256-GCM dengan `KEYSTORE_ENC_KEY`. **Kehilangan kunci ini = keystore semua aplikasi tidak bisa dibuka.** Simpan cadangan di password manager.
- File sumber (ZIP/HTML) privat; APK/AAB/ikon bersifat *public-by-link* dengan ID acak 24 karakter.
- Log build bisa dilihat publik (repo publik) — tidak berisi rahasia. Jika ingin privat, gunakan repo privat (kuota 2.000 menit/bulan).

## 7. Batasan yang perlu diketahui
- Template Android **belum saya kompilasi** di sini (lingkungan saya tidak punya Android SDK). Script persiapan sudah diuji. Jalankan satu build uji di GitHub Actions; bila ada error versi dependency, sesuaikan di `builder/android-template/app/build.gradle`.
- Versi target: compileSdk/targetSdk 36, AGP 8.11.1, Gradle 8.14.3, Kotlin 2.2.0. Cek syarat target API Google Play terbaru sebelum rilis.
- Body request Workers Free maks 100 MB → batas ZIP diset 50 MB.
- Konten ZIP/HTML tidak dienkripsi di dalam APK (referensi mengenkripsi; bisa ditambah nanti).
- Login Google di dalam WebView diblokir Google (berlaku untuk semua converter sejenis).
