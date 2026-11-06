import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
for (const optimized of [false, true])
  test('Ahri W complete profile reading ' + (optimized ? 'optimized' : 'normal'), () => {
    const result = JSON.parse(
      execFileSync(
        'python3',
        [...(optimized ? ['-O'] : []), 'tools/assets/test-ahri-w-profiles.py'],
        { encoding: 'utf8', timeout: 90000 }
      )
    );
    assert.equal(result.result, 'passed');
    assert.equal(result.privateInputsRequired, false);
    assert.equal(result.nativeParserRequired, false);
    assert.equal(result.profiles, 30);
    assert.equal(result.authoredFields, 66);
    assert.equal(result.structuralMutationCases, 2);
  });
