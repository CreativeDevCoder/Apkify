import { useState } from 'react';
import { Container, Typography, Card, CardContent, Stack, Button, Box, Slider, FormControlLabel, Switch, Alert } from '@mui/material';
import { ToolHeader } from '../../components/ui';
import JSZip from 'jszip';
import FileDrop from '../../components/FileDrop';
import ColorField from '../../components/ColorField';
import { loadImage, fileToDataUrl, drawSquare, canvasToBlob, ANDROID_ICON_SIZES } from '../../lib/iconGen';

export default function IconResizer() {
  const [img, setImg] = useState(null);
  const [name, setName] = useState('icon');
  const [padding, setPadding] = useState(0);
  const [useBg, setUseBg] = useState(false);
  const [bg, setBg] = useState('#ffffff');
  const [err, setErr] = useState('');

  const onFile = async (f) => {
    setErr('');
    try {
      setImg(await loadImage(await fileToDataUrl(f)));
      setName(f.name.replace(/\.[^.]+$/, ''));
    } catch (e) { setErr(e.message); }
  };

  const opts = (size) => ({ padding: Math.round(size * padding / 100), bg: useBg ? bg : null });
  const preview = img ? drawSquare(img, 192, opts(192)).toDataURL() : '';

  async function download() {
    const zip = new JSZip();
    for (const { folder, size } of ANDROID_ICON_SIZES) {
      zip.file(`res/${folder}/ic_launcher.png`, await canvasToBlob(drawSquare(img, size, opts(size))));
      zip.file(`res/${folder}/ic_launcher_round.png`, await canvasToBlob(drawSquare(img, size, { ...opts(size), round: 0.5 })));
    }
    zip.file('playstore-icon-512.png', await canvasToBlob(drawSquare(img, 512, { ...opts(512), bg: useBg ? bg : '#ffffff' })));
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}-android-icons.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, md: 6 } }}>
      <ToolHeader title="Icon Resizer" />
      <Card><CardContent>
        <Stack spacing={2}>
          <FileDrop accept="image/*" onFile={onFile} hint="PNG/JPG/WebP, ideal 1024×1024" />
          {err && <Alert severity="error">{err}</Alert>}
          {img && <>
            <Box sx={{ textAlign: 'center' }}><img src={preview} width={128} height={128} alt="pratinjau" style={{ borderRadius: 24 }} /></Box>
            <Typography gutterBottom>Padding: {padding}%</Typography>
            <Slider value={padding} min={0} max={30} onChange={(_, v) => setPadding(v)} />
            <FormControlLabel control={<Switch checked={useBg} onChange={(e) => setUseBg(e.target.checked)} />} label="Latar warna solid" />
            {useBg && <ColorField label="Warna latar" value={bg} onChange={setBg} />}
            <Button variant="contained" size="large" onClick={download}>Unduh ZIP (mdpi–xxxhdpi + Play Store 512)</Button>
          </>}
        </Stack>
      </CardContent></Card>
    </Container>
  );
}
