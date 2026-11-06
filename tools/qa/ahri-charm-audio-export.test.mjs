import { test } from 'node:test';
import { execFileSync } from 'node:child_process';

for (const optimized of [false, true])
  test(`Charm audio whole-closure export guards ${optimized ? 'optimized' : 'normal'}`, () => {
    execFileSync(
      'python3',
      [...(optimized ? ['-O'] : []), 'tools/assets/test-ahri-charm-audio-export.py'],
      {
        stdio: 'pipe',
      }
    );
  });
