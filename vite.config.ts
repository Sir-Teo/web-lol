import { defineConfig } from 'vite';
import { rulesetFingerprint, affectsRuleset } from './tools/ruleset-fingerprint.ts';

export default defineConfig({
  base: './',
  define: { __SIMULATION_HASH__: JSON.stringify(rulesetFingerprint()) },
  plugins: [
    {
      name: 'refresh-ruleset-identity',
      configureServer(server) {
        server.watcher.on('all', (event, file) => {
          if (['add', 'change', 'unlink'].includes(event) && affectsRuleset(file))
            void server.restart();
        });
      },
    },
  ],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: { game: 'index.html', map: 'map.html' },
      output: { manualChunks: (id) => (id.includes('/node_modules/three/') ? 'three' : undefined) },
    },
  },
  server: { port: 5173, strictPort: true },
});
