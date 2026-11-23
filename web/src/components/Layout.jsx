import { useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Button, IconButton, Box, Container, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, ListSubheader, Avatar, Menu, MenuItem, Divider, Link, Stack, useMediaQuery, Tooltip, Chip, Grid
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HomeIcon from '@mui/icons-material/Home';
import AddBoxIcon from '@mui/icons-material/AddBox';
import AppsIcon from '@mui/icons-material/Apps';
import BuildIcon from '@mui/icons-material/Handyman';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SellIcon from '@mui/icons-material/Sell';
import AdminIcon from '@mui/icons-material/AdminPanelSettings';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import StorefrontIcon from '@mui/icons-material/Storefront';
import HubIcon from '@mui/icons-material/Hub';
import StarsIcon from '@mui/icons-material/Stars';
import CompareIcon from '@mui/icons-material/CompareArrows';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import InfoIcon from '@mui/icons-material/Info';
import MailIcon from '@mui/icons-material/Mail';
import AndroidIcon from '@mui/icons-material/Android';
import CloudIcon from '@mui/icons-material/Cloud';
import PermMediaIcon from '@mui/icons-material/PermMedia';
import { useAuth } from '../context/AuthContext';
import { useColorMode } from '../context/ColorMode';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'Apkify';

const MAIN = [
  { to: '/create', label: 'Buat Aplikasi', icon: <AddBoxIcon /> },
  { to: '/ai-studio', label: 'AI Studio', icon: <AutoAwesomeIcon />, hot: true },
  { to: '/templates', label: 'Template', icon: <DashboardCustomizeIcon /> },
  { to: '/market', label: 'Marketplace', icon: <StorefrontIcon /> },
  { to: '/tools', label: 'Tools', icon: <BuildIcon /> }
];
const MORE = [
  { to: '/dashboard', label: 'Studio (Aplikasi Saya)', icon: <AppsIcon /> },
  { to: '/hosting', label: 'Hosting gratis', icon: <CloudIcon /> },
  { to: '/media-app', label: 'Media App Maker', icon: <PermMediaIcon /> },
  { to: '/docs', label: 'Panduan', icon: <MenuBookIcon /> },
  { to: '/guides', label: 'Panduan per platform', icon: <HubIcon /> },
  { to: '/features', label: 'Fitur', icon: <StarsIcon /> },
  { to: '/compare', label: 'Bandingkan', icon: <CompareIcon /> },
  { to: '/pricing', label: 'Harga', icon: <SellIcon /> },
  { to: '/news', label: 'Berita', icon: <NewspaperIcon /> },
  { to: '/get-app', label: 'Aplikasi Android', icon: <AndroidIcon /> },
  { to: '/about', label: 'Tentang', icon: <InfoIcon /> },
  { to: '/contact', label: 'Kontak', icon: <MailIcon /> }
];

export default function Layout({ children }) {
  const { user, isAnon, isAdmin, logout } = useAuth();
  const { mode, toggle } = useColorMode();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const [moreEl, setMoreEl] = useState(null);
  const desktop = useMediaQuery((t) => t.breakpoints.up('lg'));
  const nav = useNavigate();
  const loc = useLocation();
  const active = (to) => (to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to));

  const more = isAdmin ? [...MORE, { to: '/admin', label: 'Admin', icon: <AdminIcon /> }] : MORE;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="sticky" color="inherit" sx={{ borderBottom: 1, borderColor: 'divider' }} elevation={0}>
        <Toolbar sx={{ gap: 0.5 }}>
          {!desktop && <IconButton edge="start" onClick={() => setOpen(true)} aria-label="menu"><MenuIcon /></IconButton>}
          <Box component={RouterLink} to="/" sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none', color: 'inherit', mr: 2 }}>
            <img src="/favicon.svg" width={30} height={30} alt="" />
            <Typography variant="h6" fontWeight={800}>{APP_NAME}</Typography>
          </Box>
          {desktop && <>
            {MAIN.map((n) => (
              <Button key={n.to} component={RouterLink} to={n.to} color={active(n.to) ? 'primary' : 'inherit'}>
                {n.label}{n.hot && <Chip label="baru" size="small" color="secondary" sx={{ ml: 0.5, height: 18, fontSize: 10 }} />}
              </Button>
            ))}
            <Button color="inherit" endIcon={<ExpandMoreIcon />} onClick={(e) => setMoreEl(e.currentTarget)}>Lainnya</Button>
            <Menu anchorEl={moreEl} open={!!moreEl} onClose={() => setMoreEl(null)}>
              {more.map((n) => (
                <MenuItem key={n.to} component={RouterLink} to={n.to} onClick={() => setMoreEl(null)} selected={active(n.to)}>
                  <ListItemIcon>{n.icon}</ListItemIcon>{n.label}
                </MenuItem>
              ))}
            </Menu>
          </>}
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Mode gelap/terang">
            <IconButton onClick={toggle}>{mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}</IconButton>
          </Tooltip>
          {user ? (
            <>
              <IconButton onClick={(e) => setAnchor(e.currentTarget)}>
                <Avatar src={user.photoURL || ''} sx={{ width: 32, height: 32 }}>{isAnon ? 'T' : (user.displayName || user.email || '?')[0].toUpperCase()}</Avatar>
              </IconButton>
              <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
                <MenuItem disabled><Typography variant="body2">{isAnon ? 'Mode tamu' : user.email}</Typography></MenuItem>
                <Divider />
                {isAnon && <MenuItem onClick={() => { setAnchor(null); nav('/register?next=/dashboard'); }}>Simpan ke akun (daftar)</MenuItem>}
                <MenuItem onClick={() => { setAnchor(null); nav('/dashboard'); }}>Aplikasi Saya</MenuItem>
                {!isAnon && <MenuItem onClick={() => { setAnchor(null); nav('/market/sell'); }}>Jual aplikasi</MenuItem>}
                <MenuItem onClick={async () => { setAnchor(null); await logout(); nav('/'); }}>{isAnon ? 'Akhiri sesi tamu' : 'Keluar'}</MenuItem>
              </Menu>
            </>
          ) : (
            <Button variant="contained" component={RouterLink} to="/login">Masuk</Button>
          )}
        </Toolbar>
      </AppBar>

      <Drawer open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 270 }} role="presentation" onClick={() => setOpen(false)}>
          <Box sx={{ p: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
            <img src="/favicon.svg" width={28} height={28} alt="" />
            <Typography fontWeight={800}>{APP_NAME}</Typography>
          </Box>
          <Divider />
          <List dense>
            <ListItemButton component={RouterLink} to="/" selected={active('/')}><ListItemIcon><HomeIcon /></ListItemIcon><ListItemText primary="Beranda" /></ListItemButton>
            {MAIN.map((n) => (
              <ListItemButton key={n.to} component={RouterLink} to={n.to} selected={active(n.to)}>
                <ListItemIcon>{n.icon}</ListItemIcon><ListItemText primary={n.label} />
              </ListItemButton>
            ))}
            <ListSubheader>Lainnya</ListSubheader>
            {more.map((n) => (
              <ListItemButton key={n.to} component={RouterLink} to={n.to} selected={active(n.to)}>
                <ListItemIcon>{n.icon}</ListItemIcon><ListItemText primary={n.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flex: 1 }}>{children}</Box>

      <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', py: 5, mt: 6 }}>
        <Container>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Typography fontWeight={800}>{APP_NAME}</Typography>
              <Typography variant="body2" color="text.secondary">Website, ZIP, atau HTML ke APK & AAB — gratis, tanpa watermark.</Typography>
            </Grid>
            {[
              ['Produk', [['/create', 'Buat aplikasi'], ['/ai-studio', 'AI Studio'], ['/templates', 'Template'], ['/market', 'Marketplace'], ['/hosting', 'Hosting gratis'], ['/media-app', 'Media App'], ['/get-app', 'Aplikasi Android']]],
              ['Sumber daya', [['/docs', 'Panduan'], ['/guides', 'Per platform'], ['/docs#publish', 'Publikasi Play Store'], ['/tools', 'Tools gratis'], ['/news', 'Berita'], ['/website-to-app', 'Website ke aplikasi'], ['/website-to-exe', 'Website ke EXE'], ['/website-to-ipa', 'Website ke IPA'], ['/html-to-app', 'HTML ke APK']]],
              ['Perusahaan', [['/about', 'Tentang'], ['/features', 'Fitur'], ['/compare', 'Bandingkan'], ['/pricing', 'Harga'], ['/contact', 'Kontak'], ['/privacy', 'Kebijakan Privasi'], ['/terms', 'Syarat & Ketentuan']]]
            ].map(([h, links]) => (
              <Grid item xs={6} md={2.66} key={h}>
                <Typography fontWeight={700} variant="body2" gutterBottom>{h}</Typography>
                <Stack spacing={0.5}>{links.map(([to, l]) => <Link key={to} component={RouterLink} to={to} variant="body2" color="text.secondary" underline="hover">{l}</Link>)}</Stack>
              </Grid>
            ))}
          </Grid>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>© {new Date().getFullYear()} {APP_NAME}. Android adalah merek dagang Google LLC.</Typography>
        </Container>
      </Box>
    </Box>
  );
}
