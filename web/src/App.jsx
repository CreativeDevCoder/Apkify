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

const Fallback = () => <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0 }}><LinearProgress /></Box>;

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<ProtectedRoute><Create /></ProtectedRoute>} />
          <Route path="/create/:appId" element={<ProtectedRoute><Create /></ProtectedRoute>} />
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
          <Route path="/admin" element={<ProtectedRoute admin><Admin /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
