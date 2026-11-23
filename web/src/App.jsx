import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, LinearProgress } from '@mui/material';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Code-splitting per halaman: unduhan awal kecil, halaman lain di-cache SW setelah dibuka
const Home = lazy(() => import('./pages/Home'));
const Create = lazy(() => import('./pages/Create'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const BuildDetail = lazy(() => import('./pages/BuildDetail'));
const Docs = lazy(() => import('./pages/Docs'));
const Pricing = lazy(() => import('./pages/Pricing'));
const ToolsIndex = lazy(() => import('./pages/tools/ToolsIndex'));
const IconResizer = lazy(() => import('./pages/tools/IconResizer'));
const QrGenerator = lazy(() => import('./pages/tools/QrGenerator'));
const ColorPalette = lazy(() => import('./pages/tools/ColorPalette'));
const FeatureGraphic = lazy(() => import('./pages/tools/FeatureGraphic'));
const Admin = lazy(() => import('./pages/admin/Admin'));
const NotFound = lazy(() => import('./pages/NotFound'));
const About = lazy(() => import('./pages/About'));
const Features = lazy(() => import('./pages/Features'));
const Compare = lazy(() => import('./pages/Compare'));
const Templates = lazy(() => import('./pages/Templates'));
const Guides = lazy(() => import('./pages/Guides'));
const Contact = lazy(() => import('./pages/Contact'));
const Blog = lazy(() => import('./pages/Blog'));
const AiStudio = lazy(() => import('./pages/AiStudio'));
const Market = lazy(() => import('./pages/market/Market'));
const MarketDetail = lazy(() => import('./pages/market/MarketDetail'));
const MarketSell = lazy(() => import('./pages/market/MarketSell'));
const GetApp = lazy(() => import('./pages/GetApp'));
const ScreenshotMockup = lazy(() => import('./pages/tools/ScreenshotMockup'));
const PromoVideo = lazy(() => import('./pages/tools/PromoVideo'));
const ListingPreview = lazy(() => import('./pages/tools/ListingPreview'));
const DescriptionTemplates = lazy(() => import('./pages/tools/DescriptionTemplates'));
const ListingChecklist = lazy(() => import('./pages/tools/ListingChecklist'));
const PwaBuilder = lazy(() => import('./pages/tools/PwaBuilder'));
const Legal = lazy(() => import('./pages/Legal'));
const Landing = lazy(() => import('./pages/Landing'));
const Hosting = lazy(() => import('./pages/Hosting'));
const MediaApp = lazy(() => import('./pages/MediaApp'));

const Fallback = () => <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0 }}><LinearProgress /></Box>;

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<Create />} />
          <Route path="/create/:appId" element={<Create />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Login mode="register" />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/build/:buildId" element={<ProtectedRoute><BuildDetail /></ProtectedRoute>} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/tools" element={<ToolsIndex />} />
          <Route path="/tools/icon-resizer" element={<IconResizer />} />
          <Route path="/tools/qr-code" element={<QrGenerator />} />
          <Route path="/tools/color-palette" element={<ColorPalette />} />
          <Route path="/tools/feature-graphic" element={<FeatureGraphic />} />
          <Route path="/tools/screenshot-mockup" element={<ScreenshotMockup />} />
          <Route path="/tools/promo-video" element={<PromoVideo />} />
          <Route path="/tools/listing-preview" element={<ListingPreview />} />
          <Route path="/tools/description-templates" element={<DescriptionTemplates />} />
          <Route path="/tools/play-checklist" element={<ListingChecklist />} />
          <Route path="/about" element={<About />} />
          <Route path="/features" element={<Features />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/guides" element={<Guides />} />
          <Route path="/guides/:platform" element={<Guides />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/news" element={<Blog />} />
          <Route path="/news/:slug" element={<Blog />} />
          <Route path="/ai-studio" element={<AiStudio />} />
          <Route path="/market" element={<Market />} />
          <Route path="/market/sell" element={<ProtectedRoute><MarketSell /></ProtectedRoute>} />
          <Route path="/market/edit/:id" element={<ProtectedRoute><MarketSell /></ProtectedRoute>} />
          <Route path="/market/:id" element={<MarketDetail />} />
          <Route path="/get-app" element={<GetApp />} />
          <Route path="/tools/pwa-builder" element={<PwaBuilder />} />
          <Route path="/privacy" element={<Legal type="privacy" />} />
          <Route path="/terms" element={<Legal type="terms" />} />
          <Route path="/hosting" element={<Hosting />} />
          <Route path="/media-app" element={<MediaApp />} />
          {['/website-to-app', '/convert-website-to-mobile-app', '/html-to-app', '/ai-website-to-app', '/website-to-exe', '/website-to-ipa', '/website-to-desktop-app'].map((p) => <Route key={p} path={p} element={<Landing />} />)}
          <Route path="/admin" element={<ProtectedRoute admin><Admin /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
