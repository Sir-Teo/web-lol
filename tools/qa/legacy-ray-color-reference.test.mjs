import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
const reference = resolve('tools/qa/lib/legacy-ray-color-reference.py'),
  fixtures = JSON.parse(readFileSync('docs/reference/gromp-ray-raw-color-fixtures.json'));
for (const optimized of [false, true])
  test(`legacy raw-color C reference and scope guards ${optimized ? 'optimized' : 'normal'}`, () => {
    const root = mkdtempSync(resolve(tmpdir(), 'legacy-ray-test-')),
      mode = optimized ? ['-O'] : [];
    try {
      const input = resolve(root, 'input.json'),
        output = resolve(root, 'output.json');
      writeFileSync(
        input,
        JSON.stringify(fixtures.rows.map(({ profileIndex, phase }) => ({ profileIndex, phase })))
      );
      execFileSync('python3', [...mode, reference, input, output]);
      assert.deepEqual(JSON.parse(readFileSync(output)), fixtures.rows);
      const compiler = JSON.parse(readFileSync(output + '.compiler.json'));
      assert.deepEqual(compiler.flags, ['-std=c11', '-O2', '-ffp-contract=off', '-fno-fast-math']);
      assert.equal(compiler.nativeExecuted, false);
      const original = readFileSync(output);
      assert.notEqual(
        spawnSync('python3', [...mode, reference, input, output], { encoding: 'utf8' }).status,
        0
      );
      assert.deepEqual(readFileSync(output), original);
      for (const [i, row] of [
        { profileIndex: 6, phase: 0.5 },
        { profileIndex: true, phase: 0.5 },
        { profileIndex: 5, phase: 1.1 },
        { profileIndex: 7, phase: -0.1 },
        { profileIndex: 5, phase: '0.5' },
        { profileIndex: 5, phase: null },
      ].entries()) {
        writeFileSync(input, JSON.stringify([row]));
        const rejected = resolve(root, `rejected-${i}.json`),
          result = spawnSync('python3', [...mode, reference, input, rejected], {
            encoding: 'utf8',
          });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /Unsupported profile|Invalid normalized local phase/);
        assert.equal(existsSync(rejected), false);
        assert.equal(existsSync(rejected + '.c'), false);
      }
      const fake = resolve(root, 'wrong-pin');
      mkdirSync(resolve(fake, 'docs/reference'), { recursive: true });
      writeFileSync(resolve(fake, 'docs/reference/native-legacy-color-curves.json'), '{}');
      const rejected = resolve(root, 'wrong-pin.json'),
        result = spawnSync('python3', [...mode, reference, input, rejected], {
          cwd: fake,
          encoding: 'utf8',
        });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Pinned source changed/);
      assert.equal(existsSync(rejected), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
