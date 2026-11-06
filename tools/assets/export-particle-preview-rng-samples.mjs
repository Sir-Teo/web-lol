/** Execute the pinned external viewer RNG, explicitly not the native stream. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const reader = {
  path: '.cache/baron-emission-readers/engine/utils/Rng.ts',
  sha256: '6cad16e5c8bfcb6e751bce6644c707b5064782bb51b4f1315ce396144221c108',
};
const raw = fs.readFileSync(reader.path);
assert.equal(createHash('sha256').update(raw).digest('hex'), reader.sha256);
const exports = {};
new Function(
  'exports',
  ts.transpileModule(raw.toString(), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
)(exports);
const samples = [];
for (const seed of [0, 1, -1, 12345, -2147483648, 2147483647, 2147483648, 4294967295]) {
  const rng = new exports.Rng(seed),
    values = Array.from({ length: 64 }, () => rng.unitFloat()),
    copy = rng.clone();
  const next = Array.from({ length: 16 }, () => rng.unitFloat());
  assert.deepEqual(
    Array.from({ length: 16 }, () => copy.unitFloat()),
    next
  );
  samples.push({ seed, values, next });
}
const record = {
  revision: '2adda384347dd43e76d6295d77fe1f13623b2808',
  reader,
  scope: 'External preview xorshift32 stream; not the native xorshift64 generator or gameplay RNG.',
  samples,
};
const output = 'docs/reference/particle-preview-rng-samples.json',
  text = JSON.stringify(record, null, 2) + '\n';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(output, 'utf8'), text);
else fs.writeFileSync(output, text, { flag: 'wx' });
console.log(
  JSON.stringify({
    status: 'passed',
    seeds: samples.length,
    draws: samples.length * 80,
    nativeExecuted: false,
  })
);
