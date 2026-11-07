import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
for (const optimized of [false, true])
  test('Ahri R native producer reading ' + (optimized ? 'optimized' : 'normal'), () => {
    const result = JSON.parse(
      execFileSync(
        'python3',
        [...(optimized ? ['-O'] : []), 'tools/assets/test-ahri-r-bindings.py'],
        {
          encoding: 'utf8',
          timeout: 90000,
        }
      )
    );
    assert.equal(result.result, 'passed');
    assert.equal(result.privateInputsRequired, false);
    assert.equal(result.nativeParserRequired, false);
    assert.equal(result.sourcePinMutations, 5);
    assert.equal(result.bindings, 9);
    assert.equal(result.emitters, 39);
    assert.equal(result.unjoinedSystems, 3);
  });
