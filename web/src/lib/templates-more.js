// Template tambahan: game HTML5 & aplikasi utilitas (offline), plus preset website.
// Skrip ditulis sebagai string biasa (tanpa template literal) agar mudah dibaca.
import { page } from './templatePage';

const H = (t) => '<header><h1>' + t + '</h1></header>';

export const MORE_TEMPLATES = [
  // ---------------- GAME ----------------
  {
    id: 'game-tictactoe', name: 'Tic-Tac-Toe', category: 'Game', color: '#0f766e',
    desc: 'Game XO dua pemain atau melawan komputer.', source: 'html',
    html: page('Tic-Tac-Toe', '#0f766e', H('⭕ Tic-Tac-Toe') + '<main><div class="card"><div class="row"><button onclick="reset(1)">Vs Komputer</button><button onclick="reset(0)">2 Pemain</button></div><h2 id="s" style="text-align:center"></h2><div id="b" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"></div></div></main>',
      'var B,T,AI,over;var L=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];' +
      'function win(b){for(var i=0;i<8;i++){var l=L[i];if(b[l[0]]&&b[l[0]]==b[l[1]]&&b[l[1]]==b[l[2]])return b[l[0]]}return b.every(Boolean)?"=":null}' +
      'function draw(){var e=document.getElementById("b");e.innerHTML="";B.forEach(function(v,i){var d=document.createElement("button");d.style.height="90px";d.style.fontSize="40px";d.textContent=v||"";d.onclick=function(){play(i)};e.appendChild(d)});var w=win(B);document.getElementById("s").textContent=w?(w=="="?"Seri!":w+" menang!"):"Giliran "+T;over=!!w}' +
      'function play(i){if(over||B[i])return;B[i]=T;T=T=="X"?"O":"X";draw();if(AI&&T=="O"&&!over){var f=B.map(function(v,k){return v?-1:k}).filter(function(k){return k>=0});var pick=null;["O","X"].forEach(function(p){if(pick!==null)return;f.forEach(function(k){if(pick!==null)return;var c=B.slice();c[k]=p;if(win(c)==p)pick=k})});if(pick===null)pick=B[4]?f[Math.floor(Math.random()*f.length)]:4;setTimeout(function(){play(pick)},250)}}' +
      'function reset(a){AI=a;B=Array(9).fill(null);T="X";draw()}reset(1);')
  },
  {
    id: 'game-snake', name: 'Snake', category: 'Game', color: '#15803d',
    desc: 'Game ular klasik dengan kontrol geser (swipe) dan skor tertinggi.', source: 'html', preset: { orientation: 'portrait' },
    html: page('Snake', '#15803d', H('🐍 Snake') + '<main><div class="card" style="text-align:center"><b id="sc">Skor 0</b> • <span id="hi"></span><canvas id="c" width="300" height="300" style="width:100%;background:#0b1;border-radius:10px;margin:10px 0;touch-action:none"></canvas><button onclick="start()">Mulai</button></div></main>',
      'var c=document.getElementById("c"),x=c.getContext("2d"),N=15,S,D,F,t,sc,hi=+localStorage.hi||0;document.getElementById("hi").textContent="Tertinggi "+hi;' +
      'function food(){F={x:Math.floor(Math.random()*20),y:Math.floor(Math.random()*20)}}' +
      'function start(){S=[{x:10,y:10}];D={x:1,y:0};sc=0;food();clearInterval(t);t=setInterval(step,120)}' +
      'function step(){var h={x:(S[0].x+D.x+20)%20,y:(S[0].y+D.y+20)%20};if(S.some(function(p){return p.x==h.x&&p.y==h.y})){clearInterval(t);if(sc>hi){hi=sc;localStorage.hi=hi}document.getElementById("hi").textContent="Tertinggi "+hi;alert("Game over! Skor "+sc);return}S.unshift(h);if(h.x==F.x&&h.y==F.y){sc++;food()}else S.pop();document.getElementById("sc").textContent="Skor "+sc;' +
      'x.fillStyle="#064";x.fillRect(0,0,300,300);x.fillStyle="#fd4";x.fillRect(F.x*N,F.y*N,N-1,N-1);x.fillStyle="#fff";S.forEach(function(p){x.fillRect(p.x*N,p.y*N,N-1,N-1)})}' +
      'function turn(dx,dy){if(D&&(dx==-D.x&&dy==-D.y))return;D={x:dx,y:dy}}var sx,sy;c.addEventListener("touchstart",function(e){sx=e.touches[0].clientX;sy=e.touches[0].clientY});' +
      'c.addEventListener("touchend",function(e){var dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)>Math.abs(dy))turn(dx>0?1:-1,0);else turn(0,dy>0?1:-1)});' +
      'document.addEventListener("keydown",function(e){var k={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key];if(k)turn(k[0],k[1])});')
  },
  {
    id: 'game-memory', name: 'Memory Match', category: 'Game', color: '#9333ea',
    desc: 'Cocokkan pasangan kartu emoji secepat mungkin.', source: 'html',
    html: page('Memory', '#9333ea', H('🧠 Memory Match') + '<main><div class="card"><b id="m">Langkah: 0</b><div id="g" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0"></div><button onclick="init()">Acak ulang</button></div></main>',
      'var E=["🍎","🍌","🍇","🍉","🍒","🥝","🍍","🥥"],C,open,moves,lock;' +
      'function init(){C=E.concat(E).sort(function(){return Math.random()-.5}).map(function(e){return{e:e,s:0}});open=[];moves=0;lock=0;draw()}' +
      'function draw(){var g=document.getElementById("g");g.innerHTML="";C.forEach(function(c,i){var b=document.createElement("button");b.style.height="70px";b.style.fontSize="30px";b.textContent=c.s?c.e:"❓";b.onclick=function(){flip(i)};g.appendChild(b)});document.getElementById("m").textContent="Langkah: "+moves}' +
      'function flip(i){if(lock||C[i].s)return;C[i].s=1;open.push(i);if(open.length==2){moves++;lock=1;var a=C[open[0]],b=C[open[1]];setTimeout(function(){if(a.e!=b.e){a.s=0;b.s=0}open=[];lock=0;draw();if(C.every(function(c){return c.s}))alert("Selesai dalam "+moves+" langkah!")},600)}draw()}init();')
  },
  {
    id: 'game-2048', name: '2048', category: 'Game', color: '#b45309',
    desc: 'Game angka 2048 dengan kontrol geser.', source: 'html',
    html: page('2048', '#b45309', H('🔢 2048') + '<main><div class="card"><b id="s">Skor 0</b><div id="g" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:12px 0;touch-action:none"></div><button onclick="init()">Main lagi</button></div></main>',
      'var G,sc;function add(){var e=[];G.forEach(function(v,i){if(!v)e.push(i)});if(e.length)G[e[Math.floor(Math.random()*e.length)]]=Math.random()<.9?2:4}' +
      'function init(){G=Array(16).fill(0);sc=0;add();add();draw()}' +
      'function draw(){var g=document.getElementById("g");g.innerHTML="";G.forEach(function(v){var d=document.createElement("div");d.style.cssText="height:68px;border-radius:8px;display:grid;place-items:center;font-weight:800;font-size:22px;background:"+(v?"hsl("+(40-Math.log2(v)*3)+",90%,"+(85-Math.log2(v)*4)+"%)":"#eee");d.textContent=v||"";g.appendChild(d)});document.getElementById("s").textContent="Skor "+sc}' +
      'function line(a){var b=a.filter(Boolean);for(var i=0;i<b.length-1;i++)if(b[i]==b[i+1]){b[i]*=2;sc+=b[i];b.splice(i+1,1)}while(b.length<4)b.push(0);return b}' +
      'function move(d){var old=G.join(),R=[0,1,2,3];R.forEach(function(r){var idx=R.map(function(c){return d=="L"||d=="R"?r*4+c:c*4+r});if(d=="R"||d=="D")idx.reverse();var v=line(idx.map(function(i){return G[i]}));idx.forEach(function(i,k){G[i]=v[k]})});if(G.join()!=old){add();draw()}}' +
      'var sx,sy,g=document.getElementById("g");g.addEventListener("touchstart",function(e){sx=e.touches[0].clientX;sy=e.touches[0].clientY});g.addEventListener("touchend",function(e){var dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.max(Math.abs(dx),Math.abs(dy))<30)return;move(Math.abs(dx)>Math.abs(dy)?(dx>0?"R":"L"):(dy>0?"D":"U"))});' +
      'document.addEventListener("keydown",function(e){var k={ArrowLeft:"L",ArrowRight:"R",ArrowUp:"U",ArrowDown:"D"}[e.key];if(k)move(k)});init();')
  },
  {
    id: 'game-tap', name: 'Tap Cepat', category: 'Game', color: '#dc2626',
    desc: 'Ketuk target sebanyak mungkin dalam 30 detik.', source: 'html',
    html: page('Tap Cepat', '#dc2626', H('🎯 Tap Cepat') + '<main><div class="card" style="text-align:center"><b id="i">Skor 0 • 30 dtk</b><div id="a" style="position:relative;height:360px;background:#fee;border-radius:12px;margin:12px 0"></div><button onclick="go()">Mulai</button></div></main>',
      'var s,t,iv,a=document.getElementById("a");function spot(){a.innerHTML="";var b=document.createElement("div");b.style.cssText="position:absolute;width:56px;height:56px;border-radius:50%;background:#dc2626;left:"+Math.random()*80+"%;top:"+Math.random()*80+"%";b.onclick=function(){s++;spot();info()};a.appendChild(b)}' +
      'function info(){document.getElementById("i").textContent="Skor "+s+" • "+t+" dtk"}function go(){s=0;t=30;clearInterval(iv);spot();info();iv=setInterval(function(){t--;info();if(t<=0){clearInterval(iv);a.innerHTML="<h2 style=\'padding-top:140px\'>Skor akhir: "+s+"</h2>"}},1000)}')
  },
  // ---------------- UTILITAS ----------------
  {
    id: 'pomodoro', name: 'Timer Pomodoro', category: 'Produktivitas', color: '#e11d48',
    desc: 'Fokus 25 menit, istirahat 5 menit, dengan hitungan sesi.', source: 'html', preset: { features: { keepAwake: true } },
    html: page('Pomodoro', '#e11d48', H('🍅 Pomodoro') + '<main><div class="card" style="text-align:center"><div id="m" class="muted">Fokus</div><div id="t" style="font-size:72px;font-weight:800">25:00</div><div class="row"><button onclick="toggle()" id="b">Mulai</button><button onclick="reset()">Reset</button></div><p class="muted" id="n">Sesi selesai: 0</p></div></main>',
      'var L=25*60,left=L,iv=null,focus=true,done=+localStorage.pd||0;function show(){document.getElementById("t").textContent=String(Math.floor(left/60)).padStart(2,"0")+":"+String(left%60).padStart(2,"0");document.getElementById("m").textContent=focus?"Fokus":"Istirahat";document.getElementById("n").textContent="Sesi selesai: "+done}' +
      'function toggle(){if(iv){clearInterval(iv);iv=null;document.getElementById("b").textContent="Lanjut";return}document.getElementById("b").textContent="Jeda";iv=setInterval(function(){left--;if(left<0){if(focus){done++;localStorage.pd=done}focus=!focus;left=(focus?25:5)*60;if(navigator.vibrate)navigator.vibrate(400)}show()},1000)}' +
      'function reset(){clearInterval(iv);iv=null;focus=true;left=L;document.getElementById("b").textContent="Mulai";show()}show();')
  },
  {
    id: 'bmi', name: 'Kalkulator BMI', category: 'Kesehatan', color: '#0891b2',
    desc: 'Hitung indeks massa tubuh dan kategori berat badan.', source: 'html',
    html: page('BMI', '#0891b2', H('⚖️ Kalkulator BMI') + '<main><div class="card"><label>Berat (kg)</label><input id="w" type="number" value="60"><label>Tinggi (cm)</label><input id="h" type="number" value="165"><button onclick="hit()">Hitung</button><h2 id="o" style="text-align:center"></h2><p class="muted">Kategori umum dewasa (WHO). Bukan pengganti saran tenaga kesehatan.</p></div></main>',
      'function hit(){var w=+document.getElementById("w").value,h=+document.getElementById("h").value/100;if(!w||!h)return;var b=w/(h*h),k=b<18.5?"Kurus":b<25?"Normal":b<30?"Berlebih":"Obesitas";document.getElementById("o").textContent=b.toFixed(1)+" — "+k}hit();')
  },
  {
    id: 'converter', name: 'Konversi Satuan', category: 'Utilitas', color: '#4338ca',
    desc: 'Konversi panjang, berat, dan suhu.', source: 'html',
    html: page('Konversi', '#4338ca', H('📏 Konversi Satuan') + '<main><div class="card"><select id="k" onchange="fill()"><option value="len">Panjang</option><option value="mass">Berat</option><option value="temp">Suhu</option></select><input id="v" type="number" value="1" oninput="calc()"><div class="row"><select id="a" onchange="calc()"></select><select id="b" onchange="calc()"></select></div><h2 id="o" style="text-align:center"></h2></div></main>',
      'var U={len:{m:1,km:1000,cm:.01,mm:.001,inch:.0254,ft:.3048,mile:1609.344},mass:{kg:1,g:.001,ton:1000,lb:.45359237,oz:.0283495}};' +
      'function fill(){var k=document.getElementById("k").value,u=k=="temp"?["C","F","K"]:Object.keys(U[k]);["a","b"].forEach(function(id,j){document.getElementById(id).innerHTML=u.map(function(x){return"<option>"+x+"</option>"}).join("");document.getElementById(id).selectedIndex=j});calc()}' +
      'function calc(){var k=document.getElementById("k").value,v=+document.getElementById("v").value,a=document.getElementById("a").value,b=document.getElementById("b").value,r;' +
      'if(k=="temp"){var c=a=="C"?v:a=="F"?(v-32)*5/9:v-273.15;r=b=="C"?c:b=="F"?c*9/5+32:c+273.15}else r=v*U[k][a]/U[k][b];document.getElementById("o").textContent=(+r.toFixed(6))+" "+b}fill();')
  },
  {
    id: 'tasbih', name: 'Tasbih Digital', category: 'Religi', color: '#047857',
    desc: 'Penghitung dzikir dengan target dan getar.', source: 'html', preset: { features: { keepAwake: true, pullToRefresh: false } },
    html: page('Tasbih', '#047857', H('📿 Tasbih Digital') + '<main><div class="card" style="text-align:center"><select id="tg" onchange="save()"><option>33</option><option>99</option><option>100</option><option>1000</option></select><div id="c" style="font-size:96px;font-weight:800">0</div><button style="height:160px;font-size:28px;border-radius:50%;width:160px;margin:auto" onclick="tap()">+</button><br><button onclick="reset()" style="background:#999">Reset</button></div></main>',
      'var n=+localStorage.tc||0,tg=document.getElementById("tg");tg.value=localStorage.tt||"33";function show(){document.getElementById("c").textContent=n}function save(){localStorage.tc=n;localStorage.tt=tg.value}' +
      'function tap(){n++;if(n%+tg.value==0&&navigator.vibrate)navigator.vibrate(300);else if(navigator.vibrate)navigator.vibrate(15);save();show()}function reset(){if(confirm("Reset hitungan?")){n=0;save();show()}}show();')
  },
  {
    id: 'expense', name: 'Catatan Pengeluaran', category: 'Keuangan', color: '#ca8a04',
    desc: 'Catat pemasukan & pengeluaran harian dengan saldo otomatis.', source: 'html',
    html: page('Keuangan', '#ca8a04', H('💰 Catatan Keuangan') + '<main><div class="card"><h2 id="sal" style="margin:0"></h2><input id="d" placeholder="Keterangan"><div class="row"><input id="v" type="number" placeholder="Jumlah"><select id="t"><option value="-1">Pengeluaran</option><option value="1">Pemasukan</option></select></div><button onclick="add()">Simpan</button></div><div id="l"></div></main>',
      'var X=JSON.parse(localStorage.ex||"[]");function rp(n){return"Rp"+Math.round(n).toLocaleString("id-ID")}' +
      'function draw(){var s=X.reduce(function(a,x){return a+x.v},0);document.getElementById("sal").textContent="Saldo "+rp(s);document.getElementById("l").innerHTML=X.map(function(x,i){return"<div class=card><b>"+x.d.replace(/</g,"&lt;")+"</b><div style=\'color:"+(x.v<0?"#c00":"#080")+"\'>"+rp(x.v)+"</div><small class=muted>"+x.t+" • <a href=# onclick=\'del("+i+");return false\'>hapus</a></small></div>"}).join("")}' +
      'function add(){var d=document.getElementById("d").value.trim(),v=+document.getElementById("v").value;if(!d||!v)return;X.unshift({d:d,v:v*+document.getElementById("t").value,t:new Date().toLocaleString("id-ID")});localStorage.ex=JSON.stringify(X);document.getElementById("d").value="";document.getElementById("v").value="";draw()}' +
      'function del(i){X.splice(i,1);localStorage.ex=JSON.stringify(X);draw()}draw();')
  },
  {
    id: 'habit', name: 'Pelacak Kebiasaan', category: 'Produktivitas', color: '#7c3aed',
    desc: 'Centang kebiasaan harian dan lihat runtutan (streak).', source: 'html',
    html: page('Kebiasaan', '#7c3aed', H('✅ Pelacak Kebiasaan') + '<main><div class="card"><div class="row"><input id="n" placeholder="Kebiasaan baru"><button style="width:auto" onclick="add()">+</button></div></div><div id="l"></div></main>',
      'var K=JSON.parse(localStorage.hb||"[]"),today=new Date().toISOString().slice(0,10);function sv(){localStorage.hb=JSON.stringify(K)}' +
      'function streak(h){var s=0,d=new Date();while(h.d.indexOf(d.toISOString().slice(0,10))>=0){s++;d.setDate(d.getDate()-1)}return s}' +
      'function draw(){document.getElementById("l").innerHTML=K.map(function(h,i){var on=h.d.indexOf(today)>=0;return"<div class=card style=\'display:flex;align-items:center;gap:10px\'><input type=checkbox style=\'width:28px;height:28px;margin:0\' "+(on?"checked":"")+" onchange=\'tog("+i+")\'><div style=\'flex:1\'><b>"+h.n.replace(/</g,"&lt;")+"</b><div class=muted>🔥 "+streak(h)+" hari</div></div><a href=# onclick=\'del("+i+");return false\'>✕</a></div>"}).join("")}' +
      'function add(){var n=document.getElementById("n").value.trim();if(!n)return;K.push({n:n,d:[]});sv();document.getElementById("n").value="";draw()}function tog(i){var j=K[i].d.indexOf(today);if(j>=0)K[i].d.splice(j,1);else K[i].d.push(today);sv();draw()}function del(i){K.splice(i,1);sv();draw()}draw();')
  },
  {
    id: 'shopping', name: 'Daftar Belanja', category: 'Utilitas', color: '#16a34a',
    desc: 'Daftar belanja dengan centang dan total perkiraan.', source: 'html',
    html: page('Belanja', '#16a34a', H('🛒 Daftar Belanja') + '<main><div class="card"><div class="row"><input id="n" placeholder="Barang"><input id="h" type="number" placeholder="Harga"></div><button onclick="add()">Tambah</button><h3 id="tot"></h3></div><div id="l"></div></main>',
      'var B=JSON.parse(localStorage.sl||"[]");function sv(){localStorage.sl=JSON.stringify(B)}function draw(){var t=B.filter(function(x){return!x.c}).reduce(function(a,x){return a+(x.h||0)},0);document.getElementById("tot").textContent="Sisa belanja: Rp"+t.toLocaleString("id-ID");' +
      'document.getElementById("l").innerHTML=B.map(function(x,i){return"<div class=card style=\'display:flex;gap:10px;align-items:center\'><input type=checkbox style=\'width:24px;height:24px;margin:0\' "+(x.c?"checked":"")+" onchange=\'B["+i+"].c=!B["+i+"].c;sv();draw()\'><span style=\'flex:1;"+(x.c?"text-decoration:line-through;color:#999":"")+"\'>"+x.n.replace(/</g,"&lt;")+"</span><span>"+(x.h?"Rp"+x.h.toLocaleString("id-ID"):"")+"</span><a href=# onclick=\'B.splice("+i+",1);sv();draw();return false\'>✕</a></div>"}).join("")}' +
      'function add(){var n=document.getElementById("n").value.trim();if(!n)return;B.push({n:n,h:+document.getElementById("h").value||0,c:false});sv();document.getElementById("n").value="";document.getElementById("h").value="";draw()}draw();')
  },
  {
    id: 'countdown', name: 'Hitung Mundur Acara', category: 'Utilitas', color: '#be185d',
    desc: 'Hitung mundur menuju acara (pernikahan, ujian, liburan).', source: 'html',
    html: page('Hitung Mundur', '#be185d', H('⏳ Hitung Mundur') + '<main><div class="card"><input id="e" placeholder="Nama acara"><input id="d" type="datetime-local"><button onclick="save()">Simpan</button></div><div class="card" style="text-align:center"><h2 id="n"></h2><div id="o" style="font-size:34px;font-weight:800"></div></div></main>',
      'var A=JSON.parse(localStorage.cd||"null");function save(){A={e:document.getElementById("e").value||"Acara",d:document.getElementById("d").value};if(!A.d)return;localStorage.cd=JSON.stringify(A)}' +
      'setInterval(function(){if(!A)return;var s=Math.max(0,(new Date(A.d)-new Date())/1000);document.getElementById("n").textContent=A.e;document.getElementById("o").textContent=Math.floor(s/86400)+"h "+Math.floor(s%86400/3600)+"j "+Math.floor(s%3600/60)+"m "+Math.floor(s%60)+"d"},500);')
  },
  {
    id: 'stopwatch', name: 'Stopwatch & Lap', category: 'Utilitas', color: '#1e40af',
    desc: 'Stopwatch presisi dengan pencatatan lap.', source: 'html', preset: { features: { keepAwake: true } },
    html: page('Stopwatch', '#1e40af', H('⏱️ Stopwatch') + '<main><div class="card" style="text-align:center"><div id="t" style="font-size:56px;font-weight:800;font-variant-numeric:tabular-nums">00:00.00</div><div class="row"><button id="b" onclick="ss()">Mulai</button><button onclick="lap()">Lap</button><button onclick="rs()" style="background:#999">Reset</button></div></div><div id="l"></div></main>',
      'var st=0,acc=0,run=false,L=[];function fmt(ms){var m=Math.floor(ms/60000),s=Math.floor(ms%60000/1000),c=Math.floor(ms%1000/10);return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")+"."+String(c).padStart(2,"0")}' +
      'function now(){return acc+(run?Date.now()-st:0)}function tick(){document.getElementById("t").textContent=fmt(now());if(run)requestAnimationFrame(tick)}' +
      'function ss(){if(run){acc=now();run=false;document.getElementById("b").textContent="Lanjut"}else{st=Date.now();run=true;document.getElementById("b").textContent="Jeda";tick()}}' +
      'function lap(){L.unshift(now());document.getElementById("l").innerHTML=L.map(function(x,i){return"<div class=card>Lap "+(L.length-i)+": <b>"+fmt(x)+"</b></div>"}).join("")}function rs(){run=false;acc=0;L=[];document.getElementById("l").innerHTML="";document.getElementById("b").textContent="Mulai";tick()}')
  },
  {
    id: 'random-picker', name: 'Pengundi & Dadu', category: 'Utilitas', color: '#9a3412',
    desc: 'Undi nama/arisan, lempar dadu, atau angka acak.', source: 'html',
    html: page('Pengundi', '#9a3412', H('🎲 Pengundi') + '<main><div class="card"><textarea id="n" rows="5" placeholder="Satu nama per baris"></textarea><button onclick="pick()">Undi nama</button></div><div class="card" style="text-align:center"><div class="row"><button onclick="dice()">Lempar dadu</button><button onclick="num()">Angka 1–100</button></div><h1 id="o" style="font-size:48px"></h1></div></main>',
      'var n=document.getElementById("n");n.value=localStorage.pn||"";n.oninput=function(){localStorage.pn=n.value};function out(v){var o=document.getElementById("o"),k=0,iv=setInterval(function(){o.textContent=typeof v=="function"?v():v;if(++k>12)clearInterval(iv)},60)}' +
      'function pick(){var a=n.value.split("\\n").map(function(s){return s.trim()}).filter(Boolean);if(!a.length)return;out(function(){return a[Math.floor(Math.random()*a.length)]})}function dice(){out(function(){return"⚀⚁⚂⚃⚄⚅"[Math.floor(Math.random()*6)]})}function num(){out(function(){return 1+Math.floor(Math.random()*100)})}')
  },
  {
    id: 'split-bill', name: 'Patungan & Tip', category: 'Keuangan', color: '#0d9488',
    desc: 'Bagi tagihan, pajak, dan tip ke beberapa orang.', source: 'html',
    html: page('Patungan', '#0d9488', H('🧾 Patungan') + '<main><div class="card"><label>Total tagihan (Rp)</label><input id="t" type="number" value="250000" oninput="c()"><label>Pajak & layanan (%)</label><input id="p" type="number" value="10" oninput="c()"><label>Tip (%)</label><input id="tp" type="number" value="0" oninput="c()"><label>Jumlah orang</label><input id="n" type="number" value="4" oninput="c()"><h2 id="o" style="text-align:center"></h2></div></main>',
      'function v(id){return+document.getElementById(id).value||0}function c(){var tot=v("t")*(1+v("p")/100+v("tp")/100),n=Math.max(1,v("n"));document.getElementById("o").textContent="Rp"+Math.ceil(tot/n).toLocaleString("id-ID")+" / orang"}c();')
  },
  {
    id: 'water', name: 'Pelacak Minum Air', category: 'Kesehatan', color: '#0284c7',
    desc: 'Catat gelas air harian menuju target.', source: 'html',
    html: page('Minum Air', '#0284c7', H('💧 Minum Air') + '<main><div class="card" style="text-align:center"><div id="o" style="font-size:64px;font-weight:800"></div><div class="muted" id="g"></div><div style="height:16px;background:#e0f2fe;border-radius:8px;margin:12px 0"><div id="bar" style="height:100%;background:#0284c7;border-radius:8px;width:0"></div></div><div class="row"><button onclick="add(1)">+ 1 gelas</button><button onclick="add(-1)" style="background:#999">− 1</button></div><label>Target gelas/hari</label><input id="tg" type="number" value="8" oninput="sv()"></div></main>',
      'var d=new Date().toISOString().slice(0,10),S=JSON.parse(localStorage.wt||"{}"),tg=document.getElementById("tg");tg.value=S.tg||8;function sv(){S.tg=+tg.value;localStorage.wt=JSON.stringify(S);draw()}' +
      'function add(k){S[d]=Math.max(0,(S[d]||0)+k);sv()}function draw(){var n=S[d]||0;document.getElementById("o").textContent=n;document.getElementById("g").textContent="dari "+S.tg+" gelas hari ini";document.getElementById("bar").style.width=Math.min(100,n/S.tg*100)+"%"}sv();')
  },
  {
    id: 'flashcards', name: 'Kartu Hafalan', category: 'Edukasi', color: '#c026d3',
    desc: 'Flashcard dua sisi untuk kosakata atau rumus. Edit daftar di kode.', source: 'html',
    html: page('Flashcard', '#c026d3', H('🃏 Kartu Hafalan') + '<main><div class="card" id="c" onclick="flip()" style="height:240px;display:grid;place-items:center;font-size:28px;font-weight:700;text-align:center;cursor:pointer"></div><div class="row"><button onclick="go(-1)">‹ Sebelumnya</button><button onclick="go(1)">Berikutnya ›</button></div><p class="muted" id="i" style="text-align:center"></p></main>',
      'var K=[["apple","apel"],["book","buku"],["water","air"],["house","rumah"],["friend","teman"]],k=0,b=false;function show(){document.getElementById("c").textContent=K[k][b?1:0];document.getElementById("i").textContent=(k+1)+" / "+K.length+" • ketuk kartu untuk membalik"}' +
      'function flip(){b=!b;show()}function go(d){k=(k+d+K.length)%K.length;b=false;show()}show();')
  },
  {
    id: 'agenda', name: 'Agenda Harian', category: 'Produktivitas', color: '#475569',
    desc: 'Agenda per tanggal dengan jam dan status selesai.', source: 'html',
    html: page('Agenda', '#475569', H('📅 Agenda') + '<main><div class="card"><input id="tg" type="date" onchange="draw()"><div class="row"><input id="j" type="time"><input id="a" placeholder="Kegiatan"></div><button onclick="add()">Tambah</button></div><div id="l"></div></main>',
      'var A=JSON.parse(localStorage.ag||"{}"),tg=document.getElementById("tg");tg.value=new Date().toISOString().slice(0,10);function sv(){localStorage.ag=JSON.stringify(A)}' +
      'function draw(){var L=(A[tg.value]||[]).sort(function(x,y){return x.j<y.j?-1:1});document.getElementById("l").innerHTML=L.length?L.map(function(x,i){return"<div class=card style=\'display:flex;gap:10px;align-items:center\'><input type=checkbox style=\'width:24px;height:24px;margin:0\' "+(x.c?"checked":"")+" onchange=\'tog("+i+")\'><b>"+(x.j||"--:--")+"</b><span style=\'flex:1\'>"+x.a.replace(/</g,"&lt;")+"</span><a href=# onclick=\'del("+i+");return false\'>✕</a></div>"}).join(""):"<p class=muted>Belum ada agenda.</p>"}' +
      'function add(){var a=document.getElementById("a").value.trim();if(!a)return;(A[tg.value]=A[tg.value]||[]).push({j:document.getElementById("j").value,a:a,c:false});sv();document.getElementById("a").value="";draw()}' +
      'function tog(i){var x=A[tg.value][i];x.c=!x.c;sv();draw()}function del(i){A[tg.value].splice(i,1);sv();draw()}draw();')
  },
  // ---------------- PRESET WEBSITE ----------------
  { id: 'portfolio', name: 'Portofolio / CV', category: 'Personal', color: '#111827', source: 'url', desc: 'Situs portofolio: layar penuh, tanpa tarik refresh, link luar ke browser.', preset: { features: { pullToRefresh: false, externalLinksInBrowser: true, showToolbar: false } } },
  { id: 'worship', name: 'Masjid / Gereja / Komunitas', category: 'Komunitas', color: '#065f46', source: 'url', desc: 'Jadwal kegiatan & pengumuman: menu samping, push notification, kontak.', preset: { features: { sideMenu: true, pullToRefresh: true } } },
  { id: 'property', name: 'Properti & Real Estate', category: 'Bisnis', color: '#1e3a8a', source: 'url', desc: 'Listing properti: lokasi (GPS), zoom foto, link WhatsApp agen.', preset: { features: { geolocation: true, zoom: true } } },
  { id: 'clinic', name: 'Klinik & Reservasi', category: 'Bisnis', color: '#0e7490', source: 'url', desc: 'Situs klinik/salon dengan reservasi: konfirmasi keluar, upload dokumen.', preset: { features: { fileUpload: true, confirmExit: true } } },
  { id: 'event', name: 'Event & Tiket', category: 'Bisnis', color: '#7e22ce', source: 'url', desc: 'Situs acara: tiket PDF bisa diunduh, kamera untuk scan QR.', preset: { features: { downloads: true, camera: true } } },
  { id: 'ngo', name: 'Yayasan & Donasi', category: 'Komunitas', color: '#b91c1c', source: 'url', desc: 'Situs donasi: pembayaran dibuka di browser, toolbar dengan tombol Home.', preset: { features: { externalLinksInBrowser: true, showToolbar: true, homeButton: true } } }
];
