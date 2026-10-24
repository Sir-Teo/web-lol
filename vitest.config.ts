import { defineConfig } from 'vitest/config';
import { rulesetFingerprint } from './tools/ruleset-fingerprint.ts';
export default defineConfig({
  define: { __SIMULATION_HASH__: JSON.stringify(rulesetFingerprint()) },
  test: { include: ['tests/**/*.test.ts'], maxWorkers: 2 },
});
