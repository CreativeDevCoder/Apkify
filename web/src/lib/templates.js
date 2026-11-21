// Template aplikasi siap pakai. Template "html" membawa kode lengkap yang berjalan offline.
const page = (title, color, body, script = '') => `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Roboto,sans-serif;background:#f6f7fb;color:#1f2330}
header{background:${color};color:#fff;padding:20px 16px}header h1{margin:0;font-size:20px}main{padding:16px;max-width:640px;margin:auto}
.card{background:#fff;border-radius:14px;padding:16px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
button,.btn{background:${color};color:#fff;border:0;border-radius:10px;padding:12px 16px;font-size:15px;font-weight:600;width:100%;display:block;text-align:center;text-decoration:none}
input,textarea,select{width:100%;padding:12px;border:1px solid #dde;border-radius:10px;font-size:15px;margin:6px 0 12px}
.row{display:flex;gap:8px}.row>*{flex:1}.muted{color:#778}</style></head><body>${body}<script>${script}</script></body></html>`;

export const TEMPLATES = [
  {
    id: 'store-whatsapp', name: 'Katalog Toko + WhatsApp', category: 'Bisnis', color: '#16a34a',
    desc: 'Katalog produk sederhana dengan tombol pesan via WhatsApp. Edit daftar produk di dalam kode.',
    source: 'html',
    html: page('Toko Saya', '#16a34a', `<header><h1>🛍️ Toko Saya</h1><div class="muted" style="color:#dcfce7">Pesan cepat lewat WhatsApp</div></header><main id="list"></main>`,
      `const WA='6281234567890';const P=[['Kopi Susu Gula Aren',18000],['Roti Bakar Cokelat',15000],['Teh Lemon',10000]];
document.getElementById('list').innerHTML=P.map(([n,h])=>'<div class="card"><b>'+n+'</b><p class="muted">Rp'+h.toLocaleString('id-ID')+'</p><a class="btn" href="https://wa.me/'+WA+'?text='+encodeURIComponent('Halo, saya mau pesan '+n)+'">Pesan</a></div>').join('');`)
  },
  {
    id: 'link-in-bio', name: 'Link in Bio', category: 'Personal', color: '#7c3aed',
    desc: 'Profil singkat dengan daftar tautan media sosial — seperti Linktree versi aplikasi.',
    source: 'html',
    html: page('Profil', '#7c3aed', `<header style="text-align:center"><div style="font-size:56px">🙂</div><h1>Nama Anda</h1><div style="opacity:.85">Kreator • Desainer</div></header>
<main>${['Instagram|https://instagram.com', 'TikTok|https://tiktok.com', 'YouTube|https://youtube.com', 'Toko Online|https://shopee.co.id'].map((l) => { const [a, b] = l.split('|'); return `<a class="btn" style="margin-bottom:10px" href="${b}">${a}</a>`; }).join('')}</main>`)
  },
  {
    id: 'calculator-loan', name: 'Kalkulator Cicilan', category: 'Utilitas', color: '#0ea5e9',
    desc: 'Hitung cicilan bulanan (anuitas). Contoh aplikasi alat offline yang ringan.',
    source: 'html',
    html: page('Kalkulator Cicilan', '#0ea5e9', `<header><h1>🧮 Kalkulator Cicilan</h1></header><main><div class="card">
<label>Pokok pinjaman (Rp)</label><input id="p" type="number" value="10000000"><label>Bunga per tahun (%)</label><input id="r" type="number" value="12">
<label>Tenor (bulan)</label><input id="n" type="number" value="12"><button onclick="hit()">Hitung</button><h2 id="o" style="text-align:center"></h2></div></main>`,
      `function hit(){const p=+document.getElementById('p').value,r=+document.getElementById('r').value/1200,n=+document.getElementById('n').value;const c=r?p*r/(1-Math.pow(1+r,-n)):p/n;document.getElementById('o').textContent='Rp'+Math.round(c).toLocaleString('id-ID')+'/bulan'}hit()`)
  },
  {
    id: 'notes', name: 'Catatan Offline', category: 'Utilitas', color: '#f59e0b',
    desc: 'Aplikasi catatan yang tersimpan di HP (localStorage), berjalan tanpa internet.',
    source: 'html',
    html: page('Catatan', '#f59e0b', `<header><h1>📝 Catatan</h1></header><main><div class="card"><textarea id="t" rows="3" placeholder="Tulis catatan…"></textarea><button onclick="add()">Simpan</button></div><div id="l"></div></main>`,
      `let N=JSON.parse(localStorage.n||'[]');function r(){document.getElementById('l').innerHTML=N.map((x,i)=>'<div class="card">'+x.replace(/</g,'&lt;')+'<p><a href="#" onclick="del('+i+');return false" class="muted">hapus</a></p></div>').join('')}
function add(){const t=document.getElementById('t');if(!t.value.trim())return;N.unshift(t.value);localStorage.n=JSON.stringify(N);t.value='';r()}function del(i){N.splice(i,1);localStorage.n=JSON.stringify(N);r()}r()`)
  },
  {
    id: 'quiz', name: 'Kuis Edukasi', category: 'Edukasi', color: '#ef4444',
    desc: 'Kuis pilihan ganda dengan skor. Ganti soal di dalam kode.',
    source: 'html',
    html: page('Kuis', '#ef4444', `<header><h1>🎓 Kuis</h1></header><main><div class="card" id="q"></div></main>`,
      `const Q=[['Ibu kota Indonesia?',['Jakarta','Bandung','Surabaya'],0],['2 + 2 × 2 = ?',['8','6','4'],1],['Planet terbesar?',['Mars','Jupiter','Bumi'],1]];let i=0,s=0;
function show(){const el=document.getElementById('q');if(i>=Q.length){el.innerHTML='<h2>Skor: '+s+'/'+Q.length+'</h2><button onclick="i=0;s=0;show()">Ulangi</button>';return}
el.innerHTML='<b>'+Q[i][0]+'</b><br><br>'+Q[i][1].map((o,k)=>'<button style="margin-bottom:8px" onclick="ans('+k+')">'+o+'</button>').join('')}function ans(k){if(k===Q[i][2])s++;i++;show()}show()`)
  },
  {
    id: 'news-portal', name: 'Portal Berita / Blog', category: 'Konten', color: '#1d4ed8', source: 'url',
    desc: 'Untuk situs berita/blog: menu samping, tarik untuk refresh, notifikasi push untuk artikel baru.',
    preset: { features: { pullToRefresh: true, sideMenu: true, onesignal: false, cacheMode: 'default' } }
  },
  {
    id: 'online-shop', name: 'Toko Online (Website)', category: 'Bisnis', color: '#db2777', source: 'url',
    desc: 'Untuk WooCommerce/Shopify: upload file bukti transfer, download invoice, link luar ke browser.',
    preset: { features: { fileUpload: true, downloads: true, externalLinksInBrowser: true, pullToRefresh: true } }
  },
  {
    id: 'school', name: 'Sekolah / E-learning', category: 'Edukasi', color: '#059669', source: 'url',
    desc: 'Untuk LMS (Moodle, Google Classroom web): upload tugas, kamera, layar tetap menyala saat ujian.',
    preset: { features: { fileUpload: true, camera: true, keepAwake: true, downloads: true }, orientation: 'portrait' }
  },
  {
    id: 'restaurant', name: 'Restoran & Menu', category: 'Bisnis', color: '#ea580c', source: 'url',
    desc: 'Menu online dengan lokasi (GPS) untuk pengantaran dan tombol kontak di menu samping.',
    preset: { features: { geolocation: true, sideMenu: true } }
  },
  {
    id: 'kiosk', name: 'Kiosk / Dashboard Layar Penuh', category: 'Utilitas', color: '#334155', source: 'url',
    desc: 'Tampilan layar penuh lanskap untuk dashboard, antrean, atau papan informasi.',
    preset: { features: { fullscreen: true, keepAwake: true, pullToRefresh: false }, orientation: 'landscape' }
  }
];
