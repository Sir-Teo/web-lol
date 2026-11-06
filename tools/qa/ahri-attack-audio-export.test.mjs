import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
for (const optimized of [false, true])
  test(`Ahri Essence Theft publication guards ${optimized ? 'optimized' : 'normal'}`, () => {
    execFileSync(
      'python3',
      [...(optimized ? ['-O'] : []), 'tools/assets/test-ahri-attack-audio-export.py'],
      { stdio: 'pipe' }
    );
  });
