/** Execute the pinned external local-Y flight frame without application imports. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
assert(
  process.argv.slice(2).every((arg) => arg === '--check'),
  'Unknown flight fixture argument'
);
const reader = '.cache/baron-emission-readers/engine/utils/basis.ts',
  raw = fs.readFileSync(reader),
  sha256 = createHash('sha256').update(raw).digest('hex');
assert.equal(sha256, '948deb523c5e16fbf6ef529f9967f9b5de8ff3db1c169fa6ceffc58a08fbcf5e');
const ast = ts.createSourceFile(reader, raw.toString(), ts.ScriptTarget.Latest, true),
  fn = ast.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === 'flightInto');
assert(fn);
const exports = {};
new Function(
  'exports',
  ts.transpileModule(fn.getText(ast), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
)(exports);
const directions = [
  [0, 0, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
  [1, 1, 1],
  [-1, -1, -1],
  [1e-100, 1, 0],
  [0, -1, 1e-100],
  [1e100, 1e100, 1e100],
  [Number.MIN_VALUE, 0, 0],
];
let state = 719;
const draw = () => {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return (state % 200001) - 100000;
};
for (let i = 0; i < 256; i++) directions.push([draw(), draw(), draw()]);
const samples = directions.map((direction) => {
  const output = new Float32Array(9);
  exports.flightInto(direction, output);
  return { direction, hex: Buffer.from(output.buffer).toString('hex') };
});
const result = {
  format: 1,
  revision: '2adda384347dd43e76d6295d77fe1f13623b2808',
  reader,
  readerSha256: sha256,
  nativeExecuted: false,
  scope:
    'External JS orientation only; no native height, root path, handedness, PRNG or cadence certification.',
  samples,
};
const text = JSON.stringify(result, null, 2) + '\n',
  file = 'docs/reference/source-flight-basis-samples.json';
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(file, 'utf8'), text);
else fs.writeFileSync(file, text, { flag: 'wx' });
console.log(JSON.stringify({ status: 'passed', cases: samples.length, nativeExecuted: false }));
