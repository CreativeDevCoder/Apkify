import { useState } from 'react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Button, IconButton, Box, Container, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, Avatar, Menu, MenuItem, Divider, Link, Stack, useMediaQuery, Tooltip
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import HomeIcon from '@mui/icons-material/Home';
import AddBoxIcon from '@mui/icons-material/AddBox';
import AppsIcon from '@mui/icons-material/Apps';
import BuildIcon from '@mui/icons-material/Handyman';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SellIcon from '@mui/icons-material/Sell';
import AdminIcon from '@mui/icons-material/AdminPanelSettings';
import { useAuth } from '../context/AuthContext';
import { useColorMode } from '../context/ColorMode';

const APP_NAME = import.meta.env.VITE_APP_NAME || 'Apkify';

const NAV = [
  { to: '/', label: 'Beranda', icon: <HomeIcon /> },
  { to: '/create', label: 'Buat Aplikasi', icon: <AddBoxIcon /> },
  { to: '/dashboard', label: 'Aplikasi Saya', icon: <AppsIcon /> },
  { to: '/tools', label: 'Tools Gratis', icon: <BuildIcon /> },
  { to: '/docs', label: 'Panduan', icon: <MenuBookIcon /> },
  { to: '/pricing', label: 'Harga', icon: <SellIcon /> }
];

export default function Layout({ children }) {
  const { user, isAdmin, logout } = useAuth();
  const { mode, toggle } = useColorMode();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const desktop = useMediaQuery((t) => t.breakpoints.up('md'));
  const nav = useNavigate();
  const loc = useLocation();

  const items = isAdmin ? [...NAV, { to: '/admin', label: 'Admin', icon: <AdminIcon /> }] : NAV;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="sticky" color="inherit" sx={{ borderBottom: 1, borderColor: 'divider' }} elevation={0}>
        <Toolbar sx={{ gap: 1 }}>
          {!desktop && <IconButton edge="start" onClick={() => setOpen(true)} aria-label="menu"><MenuIcon /></IconButton>}
          <Box component={RouterLink} to="/" sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none', color: 'inherit', mr: 2 }}>
            <img src="/favicon.svg" width={30} height={30} alt="" />
            <Typography variant="h6" fontWeight={800}>{APP_NAME}</Typography>
          </Box>
          {desktop && items.slice(1).map((n) => (
            <Button key={n.to} component={RouterLink} to={n.to} color={loc.pathname.startsWith(n.to) ? 'primary' : 'inherit'}>{n.label}</Button>
          ))}
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Mode gelap/terang">
            <IconButton onClick={toggle}>{mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}</IconButton>
          </Tooltip>
          {user ? (
            <>
              <IconButton onClick={(e) => setAnchor(e.currentTarget)}>
                <Avatar src={user.photoURL || ''} sx={{ width: 32, height: 32 }}>{(user.displayName || user.email || '?')[0].toUpperCase()}</Avatar>
              </IconButton>
              <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
                <MenuItem disabled><Typography variant="body2">{user.email}</Typography></MenuItem>
                <Divider />
                <MenuItem onClick={() => { setAnchor(null); nav('/dashboard'); }}>Aplikasi Saya</MenuItem>
                <MenuItem onClick={async () => { setAnchor(null); await logout(); nav('/'); }}>Keluar</MenuItem>
              </Menu>
            </>
          ) : (
            <Button variant="contained" component={RouterLink} to="/login">Masuk</Button>
          )}
        </Toolbar>
      </AppBar>

      <Drawer open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 260 }} role="presentation" onClick={() => setOpen(false)}>
          <Box sx={{ p: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
            <img src="/favicon.svg" width={28} height={28} alt="" />
            <Typography fontWeight={800}>{APP_NAME}</Typography>
          </Box>
          <Divider />
          <List>
            {items.map((n) => (
              <ListItemButton key={n.to} component={RouterLink} to={n.to} selected={n.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.to)}>
                <ListItemIcon>{n.icon}</ListItemIcon>
                <ListItemText primary={n.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ flex: 1 }}>{children}</Box>

      <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', py: 4, mt: 6 }}>
        <Container>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">© {new Date().getFullYear()} {APP_NAME} — Website ke APK & AAB gratis.</Typography>
            <Stack direction="row" spacing={2}>
              <Link component={RouterLink} to="/docs" variant="body2">Panduan</Link>
              <Link component={RouterLink} to="/docs#publish" variant="body2">Publikasi Play Store</Link>
              <Link component={RouterLink} to="/docs#faq" variant="body2">FAQ</Link>
              <Link component={RouterLink} to="/tools" variant="body2">Tools</Link>
            </Stack>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
