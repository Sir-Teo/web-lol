import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
for (const optimized of [false, true])
  test('Ahri W attached selector reading ' + (optimized ? 'optimized' : 'normal'), () => {
    const result = JSON.parse(
      execFileSync(
        'python3',
        [...(optimized ? ['-O'] : []), 'tools/assets/test-ahri-w-attached-bindings.py'],
        { encoding: 'utf8', timeout: 90000 }
      )
    );
    assert.equal(result.result, 'passed');
    assert.equal(result.privateInputsRequired, false);
    assert.equal(result.nativeParserRequired, false);
    assert.equal(result.selectors, 2);
    assert.equal(result.pinMutations, 5);
  });
