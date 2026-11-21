import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Container, Grid, Card, CardActionArea, CardContent, CardMedia, Typography, Skeleton, Alert, Box, Chip, Button } from '@mui/material';
import PageHeader from '../components/PageHeader';
import { api, fileUrl } from '../lib/api';
import { swr } from '../lib/cache';

const fmt = (t) => new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

/** Render teks sederhana: baris kosong = paragraf, "## " = subjudul, "- " = poin */
function Body({ text }) {
  const blocks = (text || '').split(/\n{2,}/);
  return blocks.map((b, i) => {
    if (b.startsWith('## ')) return <Typography key={i} variant="h5" sx={{ mt: 3, mb: 1 }}>{b.slice(3)}</Typography>;
    if (b.split('\n').every((l) => l.startsWith('- '))) {
      return <Box key={i} component="ul" sx={{ pl: 3 }}>{b.split('\n').map((l) => <li key={l}><Typography>{l.slice(2)}</Typography></li>)}</Box>;
    }
    return <Typography key={i} paragraph sx={{ whiteSpace: 'pre-line', lineHeight: 1.8 }}>{b}</Typography>;
  });
}

export default function Blog() {
  const { slug } = useParams();
  const [posts, setPosts] = useState(null);
  const [post, setPost] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setErr('');
    if (slug) {
      setPost(null);
      swr(`post:${slug}`, () => api.get(`/api/public/posts/${slug}`, { auth: false }), { ttl: 10 * 60_000, onData: setPost }).catch((e) => setErr(e.message));
    } else {
      swr('posts', () => api.get('/api/public/posts', { auth: false }).then((r) => r.posts), { ttl: 5 * 60_000, onData: setPosts }).catch((e) => setErr(e.message));
    }
  }, [slug]);

  if (slug) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Button component={RouterLink} to="/news" sx={{ mb: 2 }}>← Semua berita</Button>
        {err && <Alert severity="error">{err}</Alert>}
        {!post && !err && <Skeleton variant="rounded" height={400} />}
        {post && <>
          <Chip size="small" label={post.category || 'Berita'} sx={{ mb: 1 }} />
          <Typography variant="h3" sx={{ fontSize: { xs: 28, md: 40 } }} gutterBottom>{post.title}</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>{fmt(post.publishedAt)}</Typography>
          {post.coverFileId && <Box component="img" src={fileUrl(post.coverFileId)} alt="" sx={{ width: '100%', borderRadius: 3, mb: 3 }} />}
          <Body text={post.body} />
        </>}
      </Container>
    );
  }

  return (
    <>
      <PageHeader title="Berita & Artikel" subtitle="Pembaruan fitur, tips aplikasi, dan panduan Google Play." />
      <Container maxWidth="lg" sx={{ py: 5 }}>
        {err && <Alert severity="error">{err}</Alert>}
        {posts === null ? <Skeleton variant="rounded" height={200} /> : posts.length === 0 ? (
          <Typography color="text.secondary">Belum ada artikel.</Typography>
        ) : (
          <Grid container spacing={2}>
            {posts.map((p) => (
              <Grid item xs={12} sm={6} md={4} key={p.slug}>
                <Card sx={{ height: '100%' }}>
                  <CardActionArea component={RouterLink} to={`/news/${p.slug}`} sx={{ height: '100%' }}>
                    {p.coverFileId && <CardMedia component="img" height="160" image={fileUrl(p.coverFileId)} alt="" />}
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">{p.category || 'Berita'} • {fmt(p.publishedAt)}</Typography>
                      <Typography variant="h6">{p.title}</Typography>
                      <Typography variant="body2" color="text.secondary">{p.excerpt}</Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </>
  );
}
