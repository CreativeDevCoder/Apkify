import { useEffect, useState } from 'react';
import { Container, Typography, Card, CardContent, Stack, TextField, Button, Box, Slider } from '@mui/material';
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
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>QR Code Generator</Typography>
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
          <Button variant="contained" disabled={!src} href={src} download="qrcode.png">Unduh PNG</Button>
        </Stack>
      </CardContent></Card>
    </Container>
  );
}
