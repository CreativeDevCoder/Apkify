import { useEffect, useState } from 'react';
import { Container, Typography, Card, CardContent, Stack, TextField, Button, Box, Slider } from '@mui/material';
import { ToolHeader } from '../../components/ui';
import QRCode from 'qrcode';
import ColorField from '../../components/ColorField';
import { isHex } from '../../lib/validators';

export default function QrGenerator() {
  const [text, setText] = useState('https://');
  const [size, setSize] = useState(512);
  const [fg, setFg] = useState('#000000');
  const [bg, setBg] = useState('#ffffff');
  const [src, setSrc] = useState('');

  useEffect(() => {
    if (!text || !isHex(fg) || !isHex(bg)) return;
    QRCode.toDataURL(text, { width: size, margin: 2, color: { dark: fg, light: bg }, errorCorrectionLevel: 'M' })
      .then(setSrc).catch(() => setSrc(''));
  }, [text, size, fg, bg]);

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 6 } }}>
      <ToolHeader title="QR Code Generator" />
      <Card><CardContent>
        <Stack spacing={2}>
          <TextField label="Teks / URL" value={text} onChange={(e) => setText(e.target.value)} multiline maxRows={4} />
          <Stack direction="row" spacing={2}>
            <ColorField label="Warna QR" value={fg} onChange={setFg} />
            <ColorField label="Latar" value={bg} onChange={setBg} />
          </Stack>
          <Typography>Ukuran: {size}px</Typography>
          <Slider value={size} min={128} max={1024} step={64} onChange={(_, v) => setSize(v)} />
          {src && <Box sx={{ textAlign: 'center' }}><img src={src} alt="QR" style={{ width: 240, height: 240 }} /></Box>}
          <Stack direction="row" spacing={1}>
            <Button variant="contained" disabled={!src} href={src} download="qrcode.png" sx={{ flex: 1 }}>Unduh PNG</Button>
            <Button variant="outlined" disabled={!src} sx={{ flex: 1 }} onClick={async () => {
              const svg = await QRCode.toString(text, { type: 'svg', margin: 2, color: { dark: fg, light: bg }, errorCorrectionLevel: 'M' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
              a.download = 'qrcode.svg';
              a.click();
            }}>Unduh SVG</Button>
          </Stack>
        </Stack>
      </CardContent></Card>
    </Container>
  );
}
