import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
for (const optimized of [false, true])
  test('Ahri R complete profile projection ' + (optimized ? 'optimized' : 'normal'), () => {
    const result = JSON.parse(
      execFileSync(
        'python3',
        [...(optimized ? ['-O'] : []), 'tools/assets/test-ahri-r-profiles.py'],
        {
          encoding: 'utf8',
          timeout: 90000,
        }
      )
    );
    assert.equal(result.result, 'passed');
    assert.equal(result.privateInputsRequired, false);
    assert.equal(result.nativeParserRequired, false);
    assert.equal(result.sourcePinMutations, 6);
    assert.equal(result.structuralMutationCases, 9);
    assert.equal(result.profiles, 55);
    assert.equal(result.authoredFields, 68);
  });
