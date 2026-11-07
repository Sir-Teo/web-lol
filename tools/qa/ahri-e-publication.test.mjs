import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
for (const optimized of [false, true])
  test('Ahri E publication guards ' + (optimized ? 'optimized' : 'normal'), () => {
    execFileSync(
      'python3',
      [...(optimized ? ['-O'] : []), 'tools/assets/test-ahri-e-publication.py'],
      { stdio: 'pipe' }
    );
  });
