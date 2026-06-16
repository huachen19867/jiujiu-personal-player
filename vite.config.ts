import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { APP_BRAND } from './src/config/brand';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['manifest-icon.svg'],
      manifest: {
        name: APP_BRAND.displayName,
        short_name: APP_BRAND.shortName,
        description: APP_BRAND.description,
        theme_color: '#101113',
        background_color: '#101113',
        display: 'standalone',
        lang: 'zh-CN',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/manifest-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
