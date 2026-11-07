import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
// Exercise the production-only panel with controlled storage methods, not a game pack.
export default defineConfig({
  root: fileURLToPath(new URL('../../', import.meta.url)),
  define: { 'import.meta.env.PROD': 'true' },
});
