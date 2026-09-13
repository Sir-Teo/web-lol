import { defineConfig } from 'vite';

export default defineConfig({
  build: { target: 'es2022', rollupOptions: { output: { manualChunks: id => id.includes('/node_modules/three/') ? 'three' : undefined } } },
  server: { port: 5173, strictPort: true },
});
