import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
for (const optimized of [false, true])
  test(`Ahri Q particle source attachment reading ${optimized ? 'optimized' : 'normal'}`, () => {
    execFileSync('python3', [...(optimized ? ['-O'] : []), 'tools/assets/test-ahri-q-bindings.py'], { stdio: 'pipe' });
  });
