import { defineConfig } from 'vite';
import { resolve } from 'path';

const __dirname = import.meta.dirname;

export default defineConfig({
  root: __dirname,
  publicDir: resolve(__dirname, 'public'),
  server: {
    // mirrors the nginx /api/ proxy so dev hits the real rag-api
    proxy: {
      '/api': { target: 'http://192.168.1.133:8090', rewrite: p => p.replace(/^\/api/, '') },
    },
  },
  build: {
    outDir: resolve(__dirname, 'site'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // define static pages here
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
});
