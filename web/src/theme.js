import { createTheme } from '@mui/material/styles';

export function makeTheme(mode = 'light') {
  return createTheme({
    palette: {
      mode,
      primary: { main: '#4f46e5' },
      secondary: { main: '#06b6d4' },
      background: mode === 'light' ? { default: '#f7f7fb', paper: '#ffffff' } : { default: '#0b1020', paper: '#121833' }
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      h1: { fontWeight: 800 },
      h2: { fontWeight: 800 },
      h3: { fontWeight: 700 },
      h4: { fontWeight: 700 },
      button: { textTransform: 'none', fontWeight: 600 }
    },
    components: {
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiCard: { styleOverrides: { root: ({ theme }) => ({ border: `1px solid ${theme.palette.divider}` }) } },
      MuiTextField: { defaultProps: { size: 'small', fullWidth: true } }
    }
  });
}
