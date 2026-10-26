import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared/src'),
      '@tokens': path.resolve(__dirname, '../tokens/generated'),
    },
  },
  server: { port: 5200, strictPort: true, host: '127.0.0.1', fs: { allow: [path.resolve(__dirname, '../..')] } },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, 'index.html'),
        tabbar: path.resolve(__dirname, 'tabbar.html'),
        window: path.resolve(__dirname, 'window.html'),
      },
    },
  },
});
