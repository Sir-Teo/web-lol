import { execFileSync } from 'node:child_process';
import { test } from 'vitest';
test('independent orbital and stretch fixtures reproduce without application arithmetic', () => {
  execFileSync(process.execPath, [
    'tools/assets/export-source-particle-draw-samples.mjs',
    '--check',
  ]);
});
