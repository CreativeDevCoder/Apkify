import { Grid, Card, CardActionArea, CardContent, Typography, Checkbox, Stack, Chip, Alert } from '@mui/material';
import AndroidIcon from '@mui/icons-material/Android';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import LaptopMacIcon from '@mui/icons-material/LaptopMac';
import TerminalIcon from '@mui/icons-material/Terminal';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';

export const PLATFORM_INFO = {
  android: { label: 'Android', icon: <AndroidIcon />, out: 'APK + AAB', note: 'Google Play, Android TV, sideload' },
  windows: { label: 'Windows', icon: <DesktopWindowsIcon />, out: '.exe + .msi', note: 'Installer Windows 10/11 (WebView2)' },
  macos: { label: 'macOS', icon: <LaptopMacIcon />, out: '.dmg', note: 'Universal (Apple Silicon + Intel)' },
  linux: { label: 'Linux', icon: <TerminalIcon />, out: '.AppImage + .deb', note: 'Ubuntu, Debian, dan distro lain' },
  ios: { label: 'iOS', icon: <PhoneIphoneIcon />, out: '.ipa + proyek Xcode', note: 'Unsigned, atau siap App Store dengan sertifikat Anda' }
};

export default function PlatformPicker({ value, onChange, anon }) {
  const toggle = (k) => onChange({ ...value, [k]: !value[k] });
  const any = Object.values(value).some(Boolean);
  return (
    <>
      <Grid container spacing={1.5}>
        {Object.entries(PLATFORM_INFO).map(([k, p]) => {
          const disabled = anon && k !== 'android';
          return (
            <Grid item xs={6} sm={4} md={12 / 5} key={k}>
              <Card sx={{ height: '100%', borderColor: value[k] ? 'primary.main' : 'divider', borderWidth: value[k] ? 2 : 1, opacity: disabled ? 0.5 : 1 }}>
                <CardActionArea disabled={disabled} onClick={() => toggle(k)} sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 1.5 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ color: value[k] ? 'primary.main' : 'text.secondary' }}>{p.icon}<Typography fontWeight={700}>{p.label}</Typography></Stack>
                      <Checkbox size="small" checked={!!value[k]} sx={{ p: 0 }} tabIndex={-1} />
                    </Stack>
                    <Chip size="small" label={p.out} sx={{ mt: 1 }} />
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>{p.note}</Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      {!any && <Alert severity="error" sx={{ mt: 1 }}>Pilih minimal satu platform.</Alert>}
      {anon && <Alert severity="info" sx={{ mt: 1 }}>Desktop & iOS tersedia untuk akun terdaftar (gratis).</Alert>}
      {value.ios && <Alert severity="info" sx={{ mt: 1 }}>iOS: tanpa sertifikat Apple, IPA bersifat unsigned (untuk re-sign/sideload). Unggah sertifikat .p12 + provisioning profile di Studio untuk IPA siap App Store.</Alert>}
      {(value.windows || value.macos) && <Alert severity="info" sx={{ mt: 1 }}>Installer desktop belum bertanda tangan kode: Windows SmartScreen / macOS Gatekeeper akan meminta konfirmasi saat pertama dibuka.</Alert>}
    </>
  );
}
