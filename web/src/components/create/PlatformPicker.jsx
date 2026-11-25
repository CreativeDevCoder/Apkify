import { Box, Typography, Checkbox, Stack, Alert } from '@mui/material';
import { MONO } from '../../theme';

export const PLATFORM_INFO = {
  android: { label: 'Android', out: 'APK · AAB', note: 'Google Play, Android TV, sideload' },
  ios: { label: 'iOS', out: '.ipa · Xcode', note: 'Unsigned, atau siap App Store dengan sertifikat Anda' },
  windows: { label: 'Windows', out: '.exe · .msi', note: 'Installer Windows 10/11 (WebView2)' },
  macos: { label: 'macOS', out: '.dmg', note: 'Universal — Apple Silicon dan Intel' },
  linux: { label: 'Linux', out: '.AppImage · .deb', note: 'Ubuntu, Debian, dan distro lain' }
};

/** Pemilih platform sebagai daftar baris yang bisa dicentang — mudah dipindai, ramah keyboard. */
export default function PlatformPicker({ value, onChange, anon }) {
  const toggle = (k) => onChange({ ...value, [k]: !value[k] });
  const any = Object.values(value).some(Boolean);
  return (
    <>
      <Box role="group" aria-label="Platform target" sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        {Object.entries(PLATFORM_INFO).map(([k, p], i) => {
          const disabled = anon && k !== 'android';
          const on = !!value[k];
          return (
            <Box component="label" key={k} sx={{
              display: 'grid', gridTemplateColumns: { xs: 'auto 1fr auto', sm: 'auto 110px 150px 1fr' }, alignItems: 'center', columnGap: 1.5,
              px: 1.5, py: 1.25, borderTop: i ? 1 : 0, borderColor: 'divider', cursor: disabled ? 'not-allowed' : 'pointer',
              bgcolor: on ? 'primary.light' : 'background.paper', opacity: disabled ? 0.5 : 1, transition: 'background-color 140ms',
              '&:hover': !disabled && !on ? { bgcolor: 'action.hover' } : {}
            }}>
              <Checkbox checked={on} disabled={disabled} onChange={() => toggle(k)} inputProps={{ 'aria-label': p.label }} sx={{ p: 0.5 }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.label}</Typography>
              <Typography sx={{ fontFamily: MONO, fontSize: 12, color: on ? 'primary.main' : 'text.secondary', textAlign: { xs: 'right', sm: 'left' } }}>{p.out}</Typography>
              <Typography variant="caption" sx={{ display: { xs: 'none', sm: 'block' } }} noWrap>{disabled ? 'Butuh akun terdaftar (gratis)' : p.note}</Typography>
            </Box>
          );
        })}
      </Box>
      <Stack spacing={1} sx={{ mt: 1.5 }}>
        {!any && <Alert severity="error">Pilih minimal satu platform.</Alert>}
        {anon && <Alert severity="info">Desktop & iOS tersedia untuk akun terdaftar (gratis).</Alert>}
        {value.ios && <Alert severity="info">iOS tanpa sertifikat Apple menghasilkan IPA unsigned (untuk re-sign/sideload). Unggah .p12 + provisioning profile di Studio untuk IPA siap App Store.</Alert>}
        {(value.windows || value.macos) && <Alert severity="info">Installer desktop belum bertanda tangan kode: SmartScreen/Gatekeeper akan meminta konfirmasi saat pertama dibuka.</Alert>}
      </Stack>
    </>
  );
}
