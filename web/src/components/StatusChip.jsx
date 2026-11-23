import { Chip } from '@mui/material';

const MAP = {
  queued: { label: 'Antre', color: 'default' },
  building: { label: 'Sedang dibuild', color: 'info' },
  uploading: { label: 'Mengunggah hasil', color: 'info' },
  success: { label: 'Berhasil', color: 'success' },
  partial: { label: 'Sebagian berhasil', color: 'warning' },
  failed: { label: 'Gagal', color: 'error' }
};

export default function StatusChip({ status, size = 'small' }) {
  const m = MAP[status] || { label: status || '-', color: 'default' };
  return <Chip size={size} label={m.label} color={m.color} variant={status === 'success' ? 'filled' : 'outlined'} />;
}

export const FINAL = ['success', 'failed', 'partial'];
