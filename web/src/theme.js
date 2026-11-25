import { createTheme, alpha } from '@mui/material/styles';

/*
 * Apkify design system — "teknis-presisi"
 * Kepribadian: alat build yang tenang dan presisi. Netral dingin, garis rambut 1px,
 * satu aksen biru (#0073e6), angka tabular, label mono kecil sebagai penanda struktur.
 * Tidak ada gradien dekoratif, bayangan tebal, atau sudut membulat berlebihan.
 */

export const FONT = 'system-ui, -apple-system, "Segoe UI Variable Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
export const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", "Cascadia Mono", Menlo, Consolas, "Liberation Mono", monospace';

const BLUE = '#0073e6';

const TOKENS = {
  light: {
    bg: '#fafafb', surface: '#ffffff', subtle: '#f3f4f6', sunken: '#eef0f3',
    border: '#e3e5e9', borderStrong: '#cfd3da',
    text: '#0f1217', text2: '#555c68', text3: '#868c97',
    primary: BLUE, primaryHover: '#0063c7', primarySoft: '#e9f2fd', primaryText: '#005bb5',
    success: '#16794a', successSoft: '#e7f4ec', warning: '#a65a00', warningSoft: '#fdf1e1',
    error: '#c62a2f', errorSoft: '#fcebeb', info: BLUE, infoSoft: '#e9f2fd',
    inverse: '#0f1217', inverseText: '#f2f3f5'
  },
  dark: {
    bg: '#0a0b0d', surface: '#111317', subtle: '#16191e', sunken: '#0d0f12',
    border: '#22262d', borderStrong: '#30353e',
    text: '#eceef1', text2: '#a0a6b1', text3: '#6f7681',
    primary: '#2f8ff0', primaryHover: '#4da1f4', primarySoft: '#0e2236', primaryText: '#6db3f7',
    success: '#3fb37a', successSoft: '#0f251a', warning: '#e0a040', warningSoft: '#2a1e0b',
    error: '#ef5b5f', errorSoft: '#2c1213', info: '#2f8ff0', infoSoft: '#0e2236',
    inverse: '#eceef1', inverseText: '#0f1217'
  }
};

export function makeTheme(mode = 'light') {
  const t = TOKENS[mode];
  const theme = createTheme({
    palette: {
      mode,
      primary: { main: t.primary, dark: t.primaryHover, light: t.primarySoft, contrastText: '#ffffff' },
      secondary: { main: t.text, contrastText: t.surface },
      success: { main: t.success, light: t.successSoft },
      warning: { main: t.warning, light: t.warningSoft },
      error: { main: t.error, light: t.errorSoft },
      info: { main: t.info, light: t.infoSoft },
      background: { default: t.bg, paper: t.surface },
      text: { primary: t.text, secondary: t.text2, disabled: t.text3 },
      divider: t.border,
      action: { hover: alpha(t.text, 0.04), selected: alpha(t.primary, 0.08), focus: alpha(t.primary, 0.12) },
      grey: { 50: t.subtle, 100: t.sunken }
    },
    tokens: t,
    shape: { borderRadius: 6 },
    spacing: 4 * 2, // 8px; skala 4/8/12/16/24/32/48/64/96
    typography: {
      fontFamily: FONT,
      fontSize: 14,
      htmlFontSize: 16,
      h1: { fontSize: '3rem', fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1.06 },
      h2: { fontSize: '2.25rem', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.12 },
      h3: { fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.18 },
      h4: { fontSize: '1.375rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.25 },
      h5: { fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.012em', lineHeight: 1.35 },
      h6: { fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.006em', lineHeight: 1.4 },
      subtitle1: { fontSize: '1.0625rem', lineHeight: 1.55, color: t.text2 },
      subtitle2: { fontSize: '0.8125rem', fontWeight: 600, letterSpacing: 0 },
      body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
      body2: { fontSize: '0.8125rem', lineHeight: 1.55 },
      caption: { fontSize: '0.75rem', lineHeight: 1.45, color: t.text3 },
      overline: { fontFamily: MONO, fontSize: '0.6875rem', fontWeight: 500, letterSpacing: '0.08em', lineHeight: 1.6, textTransform: 'uppercase' },
      button: { textTransform: 'none', fontWeight: 550, letterSpacing: '-0.005em', fontSize: '0.8125rem' }
    },
    transitions: { duration: { shortest: 100, shorter: 140, short: 180, standard: 220 } }
  });

  const ring = `0 0 0 3px ${alpha(t.primary, mode === 'light' ? 0.22 : 0.35)}`;
  const shadowPop = mode === 'light'
    ? '0 1px 2px rgba(15,18,23,.06), 0 8px 24px -6px rgba(15,18,23,.14)'
    : '0 1px 2px rgba(0,0,0,.5), 0 12px 32px -8px rgba(0,0,0,.7)';

  theme.components = {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': { colorScheme: mode },
        html: { WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', textRendering: 'optimizeLegibility' },
        body: { fontFeatureSettings: '"cv11", "ss01"', backgroundColor: t.bg },
        '::selection': { background: alpha(t.primary, 0.22) },
        'code, kbd, pre, samp': { fontFamily: MONO, fontSize: '0.92em' },
        ':not(pre) > code': { background: t.subtle, border: `1px solid ${t.border}`, borderRadius: 4, padding: '0.05em 0.35em', wordBreak: 'break-word' },
        // tidak ada area gulir di dalam konten: blok kode membungkus baris
        pre: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
        '.tnum': { fontVariantNumeric: 'tabular-nums' },
        'a:focus-visible, [role="button"]:focus-visible, summary:focus-visible': { outline: `2px solid ${t.primary}`, outlineOffset: 2, borderRadius: 4 },
        '.MuiButtonBase-root:focus-visible': { outline: 'none' },
        '@media (prefers-reduced-motion: reduce)': { '*, *::before, *::after': { transition: 'none !important', animation: 'none !important' } }
      }
    },
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: 34, padding: '6px 14px', borderRadius: 6, whiteSpace: 'nowrap',
          transition: 'background-color 140ms, border-color 140ms, color 140ms, box-shadow 140ms',
          '&.Mui-focusVisible': { boxShadow: ring }
        },
        sizeSmall: { minHeight: 28, padding: '3px 10px', fontSize: '0.78rem' },
        sizeLarge: { minHeight: 42, padding: '9px 20px', fontSize: '0.875rem' },
        containedPrimary: { '&:hover': { backgroundColor: t.primaryHover } },
        containedInherit: { backgroundColor: t.inverse, color: t.inverseText, '&:hover': { backgroundColor: alpha(t.inverse, 0.86) } },
        outlined: {
          borderColor: t.borderStrong, color: t.text, backgroundColor: t.surface,
          '&:hover': { borderColor: t.text3, backgroundColor: t.subtle }
        },
        outlinedPrimary: { borderColor: t.borderStrong, color: t.text, '&:hover': { borderColor: t.text3, backgroundColor: t.subtle } },
        text: { '&:hover': { backgroundColor: alpha(t.text, 0.05) } },
        textInherit: { color: t.text2, '&:hover': { color: t.text } },
        startIcon: { marginRight: 6, '& > *:nth-of-type(1)': { fontSize: 17 } },
        endIcon: { marginLeft: 6, '& > *:nth-of-type(1)': { fontSize: 17 } }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 6, color: t.text2, '&:hover': { backgroundColor: alpha(t.text, 0.06), color: t.text }, '&.Mui-focusVisible': { boxShadow: ring } },
        sizeSmall: { padding: 4 }
      }
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: 'none' }, outlined: { borderColor: t.border } }
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderRadius: 8, borderColor: t.border, backgroundColor: t.surface } }
    },
    MuiCardContent: { styleOverrides: { root: { padding: 20, '&:last-child': { paddingBottom: 20 } } } },
    MuiAppBar: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
    MuiInputLabel: {
      styleOverrides: {
        root: { fontSize: '0.8125rem', color: t.text2, '&.Mui-focused': { color: t.primaryText } },
        shrink: { fontWeight: 500 }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 6, backgroundColor: t.surface, fontSize: '0.875rem',
          transition: 'box-shadow 140ms, border-color 140ms',
          '& .MuiOutlinedInput-notchedOutline': { borderColor: t.borderStrong, transition: 'border-color 140ms' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: t.text3 },
          '&.Mui-focused': { boxShadow: ring },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: t.primary, borderWidth: 1 },
          '&.Mui-error.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(t.error, 0.2)}` },
          '&.Mui-disabled': { backgroundColor: t.subtle }
        },
        input: { '&::placeholder': { color: t.text3, opacity: 1 } }
      }
    },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 2, marginTop: 5, fontSize: '0.75rem', color: t.text3, lineHeight: 1.45 } } },
    MuiFormControlLabel: { styleOverrides: { label: { fontSize: '0.875rem' } } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiMenu: {
      styleOverrides: {
        paper: { marginTop: 4, borderRadius: 8, border: `1px solid ${t.border}`, boxShadow: shadowPop },
        list: { padding: 4 }
      }
    },
    MuiPopover: { styleOverrides: { paper: { borderRadius: 8, border: `1px solid ${t.border}`, boxShadow: shadowPop } } },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 4, fontSize: '0.8125rem', minHeight: 32, padding: '6px 10px',
          '&.Mui-selected': { backgroundColor: t.primarySoft, color: t.primaryText, '&:hover': { backgroundColor: t.primarySoft } }
        }
      }
    },
    MuiListItemIcon: { styleOverrides: { root: { minWidth: 30, color: t.text3, '& svg': { fontSize: 18 } } } },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6, '&.Mui-selected': { backgroundColor: t.primarySoft, color: t.primaryText, '& .MuiListItemIcon-root': { color: t.primaryText } },
          '&.Mui-selected:hover': { backgroundColor: t.primarySoft }
        }
      }
    },
    MuiListSubheader: { styleOverrides: { root: { fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: t.text3, lineHeight: '32px', background: 'transparent' } } },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 4, height: 22, fontSize: '0.72rem', fontWeight: 500 },
        label: { paddingLeft: 7, paddingRight: 7 },
        outlined: { borderColor: t.borderStrong },
        filled: { backgroundColor: t.subtle, color: t.text2 },
        colorPrimary: { '&.MuiChip-filled': { backgroundColor: t.primarySoft, color: t.primaryText } },
        colorSuccess: { '&.MuiChip-filled': { backgroundColor: t.successSoft, color: t.success } },
        colorWarning: { '&.MuiChip-filled': { backgroundColor: t.warningSoft, color: t.warning } },
        colorError: { '&.MuiChip-filled': { backgroundColor: t.errorSoft, color: t.error } },
        colorInfo: { '&.MuiChip-filled': { backgroundColor: t.infoSoft, color: t.primaryText } },
        sizeSmall: { height: 20, fontSize: '0.6875rem' },
        icon: { fontSize: 14, marginLeft: 6 }
      }
    },
    MuiAlert: {
      defaultProps: { variant: 'standard' },
      styleOverrides: {
        root: { borderRadius: 6, border: `1px solid ${t.border}`, padding: '6px 12px', fontSize: '0.8125rem', alignItems: 'flex-start' },
        icon: { padding: '8px 0', marginRight: 10, '& svg': { fontSize: 18 } },
        message: { padding: '7px 0' },
        standardInfo: { backgroundColor: t.infoSoft, borderColor: alpha(t.primary, 0.25), color: t.text, '& .MuiAlert-icon': { color: t.primary } },
        standardSuccess: { backgroundColor: t.successSoft, borderColor: alpha(t.success, 0.25), color: t.text, '& .MuiAlert-icon': { color: t.success } },
        standardWarning: { backgroundColor: t.warningSoft, borderColor: alpha(t.warning, 0.25), color: t.text, '& .MuiAlert-icon': { color: t.warning } },
        standardError: { backgroundColor: t.errorSoft, borderColor: alpha(t.error, 0.25), color: t.text, '& .MuiAlert-icon': { color: t.error } }
      }
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 40, borderBottom: `1px solid ${t.border}` },
        indicator: { height: 2, backgroundColor: t.text },
        flexContainer: { gap: 4 }
      }
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 40, minWidth: 0, padding: '8px 10px', fontSize: '0.8125rem', fontWeight: 500, color: t.text2,
          '&.Mui-selected': { color: t.text },
          '&:hover': { color: t.text },
          '& .MuiTab-iconWrapper': { fontSize: 17 }
        },
        labelIcon: { minHeight: 40, flexDirection: 'row', gap: 6, '& .MuiTab-iconWrapper': { marginBottom: '0 !important' } }
      }
    },
    MuiToggleButtonGroup: { styleOverrides: { root: { backgroundColor: t.subtle, padding: 2, borderRadius: 6, gap: 2 }, grouped: { border: 0, borderRadius: '4px !important' } } },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          border: 0, textTransform: 'none', fontSize: '0.78rem', fontWeight: 500, padding: '4px 10px', color: t.text2,
          '&.Mui-selected': { backgroundColor: t.surface, color: t.text, boxShadow: `0 0 0 1px ${t.border}, 0 1px 2px rgba(0,0,0,.06)`, '&:hover': { backgroundColor: t.surface } }
        }
      }
    },
    MuiSwitch: {
      defaultProps: { disableRipple: true },
      styleOverrides: {
        root: { width: 34, height: 20, padding: 0, margin: '0 10px 0 2px' },
        switchBase: {
          padding: 3, '&.Mui-checked': { transform: 'translateX(14px)', color: '#fff', '& + .MuiSwitch-track': { backgroundColor: t.primary, opacity: 1 } },
          '&.Mui-focusVisible + .MuiSwitch-track': { boxShadow: ring }
        },
        thumb: { width: 14, height: 14, boxShadow: '0 1px 2px rgba(0,0,0,.25)' },
        track: { borderRadius: 10, backgroundColor: t.borderStrong, opacity: 1 }
      }
    },
    MuiCheckbox: { defaultProps: { size: 'small', disableRipple: true }, styleOverrides: { root: { color: t.borderStrong, padding: 6 } } },
    MuiRadio: { defaultProps: { size: 'small', disableRipple: true } },
    MuiSlider: {
      styleOverrides: {
        root: { height: 3, padding: '13px 0' },
        thumb: { width: 14, height: 14, backgroundColor: t.surface, border: `2px solid ${t.primary}`, '&:hover, &.Mui-focusVisible': { boxShadow: ring } },
        rail: { backgroundColor: t.borderStrong, opacity: 1 }
      }
    },
    MuiAccordion: {
      defaultProps: { disableGutters: true, elevation: 0, square: true },
      styleOverrides: { root: { backgroundColor: 'transparent', '&::before': { display: 'none' } } }
    },
    MuiTooltip: {
      defaultProps: { arrow: false, enterDelay: 300 },
      styleOverrides: { tooltip: { backgroundColor: t.inverse, color: t.inverseText, fontSize: '0.72rem', fontWeight: 500, borderRadius: 4, padding: '4px 8px' } }
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 10, border: `1px solid ${t.border}`, boxShadow: shadowPop },
        root: { '& .MuiBackdrop-root': { backgroundColor: alpha('#0a0b0d', mode === 'light' ? 0.32 : 0.6), backdropFilter: 'blur(2px)' } }
      }
    },
    MuiDialogTitle: { styleOverrides: { root: { fontSize: '1rem', fontWeight: 600, padding: '18px 20px 6px', letterSpacing: '-0.01em' } } },
    MuiDialogContent: { styleOverrides: { root: { padding: '8px 20px' } } },
    MuiDialogActions: { styleOverrides: { root: { padding: '12px 20px 16px', gap: 4 } } },
    MuiDrawer: { styleOverrides: { paper: { borderColor: t.border, backgroundColor: t.surface } } },
    MuiDivider: { styleOverrides: { root: { borderColor: t.border } } },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: t.border, fontSize: '0.8125rem', padding: '10px 12px' },
        head: { fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: t.text3, fontWeight: 500, backgroundColor: t.subtle }
      }
    },
    MuiLinearProgress: { styleOverrides: { root: { height: 3, borderRadius: 2, backgroundColor: t.subtle } } },
    MuiCircularProgress: { defaultProps: { size: 22, thickness: 4.5 } },
    MuiSkeleton: { styleOverrides: { root: { backgroundColor: t.subtle, borderRadius: 4 } } },
    MuiLink: { defaultProps: { underline: 'hover' }, styleOverrides: { root: { color: t.primaryText, textUnderlineOffset: 3, fontWeight: 500 } } },
    MuiAvatar: { styleOverrides: { root: { fontSize: '0.8125rem', fontWeight: 600, backgroundColor: t.sunken, color: t.text2 } } },
    MuiBadge: { styleOverrides: { badge: { fontSize: '0.65rem', height: 16, minWidth: 16 } } },
    MuiSnackbarContent: { styleOverrides: { root: { backgroundColor: t.inverse, color: t.inverseText, borderRadius: 6, fontSize: '0.8125rem' } } },
    MuiContainer: { styleOverrides: { root: { paddingLeft: 20, paddingRight: 20, '@media (min-width:600px)': { paddingLeft: 28, paddingRight: 28 } } } }
  };

  // skala tipografi responsif untuk judul besar
  theme.typography.h1 = { ...theme.typography.h1, [theme.breakpoints.down('md')]: { fontSize: '2.25rem' } };
  theme.typography.h2 = { ...theme.typography.h2, [theme.breakpoints.down('md')]: { fontSize: '1.75rem' } };
  theme.typography.h3 = { ...theme.typography.h3, [theme.breakpoints.down('md')]: { fontSize: '1.4rem' } };
  return theme;
}
