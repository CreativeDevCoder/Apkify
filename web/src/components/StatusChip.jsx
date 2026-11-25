import { Stack, Typography } from '@mui/material';
import { Dot } from './ui';

const MAP = {
  queued: { label: 'Antre', color: 'text.disabled' },
  building: { label: 'Sedang dibuild', color: 'primary.main', pulse: true },
  uploading: { label: 'Mengunggah hasil', color: 'primary.main', pulse: true },
  success: { label: 'Berhasil', color: 'success.main' },
  partial: { label: 'Sebagian berhasil', color: 'warning.main' },
  failed: { label: 'Gagal', color: 'error.main' }
};

/** Status sebagai titik + label (bukan pil berwarna). */
export default function StatusChip({ status }) {
  const m = MAP[status] || { label: status || '—', color: 'text.disabled' };
  return (
    <Stack direction="row" spacing={0.875} alignItems="center" component="span" sx={{ display: 'inline-flex' }}>
      <Dot color={m.color} pulse={m.pulse} />
      <Typography component="span" variant="body2" sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{m.label}</Typography>
    </Stack>
  );
}

export const FINAL = ['success', 'failed', 'partial'];
