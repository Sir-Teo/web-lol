/** Read-only recorded skin-material/native-byte integrity; no native execution. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical'),
  json = (p) => JSON.parse(readFileSync(p, 'utf8'));
const ledger = json('docs/reference/leona/w-skin-material-verification.json');
const hash = (b) => createHash('sha256').update(b).digest('hex');
function verify(p, file = p.file) {
  const b = readFileSync(file);
  assert.equal(b.length, p.bytes, file);
  assert.equal(hash(b), p.sha256, file);
}
for (const p of ledger.evidence) verify(p);
const source = json(ledger.sourceArchive),
  inputs = new Map(source.files.map((p) => [p.file, p]));
for (const archive of [ledger.sourceArchive, ...ledger.earlierSourceArchives])
  for (const p of json(archive).files) {
    verify(p, p.archived);
    if (archive === ledger.sourceArchive && !historical) verify(p);
  }
for (const p of ledger.reviewInputs) {
  verify(p, p.archived);
  if (!historical) verify(p);
}
for (const archive of ledger.preservedArchives)
  for (const p of json(archive).files) verify(p, p.archived ?? p.file);
assert.equal(source.ruleset, ledger.ruleset);
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
const previous = json(ledger.unitSourceArchive);
const changed = previous.files
  .filter((p) => p.sha256 !== inputs.get(p.file)?.sha256)
  .map((p) => p.file)
  .sort();
assert.deepEqual(changed, [
  'e2e/leona-eclipse-skin-material.spec.ts',
  'tools/qa/leona-eclipse-skin-preview.ts',
]);
const native = json(inputs.get('docs/reference/leona-w-skin-shaders.json').archived);
const frozenNative = new Map(json(ledger.nativeArchive).files.map((p) => [p.file, p.archived]));
const raw = (file) => readFileSync(frozenNative.get(file));
assert.equal(native.selections.length, 10);
assert.equal(native.extraction.files.length, 7);
for (const p of native.extraction.files) {
  const b = raw('.cache/leona-w-skin-shaders/native/' + p.path);
  assert.equal(b.length, p.bytes);
  assert.equal(hash(b), p.sha256);
}
for (const p of native.selections) {
  const metal = raw(p.metallib.path),
    bc = raw(p.bitcode.path);
  assert.equal(hash(metal), p.metallib.sha256);
  assert.equal(hash(bc), p.bitcode.sha256);
  assert.equal(metal.subarray(0, 4).toString(), 'MTLB');
  assert.deepEqual(metal.subarray(p.bitcode.offset, p.bitcode.offset + p.bitcode.bytes), bc);
  assert.equal(bc.subarray(0, 4).toString('hex'), '4243c0de');
  assert.equal(hash(raw(p.disassembly.path)), p.disassembly.sha256);
}
const c = ledger.checks;
assert.equal(readFileSync(c.typecheck, 'utf8'), '');
assert.equal(readFileSync(c.qaTypes, 'utf8'), '');
assert(readFileSync(c.standard, 'utf8').includes('1618 passed (1618)'));
assert(readFileSync(c.standard, 'utf8').includes('280 passed (280)'));
assert(readFileSync(c.nodeQa, 'utf8').includes('pass 3'));
assert(readFileSync(c.nodeQa, 'utf8').includes('fail 0'));
assert(readFileSync(c.chrome, 'utf8').includes('4 passed'));
for (const [file, count] of [
  [c.rim, 57],
  [c.erosion, 20],
  [c.texels, 108],
]) {
  const report = json(file);
  assert.deepEqual(report.errors, []);
  assert.equal(report.results.length, count);
  for (const p of report.results)
    for (let i = 0; i < 4; i++) assert(Math.abs(p.actual[i] - p.expected[i]) <= 1);
}
const animated = json(c.animated);
assert.deepEqual(animated.errors, []);
assert.equal(animated.results.length, 3);
for (const p of animated.results) {
  assert(p.visible > 100);
  assert(p.max <= 8);
  assert(p.significant / p.visible <= 0.0001);
}
assert.equal(animated.recovery.same, true);
assert.equal(animated.recovery.error, 0);
assert.equal(animated.recovery.repeated.changed, 0);
assert.equal(animated.recovery.difference.changed, 0);
const deploy = json(c.deployment),
  before = json(deploy.prior),
  after = json(deploy.current),
  key = (p) => p.file.split('/generated-build/')[1];
assert.equal(deploy.result, 'passed');
assert.equal(deploy.byteIdentical, true);
assert.equal(before.files.length, 28);
assert.equal(after.files.length, 28);
const built = new Map(after.files.map((p) => [key(p), p]));
for (const p of before.files) {
  const q = built.get(key(p));
  assert.equal(q?.bytes, p.bytes);
  assert.equal(q?.sha256, p.sha256);
}
assert.equal(json(c.priorIntegrity).result, 'passed');
assert.equal(ledger.acceptance.runtimeWIntegrated, false);
assert.equal(ledger.acceptance.nativeRenderingVerified, false);
assert.equal(ledger.acceptance.completeLeonaKit, false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    schema: 123,
    ruleset: ledger.ruleset,
    unitTests: 1618,
    chromeCases: 4,
    analyticalProbes: 185,
    nativePrograms: 10,
    nativeExecuted: false,
    sourceInputs: source.files.length,
    nativeFiles: json(ledger.nativeArchive).files.length,
    productionByteIdentical: true,
    runtimeWIntegrated: false,
    nativeRenderingVerified: false,
    completeLeonaKit: false,
  })
);
