import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Typography, Card, CardContent, Stack, TextField, Button, ToggleButtonGroup, ToggleButton, Alert, List, ListItem,
  ListItemText, IconButton, LinearProgress, Box
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import JSZip from 'jszip';
import PageHeader from '../components/PageHeader';
import ColorField from '../components/ColorField';
import { setHandoff } from '../lib/handoff';
import { downloadBlob } from '../lib/canvas';
import pdfJsUrl from 'pdfjs-dist/build/pdf.min.mjs?url';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const TYPES = {
  image: { label: 'Galeri foto', icon: <PhotoLibraryIcon />, accept: 'image/*', ext: /\.(jpe?g|png|webp|gif)$/i },
  audio: { label: 'Musik / audio', icon: <LibraryMusicIcon />, accept: 'audio/*', ext: /\.(mp3|m4a|aac|ogg|wav)$/i },
  video: { label: 'Video', icon: <VideoLibraryIcon />, accept: 'video/mp4,video/webm', ext: /\.(mp4|webm)$/i },
  document: { label: 'Dokumen PDF', icon: <PictureAsPdfIcon />, accept: 'application/pdf', ext: /\.pdf$/i }
};
const MAX_TOTAL = 45 * 1048576;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nice = (n) => n.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');

function buildHtml(type, title, color, files) {
  const items = JSON.stringify(files.map((f, i) => ({ src: `media/${i}-${f.name.replace(/[^\w.\-]/g, '_')}`, title: nice(f.name) })));
  const css = `*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Roboto,sans-serif;background:#f5f6fa;color:#1d2230}
header{background:${color};color:#fff;padding:18px 16px;position:sticky;top:0;z-index:2}header h1{margin:0;font-size:19px}
main{padding:12px;max-width:820px;margin:auto}.item{background:#fff;border-radius:14px;padding:12px;margin-bottom:10px;display:flex;gap:12px;align-items:center;box-shadow:0 1px 3px rgba(0,0,0,.06);cursor:pointer}
.item.active{outline:2px solid ${color}}.n{width:34px;height:34px;border-radius:50%;background:${color};color:#fff;display:grid;place-items:center;font-weight:700;flex:none}
@media(prefers-color-scheme:dark){body{background:#0f1220;color:#e8e9f0}.item{background:#1a1e33}}`;
  const head = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${css}`;
  const bar = `<header><h1>${esc(title)}</h1></header>`;
  if (type === 'image') {
    return `${head}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px}.grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px}
#v{position:fixed;inset:0;background:#000;display:none;align-items:center;justify-content:center;z-index:9}#v img{max-width:100%;max-height:100%}#v span{position:absolute;color:#fff;font-size:42px;padding:20px;top:50%;transform:translateY(-50%)}</style></head><body>${bar}
<main><div class="grid" id="g"></div></main><div id="v"><span style="left:0" id="p">‹</span><img id="vi"><span style="right:0" id="nx">›</span></div>
<script>const I=${items};let k=0;const g=document.getElementById('g'),v=document.getElementById('v'),vi=document.getElementById('vi');
I.forEach((x,i)=>{const im=new Image();im.loading='lazy';im.src=x.src;im.alt=x.title;im.onclick=()=>{k=i;show()};g.appendChild(im)});
function show(){vi.src=I[k].src;v.style.display='flex'}v.onclick=e=>{if(e.target===v||e.target===vi)v.style.display='none'};
document.getElementById('p').onclick=e=>{e.stopPropagation();k=(k-1+I.length)%I.length;show()};document.getElementById('nx').onclick=e=>{e.stopPropagation();k=(k+1)%I.length;show()};
let sx=0;v.addEventListener('touchstart',e=>sx=e.touches[0].clientX);v.addEventListener('touchend',e=>{const d=e.changedTouches[0].clientX-sx;if(Math.abs(d)>50){k=(k+(d<0?1:-1)+I.length)%I.length;show()}});</script></body></html>`;
  }
  if (type === 'audio' || type === 'video') {
    const tag = type === 'audio' ? 'audio' : 'video';
    return `${head}${tag}{width:100%;${type === 'video' ? 'border-radius:14px;background:#000;' : ''}margin-bottom:12px}.player{position:sticky;top:60px;z-index:1;background:inherit;padding-top:8px}</style></head><body>${bar}
<main><div class="player"><div id="now" style="font-weight:700;margin:4px 0 8px"></div><${tag} id="m" controls playsinline preload="metadata"></${tag}></div><div id="l"></div></main>
<script>const I=${items};const m=document.getElementById('m'),l=document.getElementById('l');let k=0;
function play(i,auto){k=i;m.src=I[i].src;document.getElementById('now').textContent=I[i].title;[...l.children].forEach((c,j)=>c.classList.toggle('active',j===i));if(auto)m.play();localStorage.last=i}
I.forEach((x,i)=>{const d=document.createElement('div');d.className='item';d.innerHTML='<div class=n>'+(i+1)+'</div><div>'+x.title.replace(/</g,'&lt;')+'</div>';d.onclick=()=>play(i,true);l.appendChild(d)});
m.onended=()=>{if(k<I.length-1)play(k+1,true)};play(+localStorage.last||0,false);</script></body></html>`;
  }
  // dokumen PDF dengan pdf.js (dibundel, berjalan offline)
  return `${head}#doc canvas{width:100%;height:auto;background:#fff;margin-bottom:8px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,.15)}#back{display:none;margin-bottom:10px;background:${color};color:#fff;border:0;border-radius:10px;padding:10px 14px;font-size:15px}</style></head><body>${bar}
<main><div id="l"></div><button id="back">← Daftar dokumen</button><div id="doc"></div></main>
<script type="module">import * as pdfjs from './lib/pdf.min.mjs';pdfjs.GlobalWorkerOptions.workerSrc='./lib/pdf.worker.min.mjs';
const I=${items};const l=document.getElementById('l'),doc=document.getElementById('doc'),back=document.getElementById('back');
I.forEach((x,i)=>{const d=document.createElement('div');d.className='item';d.innerHTML='<div class=n>'+(i+1)+'</div><div>'+x.title.replace(/</g,'&lt;')+'</div>';d.onclick=()=>open(i);l.appendChild(d)});
async function open(i){l.style.display='none';back.style.display='block';doc.innerHTML='Memuat…';const pdf=await pdfjs.getDocument(I[i].src).promise;doc.innerHTML='';
const w=Math.min(doc.clientWidth||360,1200)*(window.devicePixelRatio||1);
for(let p=1;p<=pdf.numPages;p++){const pg=await pdf.getPage(p);const vp=pg.getViewport({scale:1});const sc=w/vp.width;const v=pg.getViewport({scale:sc});
const c=document.createElement('canvas');c.width=v.width;c.height=v.height;doc.appendChild(c);await pg.render({canvasContext:c.getContext('2d'),viewport:v}).promise}}
back.onclick=()=>{doc.innerHTML='';l.style.display='';back.style.display='none'};if(I.length===1)open(0);</script></body></html>`;
}

export default function MediaApp() {
  const nav = useNavigate();
  const [type, setType] = useState('image');
  const [title, setTitle] = useState('Koleksi Saya');
  const [color, setColor] = useState('#0073e6');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const total = files.reduce((s, f) => s + f.size, 0);

  const add = (list) => {
    const ok = [...list].filter((f) => TYPES[type].ext.test(f.name));
    setFiles((x) => [...x, ...ok].slice(0, 200));
  };

  async function makeZip() {
    const zip = new JSZip();
    zip.file('index.html', buildHtml(type, title, color, files));
    files.forEach((f, i) => zip.file(`media/${i}-${f.name.replace(/[^\w.\-]/g, '_')}`, f));
    if (type === 'document') {
      const [a, b] = await Promise.all([fetch(pdfJsUrl).then((r) => r.blob()), fetch(pdfWorkerUrl).then((r) => r.blob())]);
      zip.file('lib/pdf.min.mjs', a);
      zip.file('lib/pdf.worker.min.mjs', b);
    }
    return zip.generateAsync({ type: 'blob', compression: 'STORE' }); // media sudah terkompresi
  }

  async function go(toApp) {
    setErr('');
    if (!files.length) return setErr('Tambahkan minimal satu file.');
    if (total > MAX_TOTAL) return setErr('Total ukuran maksimal 45 MB.');
    setBusy(true);
    try {
      const blob = await makeZip();
      if (toApp) {
        setHandoff({ zip: new File([blob], 'media-app.zip', { type: 'application/zip' }), name: title.slice(0, 30), color });
        nav('/create?from=handoff');
      } else downloadBlob(blob, 'media-app.zip');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Media App Maker" subtitle="Ubah foto, musik, video, atau PDF menjadi aplikasi Android yang berjalan offline — tanpa coding." />
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Card><CardContent><Stack spacing={2}>
          <ToggleButtonGroup exclusive value={type} onChange={(_, v) => { if (v) { setType(v); setFiles([]); } }} sx={{ flexWrap: 'wrap' }}>
            {Object.entries(TYPES).map(([k, t]) => <ToggleButton key={k} value={k} sx={{ gap: 1 }}>{t.icon}{t.label}</ToggleButton>)}
          </ToggleButtonGroup>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Judul aplikasi" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 30))} />
            <ColorField label="Warna" value={color} onChange={setColor} />
          </Stack>
          <Box component="label" sx={{ border: 2, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 2, p: 3, textAlign: 'center', cursor: 'pointer' }}>
            <input type="file" multiple hidden accept={TYPES[type].accept} onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
            <Typography fontWeight={600}>Pilih file {TYPES[type].label.toLowerCase()} (bisa banyak)</Typography>
            <Typography variant="caption" color="text.secondary">Total maks 45 MB • urutan sesuai daftar</Typography>
          </Box>
          {files.length > 0 && (
            <List dense>
              {files.map((f, i) => (
                <ListItem key={i} secondaryAction={<IconButton onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}><DeleteIcon /></IconButton>}>
                  <ListItemText primary={`${i + 1}. ${f.name}`} secondary={`${(f.size / 1048576).toFixed(2)} MB`} />
                </ListItem>
              ))}
            </List>
          )}
          <Typography variant="body2" color={total > MAX_TOTAL ? 'error' : 'text.secondary'}>Total: {(total / 1048576).toFixed(1)} MB</Typography>
          {busy && <LinearProgress />}
          {err && <Alert severity="error">{err}</Alert>}
          <Stack direction="row" spacing={1}>
            <Button variant="contained" size="large" disabled={busy} onClick={() => go(true)}>Jadikan aplikasi</Button>
            <Button disabled={busy} onClick={() => go(false)}>Unduh ZIP</Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">Pastikan Anda memiliki hak atas konten yang diunggah. Lagu/film berhak cipta tidak boleh didistribusikan tanpa izin.</Typography>
        </Stack></CardContent></Card>
      </Container>
    </>
  );
}
