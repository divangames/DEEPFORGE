import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const githubPages = process.env.GITHUB_ACTIONS === 'true';
const base = githubPages ? '/DEEPFORGE/' : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      base,
      scope: base,
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'DEEPFORGE: Idle Empire',
        short_name: 'DEEPFORGE',
        description: 'Браузерная mobile-first idle/tycoon игра.',
        theme_color: '#101114',
        background_color: '#101114',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
