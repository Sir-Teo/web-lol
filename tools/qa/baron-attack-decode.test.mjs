import { test } from 'node:test';
import { execFileSync } from 'node:child_process';

for (const optimized of [false, true])
  test(`Baron vertex-color mesh and native mip guards ${optimized ? 'optimized' : 'normal'}`, () => {
    execFileSync(
      'python3',
      [...(optimized ? ['-O'] : []), 'tools/assets/test-baron-attack-decode.py'],
      {
        env: { ...process.env, PYTHONPATH: 'tools/assets' },
        stdio: 'pipe',
      }
    );
  });
