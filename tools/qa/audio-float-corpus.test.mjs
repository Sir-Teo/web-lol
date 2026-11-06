import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
for (const optimized of [false, true])
  test(`float-master format and headroom guards ${optimized ? 'optimized' : 'normal'}`, () => {
    execFileSync(
      'python3',
      [...(optimized ? ['-O'] : []), 'tools/assets/test-audio-float-corpus.py'],
      { stdio: 'pipe' }
    );
  });
