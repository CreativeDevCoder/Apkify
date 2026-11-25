// Primitif UI Apkify: dipakai lintas halaman agar komposisi konsisten.
import { Link as RouterLinkBase } from 'react-router-dom';
import { useState } from 'react';
import { Box, Container, Typography, Stack, IconButton, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopyOutlined';
import CheckIcon from '@mui/icons-material/Check';
import { MONO } from '../theme';

/** Label mono kecil sebagai penanda struktur, opsional dengan nomor urut. */
export function Eyebrow({ index, children, color = 'text.secondary', sx }) {
  return (
    <Typography variant="overline" component="div" sx={{ color, display: 'flex', alignItems: 'center', gap: 1, ...sx }}>
      {index != null && <Box component="span" sx={{ color: 'primary.main' }}>{String(index).padStart(2, '0')}</Box>}
      {index != null && <Box component="span" sx={{ width: 14, height: '1px', bgcolor: 'divider' }} />}
      {children}
    </Typography>
  );
}

/** Blok halaman dengan ritme vertikal standar. */
export function Section({ children, maxWidth = 'lg', top = false, sx, id, dense = false }) {
  return (
    <Box component="section" id={id} sx={{ py: dense ? { xs: 5, md: 7 } : { xs: 8, md: 12 }, borderTop: top ? 1 : 0, borderColor: 'divider', ...sx }}>
      <Container maxWidth={maxWidth}>{children}</Container>
    </Box>
  );
}

/** Judul bagian: eyebrow + judul + deskripsi, rata kiri. */
export function SectionTitle({ eyebrow, index, title, children, sx, align = 'left', maxWidth = 640 }) {
  return (
    <Box sx={{ mb: { xs: 4, md: 6 }, maxWidth, textAlign: align, mx: align === 'center' ? 'auto' : 0, ...sx }}>
      {eyebrow && <Eyebrow index={index} sx={{ mb: 1.5, justifyContent: align === 'center' ? 'center' : 'flex-start' }}>{eyebrow}</Eyebrow>}
      <Typography variant="h2" sx={{ mb: children ? 1.5 : 0 }}>{title}</Typography>
      {children && <Typography variant="subtitle1">{children}</Typography>}
    </Box>
  );
}

/** Permukaan bergaris tipis dengan header opsional — dipakai hanya untuk pengelompokan yang bermakna. */
export function Panel({ title, eyebrow, actions, children, sx, bodySx, id, flush = false }) {
  return (
    <Box id={id} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', ...sx }}>
      {(title || actions || eyebrow) && (
        <Stack direction="row" alignItems="center" spacing={2} sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider', minHeight: 52 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {eyebrow && <Typography variant="overline" color="text.secondary" component="div" sx={{ lineHeight: 1.4 }}>{eyebrow}</Typography>}
            {title && <Typography variant="h6" component="h3">{title}</Typography>}
          </Box>
          {actions}
        </Stack>
      )}
      <Box sx={{ p: flush ? 0 : 2.5, ...bodySx }}>{children}</Box>
    </Box>
  );
}

/** Titik status kecil. */
export function Dot({ color = 'text.disabled', pulse = false, size = 7 }) {
  return (
    <Box component="span" sx={{
      width: size, height: size, borderRadius: '50%', bgcolor: color, display: 'inline-block', flexShrink: 0,
      ...(pulse && { animation: 'apkPulse 1.6s ease-in-out infinite', '@keyframes apkPulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } } })
    }} />
  );
}

/** Baris label–nilai, nilai mono bila angka/kode. */
export function KV({ label, value, mono = false }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 1, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontFamily: mono ? MONO : undefined, fontVariantNumeric: 'tabular-nums', textAlign: 'right', wordBreak: 'break-all' }}>{value}</Typography>
    </Stack>
  );
}

/** Keadaan kosong yang tenang: ikon garis tipis, satu kalimat, satu aksi. */
export function EmptyState({ icon, title, children, action, sx }) {
  return (
    <Box sx={{ textAlign: 'center', py: { xs: 6, md: 8 }, px: 3, border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 2, ...sx }}>
      {icon && <Box sx={{ color: 'text.disabled', mb: 1.5, '& svg': { fontSize: 28 } }}>{icon}</Box>}
      <Typography variant="h6" sx={{ mb: 0.5 }}>{title}</Typography>
      {children && <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380, mx: 'auto', mb: action ? 2.5 : 0 }}>{children}</Typography>}
      {action}
    </Box>
  );
}

/** Blok kode mono yang membungkus baris (tanpa gulir) + tombol salin. */
export function CodeBlock({ children, label, sx }) {
  const [ok, setOk] = useState(false);
  const text = String(children).replace(/\n$/, '');
  return (
    <Box sx={{ position: 'relative', border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: (t) => t.tokens.sunken, ...sx }}>
      {label && <Typography variant="overline" component="div" color="text.secondary" sx={{ px: 2, pt: 1.25 }}>{label}</Typography>}
      <Tooltip title={ok ? 'Tersalin' : 'Salin'}>
        <IconButton size="small" aria-label="Salin kode" onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1400); }}
          sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
          {ok ? <CheckIcon sx={{ fontSize: 15 }} /> : <ContentCopyIcon sx={{ fontSize: 15 }} />}
        </IconButton>
      </Tooltip>
      <Box component="pre" sx={{ m: 0, p: 2, pr: 6, fontFamily: MONO, fontSize: 12.5, lineHeight: 1.7, color: 'text.primary' }}>{text}</Box>
    </Box>
  );
}

/** Logo Apkify (tanda + wordmark). */
export function Logo({ size = 24, word = true, name = 'Apkify' }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Box component="svg" viewBox="0 0 64 64" sx={{ width: size, height: size, flexShrink: 0 }} aria-hidden>
        <rect width="64" height="64" rx="15" fill="#0073e6" />
        <path d="M32 15v21m0 0l-8.5-8.5M32 36l8.5-8.5" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 38v6a5 5 0 0 0 5 5h20a5 5 0 0 0 5-5v-6" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" />
      </Box>
      {word && <Typography component="span" sx={{ fontWeight: 650, fontSize: 16, letterSpacing: '-0.02em' }}>{name}</Typography>}
    </Stack>
  );
}

/** Garis kisi halus sebagai latar (hanya untuk area hero). */
export const gridBg = (t) => ({
  backgroundImage: `linear-gradient(${alpha(t.palette.text.primary, t.palette.mode === 'light' ? 0.045 : 0.06)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(t.palette.text.primary, t.palette.mode === 'light' ? 0.045 : 0.06)} 1px, transparent 1px)`,
  backgroundSize: '48px 48px',
  backgroundPosition: '-1px -1px'
});

/** Daftar terpisah garis rambut (pengganti kisi kartu). */
export function RuleList({ items, cols = { xs: 1, md: 2 }, sx }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: `repeat(${cols.xs}, 1fr)`, sm: `repeat(${cols.sm || cols.xs}, 1fr)`, md: `repeat(${cols.md}, 1fr)` }, columnGap: 5, ...sx }}>
      {items.map(([t, d, extra], i) => (
        <Box key={t + i} sx={{ py: 2.25, borderTop: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={1} alignItems="baseline" justifyContent="space-between">
            <Typography variant="h6" component="h3">{t}</Typography>
            {extra && <Typography variant="overline" color="text.secondary" sx={{ flexShrink: 0 }}>{extra}</Typography>}
          </Stack>
          {d && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 520 }}>{d}</Typography>}
        </Box>
      ))}
    </Box>
  );
}

/** Kisi sel bertautan dengan garis bersama (seperti tabel ubin) — pengganti tumpukan kartu. */
export function CellGrid({ items, cols = { xs: 1, sm: 2, md: 3 }, sx }) {
  return (
    <Box sx={{
      display: 'grid', gridTemplateColumns: { xs: `repeat(${cols.xs}, 1fr)`, sm: `repeat(${cols.sm}, 1fr)`, md: `repeat(${cols.md}, 1fr)` },
      borderTop: 1, borderLeft: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper', ...sx
    }}>
      {items.map((it) => {
        const Comp = it.to ? RouterLinkBase : it.href ? 'a' : 'div';
        return (
          <Box key={it.to || it.href || it.title} component={Comp} to={it.to} href={it.href} onClick={it.onClick}
            sx={{
              position: 'relative', display: 'block', p: 2.5, minHeight: 132, borderRight: 1, borderBottom: 1, borderColor: 'divider',
              textDecoration: 'none', color: 'inherit', transition: 'background-color 140ms', outline: 'none',
              ...((it.to || it.href || it.onClick) && { cursor: 'pointer', '&:hover, &:focus-visible': { bgcolor: 'action.hover', '& .cg-arrow': { opacity: 1, transform: 'translateX(0)' } } })
            }}>
            {it.meta && <Typography variant="overline" color="text.secondary" component="div" sx={{ mb: 1.25 }}>{it.meta}</Typography>}
            <Typography variant="h6" component="h3" sx={{ pr: 3 }}>{it.title}</Typography>
            {it.desc && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{it.desc}</Typography>}
            {it.children}
            {(it.to || it.href) && (
              <Box className="cg-arrow" aria-hidden sx={{ position: 'absolute', top: 20, right: 18, color: 'text.secondary', opacity: 0, transform: 'translateX(-4px)', transition: 'opacity 140ms, transform 140ms', fontSize: 15 }}>→</Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/** Kepala halaman alat/formulir di dalam Container: jejak, judul, deskripsi, garis bawah. */
export function ToolHeader({ title, children, crumb = ['/tools', 'Tools'], badge, actions }) {
  return (
    <Box sx={{ pb: 3, mb: 4, borderBottom: 1, borderColor: 'divider' }}>
      {crumb && (
        <Typography component={RouterLinkBase} to={crumb[0]} variant="body2" sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { color: 'text.primary' } }}>← {crumb[1]}</Typography>
      )}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mt: crumb ? 2 : 0 }}>
        <Typography variant="h3" component="h1" sx={{ flex: 1 }}>{title}{badge && <Typography component="span" variant="overline" sx={{ ml: 1.5, color: 'warning.main', verticalAlign: 'middle' }}>{badge}</Typography>}</Typography>
        {actions}
      </Stack>
      {children && <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 680 }}>{children}</Typography>}
    </Box>
  );
}
