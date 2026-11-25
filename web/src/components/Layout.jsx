import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Container, Typography, Button, IconButton, Drawer, Avatar, Menu, MenuItem, Divider, Link, Stack,
  useMediaQuery, Tooltip, Popover, ButtonBase
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useAuth } from '../context/AuthContext';
import { useColorMode } from '../context/ColorMode';
import { Logo } from './ui';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'Apkify';

// Arsitektur informasi: dua menu berkelompok + tautan langsung yang paling sering dicari.
const GROUPS = [
  {
    id: 'produk', label: 'Produk', items: [
      ['/create', 'Buat aplikasi', 'Website, ZIP, atau HTML ke APK, AAB, IPA, EXE'],
      ['/ai-studio', 'AI Studio', 'Jelaskan aplikasinya, AI menulis kodenya'],
      ['/templates', 'Template', 'Toko, link in bio, kalkulator, kuis'],
      ['/hosting', 'Hosting gratis', 'Situs statis di subdomain, siap jadi aplikasi'],
      ['/media-app', 'Media App Maker', 'Radio, podcast, atau galeri video'],
      ['/market', 'Marketplace', 'Jual-beli aplikasi jadi'],
      ['/get-app', 'Aplikasi Android', 'Kelola build dari HP']
    ]
  },
  {
    id: 'sumber', label: 'Sumber daya', items: [
      ['/docs', 'Panduan', 'Dari konfigurasi sampai Play Store'],
      ['/docs/api', 'Referensi API', 'window.Apkify — 60+ fitur native'],
      ['/guides', 'Per platform', 'Lovable, Bolt, WordPress, Shopify, dll.'],
      ['/tools', 'Tools gratis', 'Ikon, feature graphic, mockup, QR'],
      ['/features', 'Semua fitur', 'Daftar lengkap kemampuan'],
      ['/news', 'Berita', 'Rilis & pembaruan']
    ]
  }
];
const DIRECT = [['/pricing', 'Harga'], ['/compare', 'Bandingkan']];

function MegaMenu({ group, active }) {
  const [el, setEl] = useState(null);
  const loc = useLocation();
  useEffect(() => setEl(null), [loc.pathname]);
  const on = group.items.some(([to]) => active(to));
  return (
    <>
      <Button color="inherit" aria-haspopup="true" aria-expanded={!!el} onClick={(e) => setEl(e.currentTarget)}
        endIcon={<ExpandMoreIcon sx={{ transition: 'transform 160ms', transform: el ? 'rotate(180deg)' : 'none' }} />}
        sx={{ color: on || el ? 'text.primary' : 'text.secondary', px: 1.25 }}>
        {group.label}
      </Button>
      <Popover open={!!el} anchorEl={el} onClose={() => setEl(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { mt: 1, p: 1, width: 560 } } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
          {group.items.map(([to, t, d]) => (
            <ButtonBase key={to} component={RouterLink} to={to} onClick={() => setEl(null)}
              sx={{
                display: 'block', textAlign: 'left', borderRadius: 1.5, px: 1.5, py: 1.25,
                bgcolor: active(to) ? 'action.selected' : 'transparent',
                '&:hover, &.Mui-focusVisible': { bgcolor: 'action.hover' }
              }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{t}</Typography>
              <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>{d}</Typography>
            </ButtonBase>
          ))}
        </Box>
      </Popover>
    </>
  );
}

export default function Layout({ children }) {
  const { user, isAnon, isAdmin, logout } = useAuth();
  const { mode, toggle } = useColorMode();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const desktop = useMediaQuery((t) => t.breakpoints.up('md'));
  const nav = useNavigate();
  const loc = useLocation();
  const active = (to) => (to === '/' ? loc.pathname === '/' : loc.pathname === to || loc.pathname.startsWith(`${to}/`));
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  const bare = ['/login', '/register'].includes(loc.pathname);

  const initial = isAnon ? 'T' : (user?.displayName || user?.email || '?')[0].toUpperCase();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box component="a" href="#konten" sx={{ position: 'absolute', left: -9999, '&:focus': { left: 12, top: 12, zIndex: 2000, bgcolor: 'background.paper', p: 1, borderRadius: 1, border: 1, borderColor: 'divider' } }}>
        Lewati ke konten
      </Box>
      <Box component="header" sx={{
        position: 'sticky', top: 0, zIndex: 1100, borderBottom: 1, borderColor: 'divider',
        bgcolor: (t) => alpha(t.palette.background.default, 0.82), backdropFilter: 'saturate(180%) blur(12px)'
      }}>
        <Container maxWidth="lg" sx={{ height: 56, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box component={RouterLink} to="/" aria-label={`${APP_NAME} beranda`} sx={{ textDecoration: 'none', color: 'text.primary', mr: { xs: 'auto', md: 3 } }}>
            <Logo size={22} name={APP_NAME} />
          </Box>
          {desktop && (
            <Stack direction="row" component="nav" aria-label="Navigasi utama" spacing={0.25} sx={{ flex: 1 }}>
              {GROUPS.map((g) => <MegaMenu key={g.id} group={g} active={active} />)}
              {DIRECT.map(([to, l]) => (
                <Button key={to} component={RouterLink} to={to} color="inherit" sx={{ px: 1.25, color: active(to) ? 'text.primary' : 'text.secondary' }}>{l}</Button>
              ))}
            </Stack>
          )}
          <Tooltip title={mode === 'light' ? 'Mode gelap' : 'Mode terang'}>
            <IconButton onClick={toggle} aria-label="Ganti mode warna" size="small" sx={{ width: 32, height: 32 }}>
              {mode === 'light' ? <DarkModeIcon sx={{ fontSize: 18 }} /> : <LightModeIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
          {desktop && (user ? (
            <>
              <Button component={RouterLink} to="/dashboard" color="inherit" sx={{ color: active('/dashboard') ? 'text.primary' : 'text.secondary', ml: 0.5 }}>Studio</Button>
              <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="Menu akun" size="small" sx={{ ml: 0.5 }}>
                <Avatar src={user.photoURL || ''} sx={{ width: 28, height: 28 }}>{initial}</Avatar>
              </IconButton>
              <Button component={RouterLink} to="/create" variant="contained" sx={{ ml: 1 }}>Buat aplikasi</Button>
            </>
          ) : (
            <>
              <Button component={RouterLink} to="/login" color="inherit" sx={{ ml: 0.5, color: 'text.secondary' }}>Masuk</Button>
              <Button component={RouterLink} to="/create" variant="contained" sx={{ ml: 1 }}>Buat aplikasi</Button>
            </>
          ))}
          {!desktop && (
            <IconButton onClick={() => setOpen(true)} aria-label="Buka menu" sx={{ ml: 0.5, width: 36, height: 36 }}><MenuIcon sx={{ fontSize: 20 }} /></IconButton>
          )}
        </Container>
      </Box>

      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 220 } } }}>
        <Box sx={{ px: 1.25, py: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{isAnon ? 'Mode tamu' : (user?.displayName || 'Akun')}</Typography>
          {!isAnon && <Typography variant="caption" component="div" noWrap>{user?.email}</Typography>}
        </Box>
        <Divider sx={{ my: 0.5 }} />
        {isAnon && <MenuItem onClick={() => { setAnchor(null); nav('/register?next=/dashboard'); }}>Simpan ke akun permanen</MenuItem>}
        <MenuItem onClick={() => { setAnchor(null); nav('/dashboard'); }}>Aplikasi saya</MenuItem>
        {!isAnon && <MenuItem onClick={() => { setAnchor(null); nav('/market/sell'); }}>Jual aplikasi</MenuItem>}
        {isAdmin && <MenuItem onClick={() => { setAnchor(null); nav('/admin'); }}>Admin</MenuItem>}
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={async () => { setAnchor(null); await logout(); nav('/'); }}>{isAnon ? 'Akhiri sesi tamu' : 'Keluar'}</MenuItem>
      </Menu>

      {/* Navigasi seluler: panel penuh, kelompok jelas, aksi utama di bawah */}
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 380 } } } }}>
        <Stack sx={{ height: '100%' }}>
          <Stack direction="row" alignItems="center" sx={{ height: 56, px: 2.5, borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ flex: 1 }}><Logo size={22} name={APP_NAME} /></Box>
            <IconButton onClick={() => setOpen(false)} aria-label="Tutup menu"><CloseIcon sx={{ fontSize: 20 }} /></IconButton>
          </Stack>
          <Box component="nav" aria-label="Navigasi seluler" sx={{ flex: 1, px: 2.5, py: 1 }}>
            {user && (
              <MobileLink to="/dashboard" label="Studio — aplikasi saya" active={active('/dashboard')} />
            )}
            {GROUPS.map((g) => (
              <Box key={g.id} sx={{ mt: 2.5 }}>
                <Typography variant="overline" color="text.secondary">{g.label}</Typography>
                {g.items.map(([to, t]) => <MobileLink key={to} to={to} label={t} active={active(to)} />)}
              </Box>
            ))}
            <Box sx={{ mt: 2.5 }}>
              <Typography variant="overline" color="text.secondary">Lainnya</Typography>
              {[...DIRECT, ['/about', 'Tentang'], ['/contact', 'Kontak'], ...(isAdmin ? [['/admin', 'Admin']] : [])].map(([to, l]) => <MobileLink key={to} to={to} label={l} active={active(to)} />)}
            </Box>
          </Box>
          <Stack spacing={1} sx={{ p: 2.5, borderTop: 1, borderColor: 'divider' }}>
            <Button component={RouterLink} to="/create" variant="contained" size="large" fullWidth>Buat aplikasi</Button>
            {user
              ? <Button variant="outlined" size="large" fullWidth onClick={async () => { await logout(); nav('/'); }}>{isAnon ? 'Akhiri sesi tamu' : `Keluar · ${user.email || ''}`}</Button>
              : <Button component={RouterLink} to="/login" variant="outlined" size="large" fullWidth>Masuk</Button>}
          </Stack>
        </Stack>
      </Drawer>

      <Box component="main" id="konten" sx={{ flex: 1 }}>{children}</Box>

      {!bare && <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', mt: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 } }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: '1.4fr 1fr 1fr 1fr' }, gap: { xs: 4, md: 5 } }}>
            <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
              <Logo size={20} name={APP_NAME} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, maxWidth: 280 }}>
                Satu konfigurasi, lima platform. Build di cloud, tanpa watermark, kunci tanda tangan Anda tetap.
              </Typography>
            </Box>
            {[
              ['Produk', [['/create', 'Buat aplikasi'], ['/ai-studio', 'AI Studio'], ['/templates', 'Template'], ['/hosting', 'Hosting'], ['/market', 'Marketplace'], ['/pricing', 'Harga']]],
              ['Konversi', [['/website-to-app', 'Website ke aplikasi'], ['/html-to-app', 'HTML ke APK'], ['/website-to-exe', 'Website ke EXE'], ['/website-to-ipa', 'Website ke IPA'], ['/website-to-desktop-app', 'Website ke desktop']]],
              ['Sumber daya', [['/docs', 'Panduan'], ['/docs/api', 'Referensi API'], ['/guides', 'Per platform'], ['/tools', 'Tools'], ['/compare', 'Bandingkan'], ['/about', 'Tentang'], ['/contact', 'Kontak']]]
            ].map(([h, links]) => (
              <Box key={h}>
                <Typography variant="overline" color="text.secondary" component="h2" sx={{ mb: 1.25 }}>{h}</Typography>
                <Stack spacing={1}>
                  {links.map(([to, l]) => <Link key={to} component={RouterLink} to={to} variant="body2" sx={{ color: 'text.secondary', fontWeight: 400, '&:hover': { color: 'text.primary' } }}>{l}</Link>)}
                </Stack>
              </Box>
            ))}
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" sx={{ mt: 6, pt: 3, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption">© {new Date().getFullYear()} {APP_NAME}. Android adalah merek dagang Google LLC.</Typography>
            <Stack direction="row" spacing={2.5}>
              <Link component={RouterLink} to="/privacy" variant="caption" sx={{ color: 'text.secondary', fontWeight: 400 }}>Privasi</Link>
              <Link component={RouterLink} to="/terms" variant="caption" sx={{ color: 'text.secondary', fontWeight: 400 }}>Ketentuan</Link>
            </Stack>
          </Stack>
        </Container>
      </Box>}
    </Box>
  );
}

function MobileLink({ to, label, active }) {
  return (
    <Box component={RouterLink} to={to} aria-current={active ? 'page' : undefined} sx={{
      display: 'flex', alignItems: 'center', minHeight: 44, textDecoration: 'none', fontSize: 15, fontWeight: 500,
      color: active ? 'primary.main' : 'text.primary', borderBottom: 1, borderColor: 'divider'
    }}>{label}</Box>
  );
}
