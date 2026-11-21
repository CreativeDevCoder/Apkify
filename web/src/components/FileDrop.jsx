import { useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

export default function FileDrop({ accept, onFile, label = 'Seret file ke sini atau klik untuk memilih', hint, file }) {
  const inp = useRef();
  const [over, setOver] = useState(false);
  return (
    <Box
      onClick={() => inp.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      sx={{
        border: 2, borderStyle: 'dashed', borderColor: over ? 'primary.main' : 'divider', borderRadius: 2,
        p: 3, textAlign: 'center', cursor: 'pointer', bgcolor: over ? 'action.hover' : 'transparent', transition: '.15s'
      }}
    >
      <input ref={inp} type="file" hidden accept={accept} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      <CloudUploadIcon color="primary" sx={{ fontSize: 36 }} />
      <Typography fontWeight={600}>{file ? file.name : label}</Typography>
      {file ? <Typography variant="caption" color="text.secondary">{(file.size / 1024 / 1024).toFixed(2)} MB</Typography>
        : hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </Box>
  );
}
