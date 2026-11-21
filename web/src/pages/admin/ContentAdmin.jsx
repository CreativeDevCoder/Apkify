import { useEffect, useState, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Card, CardContent, Stack, TextField, Button, MenuItem, Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Chip, Typography, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Box, Tabs, Tab, Alert
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { api, fileUrl } from '../../lib/api';
import FileDrop from '../../components/FileDrop';
import { rupiah } from '../market/Market';

const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const EMPTY_POST = { slug: '', title: '', excerpt: '', body: '', category: 'Berita', coverFileId: '', status: 'draft' };

export function PostsAdmin({ notify }) {
  const [posts, setPosts] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = useCallback(() => api.get('/api/admin/posts').then((r) => setPosts(r.posts)).catch((e) => notify('error', e.message)), [notify]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    const slug = edit.slug || slugify(edit.title);
    if (!slug) return notify('error', 'Judul wajib diisi');
    try { await api.put(`/api/admin/posts/${slug}`, edit); setEdit(null); notify('success', 'Artikel tersimpan'); load(); } catch (e) { notify('error', e.message); }
  }

  return (
    <Card>
      <CardContent>
        <Button variant="contained" onClick={() => setEdit({ ...EMPTY_POST })}>Artikel baru</Button>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Format isi: baris kosong = paragraf baru, “## ” = subjudul, “- ” = poin.</Typography>
      </CardContent>
      <TableContainer><Table size="small">
        <TableHead><TableRow><TableCell>Judul</TableCell><TableCell>Kategori</TableCell><TableCell>Status</TableCell><TableCell>Diperbarui</TableCell><TableCell /></TableRow></TableHead>
        <TableBody>{posts.map((p) => (
          <TableRow key={p.slug}>
            <TableCell>{p.title}<Typography variant="caption" display="block" color="text.secondary">/news/{p.slug}</Typography></TableCell>
            <TableCell>{p.category}</TableCell>
            <TableCell><Chip size="small" label={p.status} color={p.status === 'published' ? 'success' : 'default'} /></TableCell>
            <TableCell>{p.updatedAt ? new Date(p.updatedAt).toLocaleString('id-ID') : '-'}</TableCell>
            <TableCell>
              <IconButton size="small" onClick={() => setEdit({ ...EMPTY_POST, ...p })}><EditIcon fontSize="small" /></IconButton>
              <IconButton size="small" onClick={async () => { if (window.confirm('Hapus artikel?')) { await api.del(`/api/admin/posts/${p.slug}`); load(); } }}><DeleteIcon fontSize="small" /></IconButton>
            </TableCell>
          </TableRow>
        ))}</TableBody>
      </Table></TableContainer>
      <Dialog open={!!edit} onClose={() => setEdit(null)} fullWidth maxWidth="md">
        <DialogTitle>{edit?.slug ? 'Edit artikel' : 'Artikel baru'}</DialogTitle>
        {edit && <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Judul" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          {!posts.some((p) => p.slug === edit.slug) && (
            <TextField label="Slug URL" value={edit.slug} placeholder={slugify(edit.title)} onChange={(e) => setEdit({ ...edit, slug: slugify(e.target.value) })} />
          )}
          <Stack direction="row" spacing={2}>
            <TextField label="Kategori" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} />
            <TextField select label="Status" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
              <MenuItem value="draft">Draf</MenuItem><MenuItem value="published">Terbit</MenuItem>
            </TextField>
          </Stack>
          <TextField label="Ringkasan" value={edit.excerpt} onChange={(e) => setEdit({ ...edit, excerpt: e.target.value })} inputProps={{ maxLength: 300 }} />
          <TextField label="Isi" multiline minRows={12} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
          {edit.coverFileId && <Box component="img" src={fileUrl(edit.coverFileId)} alt="" sx={{ maxWidth: 240, borderRadius: 2 }} />}
          <FileDrop accept="image/*" label="Gambar sampul (opsional)" onFile={async (f) => {
            try { const r = await api.upload('/api/uploads', f, { kind: 'image' }); setEdit((x) => ({ ...x, coverFileId: r.fileId })); } catch (e) { notify('error', e.message); }
          }} />
        </Stack></DialogContent>}
        <DialogActions><Button onClick={() => setEdit(null)}>Batal</Button><Button variant="contained" onClick={save}>Simpan</Button></DialogActions>
      </Dialog>
    </Card>
  );
}

export function MarketAdmin({ notify }) {
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([]);
  const [note, setNote] = useState({});
  const load = useCallback(() => api.get(`/api/admin/market?status=${status}`).then((r) => setItems(r.items)).catch((e) => notify('error', e.message)), [status, notify]);
  useEffect(() => { load(); }, [load]);

  const moderate = async (id, s) => {
    try { await api.put(`/api/admin/market/${id}`, { status: s, note: note[id] || '' }); notify('success', `Listing ${s}`); load(); } catch (e) { notify('error', e.message); }
  };

  return (
    <Card>
      <Tabs value={status} onChange={(_, v) => setStatus(v)}>
        {['pending', 'approved', 'rejected', 'sold'].map((s) => <Tab key={s} value={s} label={s} />)}
      </Tabs>
      <CardContent>
        {items.length === 0 && <Typography color="text.secondary">Tidak ada listing.</Typography>}
        <Stack spacing={2}>{items.map((l) => (
          <Card key={l.id} variant="outlined"><CardContent>
            <Stack direction="row" spacing={2}>
              {l.imageFileIds[0] && <img src={fileUrl(l.imageFileIds[0])} alt="" width={90} height={90} style={{ objectFit: 'cover', borderRadius: 8 }} />}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={700} component={RouterLink} to={`/market/${l.id}`} sx={{ color: 'inherit' }}>{l.title}</Typography>
                <Typography variant="body2">{l.category} • {rupiah(l.price)} • {l.sellerName} ({l.whatsapp || l.email})</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', maxHeight: 120, overflow: 'auto' }}>{l.description}</Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
              <TextField placeholder="Catatan untuk penjual (opsional)" value={note[l.id] || ''} onChange={(e) => setNote({ ...note, [l.id]: e.target.value })} />
              <Button variant="contained" color="success" onClick={() => moderate(l.id, 'approved')}>Setujui</Button>
              <Button color="error" onClick={() => moderate(l.id, 'rejected')}>Tolak</Button>
            </Stack>
          </CardContent></Card>
        ))}</Stack>
      </CardContent>
    </Card>
  );
}

export function MessagesAdmin({ notify }) {
  const [msgs, setMsgs] = useState([]);
  const load = useCallback(() => api.get('/api/admin/messages').then((r) => setMsgs(r.messages)).catch((e) => notify('error', e.message)), [notify]);
  useEffect(() => { load(); }, [load]);
  return (
    <Card><CardContent>
      {msgs.length === 0 && <Alert severity="info">Belum ada pesan.</Alert>}
      <Stack spacing={2}>{msgs.map((m) => (
        <Card key={m.id} variant="outlined" sx={{ opacity: m.read ? 0.7 : 1 }}><CardContent>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" label={m.topic} />
            <Typography fontWeight={700} sx={{ flex: 1 }}>{m.name} &lt;{m.email}&gt;</Typography>
            <Typography variant="caption">{new Date(m.createdAt).toLocaleString('id-ID')}</Typography>
          </Stack>
          <Typography sx={{ whiteSpace: 'pre-line', my: 1 }}>{m.message}</Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.topic)}`}>Balas</Button>
            {!m.read && <Button size="small" onClick={async () => { await api.put(`/api/admin/messages/${m.id}`, {}); load(); }}>Tandai dibaca</Button>}
            <Button size="small" color="error" onClick={async () => { await api.del(`/api/admin/messages/${m.id}`); load(); }}>Hapus</Button>
          </Stack>
        </CardContent></Card>
      ))}</Stack>
    </CardContent></Card>
  );
}
