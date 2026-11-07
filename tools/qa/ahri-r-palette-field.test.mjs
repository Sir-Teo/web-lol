import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
for (const optimized of [false, true])
  test('R hashed palette field identity guards ' + (optimized ? 'optimized' : 'normal'), () => {
    const result = JSON.parse(
      execFileSync(
        'python3',
        [...(optimized ? ['-O'] : []), 'tools/assets/test-ahri-r-palette.py'],
        { encoding: 'utf8', timeout: 90000 }
      )
    );
    assert.equal(result.result, 'passed');
    assert.equal(result.structuralRejections, 8);
    assert.equal(result.sourcePinMutations, 2);
    assert.equal(result.privateInputsRequired, false);
    assert.equal(result.runtimeChanged, false);
  });
