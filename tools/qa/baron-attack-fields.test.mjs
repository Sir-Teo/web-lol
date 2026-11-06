import { test } from 'node:test';
import { execFileSync } from 'node:child_process';

for (const optimized of [false, true])
  test(`Baron candidate label reversibility and collision guards ${optimized ? 'optimized' : 'normal'}`, () => {
    execFileSync(
      'python3',
      [...(optimized ? ['-O'] : []), 'tools/assets/test-baron-attack-fields.py'],
      {
        env: { ...process.env, PYTHONPATH: 'tools/assets' },
        stdio: 'pipe',
      }
    );
  });
