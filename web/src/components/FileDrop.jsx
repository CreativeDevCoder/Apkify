import { useRef, useState } from 'react';
import { Box, Typography, Stack } from '@mui/material';
import UploadIcon from '@mui/icons-material/FileUploadOutlined';
import FileIcon from '@mui/icons-material/InsertDriveFileOutlined';

/** Area unggah berkas: bisa diseret, diklik, atau difokus dengan keyboard (Enter/Spasi). */
export default function FileDrop({ accept, onFile, label = 'Seret berkas ke sini atau klik untuk memilih', hint, file }) {
  const inp = useRef();
  const [over, setOver] = useState(false);
  const open = () => inp.current?.click();
  return (
    <Box
      role="button" tabIndex={0} aria-label={label}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      sx={{
        border: 1, borderStyle: 'dashed', borderColor: over ? 'primary.main' : 'divider', borderRadius: 2,
        px: 2.5, py: 2.25, cursor: 'pointer', bgcolor: over ? 'primary.light' : (t) => t.tokens.subtle,
        transition: 'border-color 140ms, background-color 140ms', outline: 'none',
        '&:hover': { borderColor: 'text.disabled' },
        '&:focus-visible': { borderColor: 'primary.main', boxShadow: (t) => `0 0 0 3px ${t.palette.action.focus}` }
      }}
    >
      <input ref={inp} type="file" hidden accept={accept} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      <Stack direction="row" spacing={1.75} alignItems="center">
        <Box sx={{ width: 34, height: 34, borderRadius: 1.5, border: 1, borderColor: 'divider', bgcolor: 'background.paper', display: 'grid', placeItems: 'center', color: file ? 'primary.main' : 'text.secondary', flexShrink: 0 }}>
          {file ? <FileIcon sx={{ fontSize: 18 }} /> : <UploadIcon sx={{ fontSize: 18 }} />}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 550, wordBreak: 'break-all' }}>{file ? file.name : label}</Typography>
          {file ? <Typography variant="caption" className="tnum">{(file.size / 1024 / 1024).toFixed(2)} MB · klik untuk mengganti</Typography>
            : hint && <Typography variant="caption" component="div">{hint}</Typography>}
        </Box>
      </Stack>
    </Box>
  );
}
