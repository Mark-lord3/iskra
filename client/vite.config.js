import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Display-name moderation is shared verbatim with the API so the two can
  // never disagree about what is allowed.
  resolve: { alias: { '@shared': path.resolve(here, '../shared') } },
  server: {
    fs: { allow: [here, path.resolve(here, '../shared')] },
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4310', changeOrigin: true },
      '/ws/poker': { target: 'ws://localhost:4310', ws: true }
    }
  },
  build: { outDir: 'dist', sourcemap: false }
});
