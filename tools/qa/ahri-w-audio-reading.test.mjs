import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
for (const optimized of [false, true])
  test(`Ahri W source audio reading guards ${optimized ? 'optimized' : 'normal'}`, () => {
    execFileSync(
      'python3',
      [...(optimized ? ['-O'] : []), 'tools/assets/test-ahri-w-audio-reading.py'],
      { stdio: 'pipe' }
    );
  });
