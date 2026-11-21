import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Container, Typography, Card, CardContent, Tabs, Tab, TextField, Grid, Stack, Button, Switch,
  FormControlLabel, Alert, Box, MenuItem, Divider, LinearProgress, Avatar, ToggleButtonGroup,
  ToggleButton, Accordion, AccordionSummary, AccordionDetails, IconButton, Chip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LanguageIcon from '@mui/icons-material/Language';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import CodeIcon from '@mui/icons-material/Code';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { ref, get } from 'firebase/database';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { clearCache } from '../lib/cache';
import FileDrop from '../components/FileDrop';
import ColorField from '../components/ColorField';
import { validatePackage, suggestPackage, normalizeUrl, validateUrl, isHex } from '../lib/validators';
import { generateLetterIcon, loadImage, fileToDataUrl, drawSquare, canvasToBlob } from '../lib/iconGen';

const DEFAULT = {
  name: '',
  packageName: '',
  versionName: '1.0.0',
  source: { type: 'url', url: '' },
  colors: { primary: '#4f46e5', statusBar: '#3730a3', splashBg: '#ffffff' },
  orientation: 'unspecified',
  features: {
    pullToRefresh: true, fileUpload: true, downloads: true, externalLinksInBrowser: true,
    offlinePage: true, geolocation: false, camera: false, zoom: false, keepAwake: false,
    fullscreen: false, sideMenu: false, admob: false, onesignal: false, cacheMode: 'default'
  },
  sideMenu: { about: '', contactEmail: '', shareText: '', links: [] },
  admob: { appId: '', bannerId: '' },
  onesignal: { appId: '' },
  userAgentSuffix: ''
};

const FEATURES = [
  ['pullToRefresh', 'Tarik untuk refresh'],
  ['fileUpload', 'Upload file dari form'],
  ['downloads', 'Dukungan download file'],
  ['externalLinksInBrowser', 'Link luar dibuka di browser'],
  ['offlinePage', 'Halaman offline yang rapi'],
  ['geolocation', 'Izin lokasi (GPS)'],
  ['camera', 'Izin kamera & mikrofon'],
  ['zoom', 'Izinkan pinch zoom'],
  ['keepAwake', 'Layar tetap menyala'],
  ['fullscreen', 'Layar penuh (sembunyikan status bar)']
];

const MAX_ZIP_MB = 50;
const MAX_HTML_KB = 500;

export default function Create() {
  const { appId } = useParams();
  const [qs] = useSearchParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [cfg, setCfg] = useState(() => ({
    ...DEFAULT,
    name: qs.get('name') || '',
    source: { type: qs.get('type') || 'url', url: qs.get('url') || '' }
  }));
  const [pkgTouched, setPkgTouched] = useState(false);
  const [zipFile, setZipFile] = useState(null);
  const [html, setHtml] = useState('');
  const [iconMode, setIconMode] = useState('generate');
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState('');
  const [existingIconId, setExistingIconId] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ label: '', value: 0 });
  const [error, setError] = useState('');
  const genCanvas = useRef(null);

  // Mode edit: muat konfigurasi app yang sudah ada (1x baca RTDB)
  useEffect(() => {
    if (!appId || !user) return;
    get(ref(db, `apps/${user.uid}/${appId}`)).then((s) => {
      const a = s.val();
      if (!a?.config) return;
      setCfg({ ...DEFAULT, ...a.config, features: { ...DEFAULT.features, ...a.config.features }, sideMenu: { ...DEFAULT.sideMenu, ...a.config.sideMenu } });
      setPkgTouched(true);
      if (a.config.iconFileId) { setExistingIconId(a.config.iconFileId); setIconMode('keep'); }
    });
  }, [appId, user]);

  const set = (path, value) => setCfg((c) => {
    const n = structuredClone(c);
    const keys = path.split('.');
    let o = n;
    keys.slice(0, -1).forEach((k) => { o = o[k]; });
    o[keys.at(-1)] = value;
    return n;
  });

  // Saran package name otomatis
  useEffect(() => {
    if (!pkgTouched) set('packageName', suggestPackage(cfg.name, cfg.source.type === 'url' ? normalizeUrl(cfg.source.url) : ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.name, cfg.source.url, cfg.source.type, pkgTouched]);

  // Pratinjau ikon
  useEffect(() => {
    if (iconMode === 'generate') {
      const c = generateLetterIcon({ text: cfg.name || 'A', bg1: cfg.colors.primary, bg2: cfg.colors.statusBar, size: 512, radius: 0 });
      genCanvas.current = c;
      setIconPreview(c.toDataURL('image/png'));
    } else if (iconMode === 'upload' && iconFile) {
      fileToDataUrl(iconFile).then(setIconPreview);
    } else if (iconMode === 'keep') {
      setIconPreview('');
    }
  }, [iconMode, iconFile, cfg.name, cfg.colors.primary, cfg.colors.statusBar]);

  const errors = useMemo(() => {
    const e = {};
    if (!cfg.name.trim()) e.name = 'Nama aplikasi wajib diisi';
    else if (cfg.name.length > 30) e.name = 'Maksimal 30 karakter';
    const pe = validatePackage(cfg.packageName);
    if (pe) e.packageName = pe;
    if (!/^\d+(\.\d+){0,3}$/.test(cfg.versionName)) e.versionName = 'Contoh: 1.0.0';
    if (cfg.source.type === 'url') { const ue = validateUrl(cfg.source.url); if (ue) e.url = ue; }
    if (cfg.source.type === 'zip' && !zipFile && !cfg.source.fileId) e.zip = 'Pilih file ZIP';
    if (cfg.source.type === 'html' && !html.trim() && !cfg.source.fileId) e.html = 'Tempel kode HTML';
    if (Object.values(cfg.colors).some((c) => !isHex(c))) e.colors = 'Warna tidak valid';
    if (cfg.features.admob && !/^ca-app-pub-\d+~\d+$/.test(cfg.admob.appId)) e.admob = 'AdMob App ID: ca-app-pub-xxx~yyy';
    if (cfg.features.onesignal && !/^[0-9a-f-]{36}$/i.test(cfg.onesignal.appId)) e.onesignal = 'OneSignal App ID (UUID)';
    if (iconMode === 'upload' && !iconFile) e.icon = 'Pilih gambar ikon';
    return e;
  }, [cfg, zipFile, html, iconMode, iconFile]);

  async function prepareIcon() {
    if (iconMode === 'keep' && existingIconId) return existingIconId;
    let canvas;
    if (iconMode === 'generate') canvas = genCanvas.current;
    else {
      const img = await loadImage(await fileToDataUrl(iconFile));
      if (img.width < 192 || img.height < 192) throw new Error('Ikon minimal 192×192 px (disarankan 512×512).');
      canvas = drawSquare(img, 512);
    }
    const blob = await canvasToBlob(canvas);
    const f = new File([blob], 'icon.png', { type: 'image/png' });
    setProgress({ label: 'Mengunggah ikon…', value: 0 });
    const r = await api.upload('/api/uploads', f, { kind: 'icon', onProgress: (v) => setProgress({ label: 'Mengunggah ikon…', value: v }) });
    return r.fileId;
  }

  async function submit() {
    setError('');
    if (Object.keys(errors).length) { setError(Object.values(errors)[0]); return; }
    setBusy(true);
    try {
      const iconFileId = await prepareIcon();
      const source = { type: cfg.source.type };
      if (source.type === 'url') source.url = normalizeUrl(cfg.source.url);
      if (source.type === 'zip') {
        if (zipFile) {
          if (zipFile.size > MAX_ZIP_MB * 1024 * 1024) throw new Error(`ZIP maksimal ${MAX_ZIP_MB} MB`);
          const r = await api.upload('/api/uploads', zipFile, { kind: 'zip', onProgress: (v) => setProgress({ label: 'Mengunggah ZIP…', value: v }) });
          source.fileId = r.fileId;
        } else source.fileId = cfg.source.fileId;
      }
      if (source.type === 'html') {
        if (html.trim()) {
          if (new Blob([html]).size > MAX_HTML_KB * 1024) throw new Error(`HTML maksimal ${MAX_HTML_KB} KB`);
          source.html = html;
        } else source.fileId = cfg.source.fileId;
      }
      setProgress({ label: 'Mengirim ke antrean build…', value: 100 });
      const body = { appId: appId || null, config: { ...cfg, source, iconFileId } };
      const res = await api.post('/api/builds', body);
      clearCache(`apps:${user.uid}`);
      nav(`/build/${res.buildId}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const f = cfg.features;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>{appId ? 'Perbarui aplikasi' : 'Buat aplikasi Android'}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Isi data di bawah, lalu klik Build. Hasilnya APK (untuk dipasang langsung) dan AAB (untuk Google Play).</Typography>

      {/* 1. SUMBER */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>1. Sumber konten</Typography>
          <Tabs value={cfg.source.type} onChange={(_, v) => set('source.type', v)} sx={{ mb: 2 }} variant="fullWidth">
            <Tab value="url" icon={<LanguageIcon />} iconPosition="start" label="Website" />
            <Tab value="zip" icon={<FolderZipIcon />} iconPosition="start" label="ZIP" />
            <Tab value="html" icon={<CodeIcon />} iconPosition="start" label="HTML" />
          </Tabs>
          {cfg.source.type === 'url' && (
            <TextField label="Alamat website" placeholder="https://tokoanda.com" value={cfg.source.url}
              onChange={(e) => set('source.url', e.target.value)} error={!!cfg.source.url && !!errors.url} helperText={(cfg.source.url && errors.url) || 'Website harus HTTPS dan bisa dibuka di HP.'} />
          )}
          {cfg.source.type === 'zip' && (
            <>
              <FileDrop accept=".zip,application/zip" file={zipFile} onFile={setZipFile}
                hint={`ZIP berisi index.html di root (mis. folder dist dari React/Vite). Maks ${MAX_ZIP_MB} MB.`} />
              {cfg.source.fileId && !zipFile && <Alert severity="info" sx={{ mt: 1 }}>ZIP sebelumnya akan dipakai lagi bila tidak memilih file baru.</Alert>}
            </>
          )}
          {cfg.source.type === 'html' && (
            <TextField multiline minRows={8} maxRows={20} label="Kode HTML" value={html} onChange={(e) => setHtml(e.target.value)}
              placeholder="<!doctype html><html>…</html>" helperText={`Satu halaman HTML (CSS/JS inline). Maks ${MAX_HTML_KB} KB.`}
              InputProps={{ sx: { fontFamily: 'monospace', fontSize: 13 } }} />
          )}
        </CardContent>
      </Card>

      {/* 2. IDENTITAS */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>2. Identitas aplikasi</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField label="Nama aplikasi" value={cfg.name} onChange={(e) => set('name', e.target.value)} error={!!cfg.name && !!errors.name} helperText={errors.name || 'Tampil di bawah ikon HP'} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Versi" value={cfg.versionName} onChange={(e) => set('versionName', e.target.value)} error={!!errors.versionName} helperText={errors.versionName || 'Kode versi dinaikkan otomatis tiap build'} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Package name" value={cfg.packageName} disabled={!!appId}
                onChange={(e) => { setPkgTouched(true); set('packageName', e.target.value.toLowerCase()); }}
                error={!!errors.packageName} helperText={errors.packageName || (appId ? 'Package name tidak bisa diubah agar update terpasang di atas versi lama.' : 'ID unik di Play Store. Tidak bisa diubah setelah publish.')} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 3. TAMPILAN */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>3. Ikon, splash & warna</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="flex-start">
            <Box sx={{ textAlign: 'center' }}>
              <Avatar variant="rounded" src={iconPreview} sx={{ width: 96, height: 96, borderRadius: 4, mb: 1 }}>
                {iconMode === 'keep' ? 'Ikon lama' : ''}
              </Avatar>
              <Typography variant="caption" color="text.secondary">Pratinjau</Typography>
            </Box>
            <Box sx={{ flex: 1, width: '100%' }}>
              <ToggleButtonGroup exclusive size="small" value={iconMode} onChange={(_, v) => v && setIconMode(v)} sx={{ mb: 2 }}>
                <ToggleButton value="generate">Buat otomatis</ToggleButton>
                <ToggleButton value="upload">Upload sendiri</ToggleButton>
                {existingIconId && <ToggleButton value="keep">Pakai ikon lama</ToggleButton>}
              </ToggleButtonGroup>
              {iconMode === 'upload' && <FileDrop accept="image/png,image/jpeg,image/webp" file={iconFile} onFile={setIconFile} hint="PNG/JPG persegi, ideal 512×512 px" />}
              {iconMode === 'generate' && <Typography variant="body2" color="text.secondary">Ikon dibuat dari huruf awal nama aplikasi dan warna utama.</Typography>}
            </Box>
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}><ColorField label="Warna utama" value={cfg.colors.primary} onChange={(v) => set('colors.primary', v)} /></Grid>
            <Grid item xs={12} sm={4}><ColorField label="Warna status bar" value={cfg.colors.statusBar} onChange={(v) => set('colors.statusBar', v)} /></Grid>
            <Grid item xs={12} sm={4}><ColorField label="Latar splash" value={cfg.colors.splashBg} onChange={(v) => set('colors.splashBg', v)} /></Grid>
            <Grid item xs={12} sm={6}>
              <TextField select label="Orientasi layar" value={cfg.orientation} onChange={(e) => set('orientation', e.target.value)}>
                <MenuItem value="unspecified">Otomatis</MenuItem>
                <MenuItem value="portrait">Potret</MenuItem>
                <MenuItem value="landscape">Lanskap</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select label="Mode cache WebView" value={f.cacheMode} onChange={(e) => set('features.cacheMode', e.target.value)}
                helperText="‘Utamakan cache’ = lebih cepat & hemat kuota, konten bisa sedikit tertinggal">
                <MenuItem value="default">Standar (ikuti header server)</MenuItem>
                <MenuItem value="cacheElseNetwork">Utamakan cache</MenuItem>
                <MenuItem value="noCache">Selalu ambil terbaru</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 4. FITUR */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>4. Fitur</Typography>
          <Grid container>
            {FEATURES.map(([k, label]) => (
              <Grid item xs={12} sm={6} key={k}>
                <FormControlLabel control={<Switch checked={!!f[k]} onChange={(e) => set(`features.${k}`, e.target.checked)} />} label={label} />
              </Grid>
            ))}
          </Grid>

          <Accordion disableGutters sx={{ mt: 2 }} expanded={f.sideMenu} onChange={(_, v) => set('features.sideMenu', v)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <FormControlLabel onClick={(e) => e.stopPropagation()} control={<Switch checked={f.sideMenu} onChange={(e) => set('features.sideMenu', e.target.checked)} />} label="Menu samping (Tentang, Kontak, Bagikan, Link sosial)" />
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <TextField label="Teks Tentang" multiline minRows={2} value={cfg.sideMenu.about} onChange={(e) => set('sideMenu.about', e.target.value)} />
                <TextField label="Email kontak" value={cfg.sideMenu.contactEmail} onChange={(e) => set('sideMenu.contactEmail', e.target.value)} />
                <TextField label="Teks bagikan" value={cfg.sideMenu.shareText} onChange={(e) => set('sideMenu.shareText', e.target.value)} placeholder="Coba aplikasi ini!" />
                {cfg.sideMenu.links.map((l, i) => (
                  <Stack direction="row" spacing={1} key={i}>
                    <TextField label="Label" value={l.label} onChange={(e) => { const L = [...cfg.sideMenu.links]; L[i] = { ...l, label: e.target.value }; set('sideMenu.links', L); }} />
                    <TextField label="URL" value={l.url} onChange={(e) => { const L = [...cfg.sideMenu.links]; L[i] = { ...l, url: e.target.value }; set('sideMenu.links', L); }} />
                    <IconButton onClick={() => set('sideMenu.links', cfg.sideMenu.links.filter((_, j) => j !== i))}><DeleteIcon /></IconButton>
                  </Stack>
                ))}
                {cfg.sideMenu.links.length < 8 && (
                  <Button startIcon={<AddIcon />} onClick={() => set('sideMenu.links', [...cfg.sideMenu.links, { label: '', url: '' }])}>Tambah link</Button>
                )}
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Accordion disableGutters expanded={f.admob} onChange={(_, v) => set('features.admob', v)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <FormControlLabel onClick={(e) => e.stopPropagation()} control={<Switch checked={f.admob} onChange={(e) => set('features.admob', e.target.checked)} />} label={<>Iklan AdMob <Chip size="small" label="pendapatan untuk Anda" sx={{ ml: 1 }} /></>} />
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2}>
                <TextField label="AdMob App ID" placeholder="ca-app-pub-0000000000000000~0000000000" value={cfg.admob.appId} onChange={(e) => set('admob.appId', e.target.value.trim())} error={!!errors.admob} helperText={errors.admob} />
                <TextField label="Banner Ad Unit ID" placeholder="ca-app-pub-0000000000000000/0000000000" value={cfg.admob.bannerId} onChange={(e) => set('admob.bannerId', e.target.value.trim())} />
              </Stack>
            </AccordionDetails>
          </Accordion>

          <Accordion disableGutters expanded={f.onesignal} onChange={(_, v) => set('features.onesignal', v)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <FormControlLabel onClick={(e) => e.stopPropagation()} control={<Switch checked={f.onesignal} onChange={(e) => set('features.onesignal', e.target.checked)} />} label="Push notification (OneSignal)" />
            </AccordionSummary>
            <AccordionDetails>
              <TextField label="OneSignal App ID" value={cfg.onesignal.appId} onChange={(e) => set('onesignal.appId', e.target.value.trim())} error={!!errors.onesignal} helperText={errors.onesignal || 'Dashboard OneSignal > Settings > Keys & IDs'} />
            </AccordionDetails>
          </Accordion>

          <TextField sx={{ mt: 2 }} label="Akhiran User-Agent (opsional)" value={cfg.userAgentSuffix} onChange={(e) => set('userAgentSuffix', e.target.value.slice(0, 40))}
            helperText="Ditambahkan ke User-Agent agar server Anda bisa mendeteksi pengunjung dari aplikasi, mis. ApkifyApp" />
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {busy && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>{progress.label}</Typography>
          <LinearProgress variant={progress.value ? 'determinate' : 'indeterminate'} value={progress.value} />
        </Box>
      )}
      <Button size="large" variant="contained" fullWidth startIcon={<RocketLaunchIcon />} disabled={busy} onClick={submit}>
        {busy ? 'Memproses…' : 'Build APK & AAB'}
      </Button>
    </Container>
  );
}
