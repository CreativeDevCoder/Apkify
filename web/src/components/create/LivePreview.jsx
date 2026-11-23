import { Box, Typography, Avatar, Stack, IconButton } from '@mui/material';
import { previewDoc } from '../../lib/preview';
import { NAV_ICON_EL } from './icons';

/** Pratinjau langsung tampilan aplikasi (toolbar, navigasi bawah, tombol mengambang) di bingkai HP. */
export default function LivePreview({ cfg, html, iconPreview, frameBlocked }) {
  const f = cfg.features;
  const url = cfg.source.type === 'url' ? cfg.source.url.trim() : '';
  const src = url && /^https?:\/\//i.test(url) ? url : '';
  return (
    <Box>
      <Box sx={{ mx: 'auto', width: 300, height: 600, border: '10px solid #111', borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: '#fff', position: 'relative' }}>
        <Box sx={{ height: 22, bgcolor: cfg.colors.statusBar, flex: 'none' }} />
        {(f.showToolbar || f.sideMenu) && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ height: 44, px: 1.5, bgcolor: cfg.colors.primary, color: '#fff', flex: 'none' }}>
            {f.sideMenu && <span>☰</span>}
            <Typography variant="body2" fontWeight={700} noWrap sx={{ flex: 1 }}>{cfg.name || 'Nama Aplikasi'}</Typography>
            {f.homeButton && <span>⌂</span>}
          </Stack>
        )}
        <Box sx={{ flex: 1, position: 'relative', bgcolor: '#f5f5f5' }}>
          {cfg.source.type === 'html' && html ? (
            <Box component="iframe" title="pratinjau" sandbox="allow-scripts" srcDoc={previewDoc(html)} sx={{ width: '100%', height: '100%', border: 0 }} />
          ) : src && !frameBlocked ? (
            <Box component="iframe" title="pratinjau" src={src} sandbox="allow-scripts allow-same-origin allow-forms" sx={{ width: '100%', height: '100%', border: 0 }} />
          ) : (
            <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ height: '100%', p: 2, textAlign: 'center' }}>
              <Avatar src={iconPreview} variant="rounded" sx={{ width: 64, height: 64, borderRadius: 3 }}>{(cfg.name || 'A')[0]}</Avatar>
              <Typography variant="caption" color="text.secondary">
                {frameBlocked ? 'Situs ini melarang ditampilkan di iframe, tetapi tetap berjalan normal di aplikasi.' : cfg.source.type === 'zip' ? 'Konten ZIP ditampilkan setelah build.' : 'Masukkan alamat website untuk pratinjau.'}
              </Typography>
            </Stack>
          )}
          {f.fab && (
            <IconButton sx={{ position: 'absolute', right: 12, bottom: 12, bgcolor: cfg.colors.accent, color: '#fff', boxShadow: 3, '&:hover': { bgcolor: cfg.colors.accent } }}>
              {NAV_ICON_EL[cfg.fab?.icon] || NAV_ICON_EL.chat}
            </IconButton>
          )}
        </Box>
        {f.bottomNav && cfg.bottomNav.items.length > 0 && (
          <Stack direction="row" sx={{ height: 56, borderTop: 1, borderColor: '#e5e5e5', bgcolor: '#fff', flex: 'none' }}>
            {cfg.bottomNav.items.slice(0, 5).map((it, i) => (
              <Stack key={i} alignItems="center" justifyContent="center" sx={{ flex: 1, color: i === 0 ? cfg.colors.primary : '#888', fontSize: 10 }}>
                {NAV_ICON_EL[it.icon] || NAV_ICON_EL.home}<span style={{ maxWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label || '…'}</span>
              </Stack>
            ))}
          </Stack>
        )}
      </Box>
      <Typography variant="caption" display="block" textAlign="center" color="text.secondary" sx={{ mt: 1 }}>Pratinjau perkiraan — fitur native aktif di aplikasi hasil build.</Typography>
    </Box>
  );
}
