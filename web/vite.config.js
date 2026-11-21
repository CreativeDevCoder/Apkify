import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Strategi cache sisi klien:
// - Aset hasil build (hash di nama file) -> precache + immutable (lihat public/_headers)
// - Navigasi SPA -> NetworkFirst ke index.html (selalu dapat versi terbaru bila online)
// - /api/public/* -> StaleWhileRevalidate (statistik, template)
// - Font & gambar -> CacheFirst dengan batas jumlah & umur
// - /api/* lain (data pribadi, upload, build) -> TIDAK di-cache service worker
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Apkify — Website ke APK Gratis',
        short_name: 'Apkify',
        description: 'Ubah website, ZIP, atau HTML menjadi aplikasi Android (APK & AAB) gratis.',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/public/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'api-public', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 } }
          },
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          },
          {
            urlPattern: ({ request, url }) => request.destination === 'image' && !url.pathname.startsWith('/api/'),
            handler: 'CacheFirst',
            options: { cacheName: 'images', expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          }
        ]
      }
    })
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@emotion/react', '@emotion/styled'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/database']
        }
      }
    }
  },
  server: {
    proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true } }
  }
});
