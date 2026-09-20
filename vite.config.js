import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// See README.md for how to generate real icon files before you deploy.
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          leaflet: ['leaflet', 'react-leaflet'],
          supabase: ['@supabase/supabase-js']
        }
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // we register manually in main.jsx for a guaranteed reload on update
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Site Log — Photo Tracker',
        short_name: 'Site Log',
        description: 'Tag and track jobsite photos by location, category, and progress status.',
        theme_color: '#1F2A37',
        background_color: '#F5F5F4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // A new service worker takes control immediately instead of waiting
        // for every open tab/app instance to close first — this is what was
        // causing "I deployed but nothing changed" on iOS.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // App-shell caching only — photo data always goes to the network so
        // the gallery never shows stale/duplicate uploads.
        globPatterns: ['**/*.{js,css,html,svg,ico}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/storage/v1/object'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-photo-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ]
})
