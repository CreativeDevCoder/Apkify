import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, CssBaseline, useMediaQuery } from '@mui/material';
import { makeTheme } from './theme';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import { ColorModeCtx } from './context/ColorMode';


function Root() {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const [mode, setMode] = useState(() => localStorage.getItem('apkify:mode') || (prefersDark ? 'dark' : 'light'));
  const theme = useMemo(() => makeTheme(mode), [mode]);
  const toggle = () => setMode((m) => {
    const n = m === 'light' ? 'dark' : 'light';
    localStorage.setItem('apkify:mode', n);
    return n;
  });
  return (
    <ColorModeCtx.Provider value={{ mode, toggle }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ColorModeCtx.Provider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
