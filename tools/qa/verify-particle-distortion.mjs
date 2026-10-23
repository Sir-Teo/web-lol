/** Static native identities plus local GPU evidence; not mode/phase certification. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const evidence = read('docs/reference/particle-distortion-verification.json');
const pin = read('docs/reference/particle-distortion-shaders.json');
const reading = read('docs/reference/particle-distortion-reading.json');
const refs = [
  ...evidence.files,
  ...pin.programs.flatMap((p) => [p.metallib, p.bitcode, p.disassembly]),
];
for (const r of refs) assert.equal(hash(r.path), r.sha256, r.path);
assert.equal(evidence.ruleset, rulesetFingerprint());
assert.equal(evidence.schema, 110);
assert.equal(pin.programs.length, 15);
assert.equal(new Set(pin.programs.map((p) => p.table)).size, 4);
for (const f of pin.provenance.files)
  assert.equal(hash('.cache/particle-distortion-shaders/native/' + f.path), f.sha256, f.path);
assert.equal(hash(reading.external.localPath), reading.external.sha256);
const gpu = read('artifacts/particle-distortion-gpu.json'),
  copy = read('artifacts/particle-distortion-copy.json'),
  recovery = read('artifacts/particle-distortion-recovery.json'),
  depth = read('artifacts/particle-distortion-depth.json');
assert.equal(gpu.cases.length, 12);
assert(gpu.cases.every((c) => c.maxDelta <= 2 && c.calls === 2));
assert(
  gpu.perspective.maxDelta <= 2 && gpu.perspective.naiveWitness > 5 && gpu.perspective.samples > 100
);
assert(copy.cases.every((c) => c.delta === 0));
assert.equal(copy.disposed, 3);
assert.equal(recovery.before.error, 0);
assert.equal(recovery.before.identityMaxDelta, 0);
assert.equal(recovery.before.format, 'RGB8');
assert(recovery.before.contribution > 100);
assert.deepEqual(recovery.after, { different: 0, recreated: true, empty: true, unchanged: true });
assert.deepEqual(depth.kept, depth.before);
assert(depth.through[1] > 40 && depth.through[2] > 40);
assert.equal(evidence.checks.production.result, 'passed');
assert.equal(evidence.checks.production.developmentHook, false);
const prior = read('docs/reference/lux-e-hit-match-audit.json');
assert.equal(prior.ruleset, evidence.ruleset);
for (const r of evidence.reusedMatchEvidence) assert.equal(hash(r.path), r.sha256, r.path);
assert.equal(evidence.source.renderedERecords, 56);
assert.equal(evidence.source.deferredERecords, 8);
assert.equal(evidence.source.liveEDistortionRecords, 0);
console.log(
  JSON.stringify({
    result: 'passed',
    ruleset: evidence.ruleset,
    references: refs.length + pin.provenance.files.length + evidence.reusedMatchEvidence.length,
    nativePrograms: 15,
    gpuCases: gpu.cases.length,
    perspectiveSamples: gpu.perspective.samples,
    liveEDistortionRecords: 0,
  })
);
