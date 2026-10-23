/** Retained local source/renderer evidence. Does not certify native parity or FPS. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const evidence = read('docs/reference/lux-e-missile-verification.json');
const audit = read('docs/reference/lux-e-missile-match-audit.json');
const reading = read('docs/reference/lux-e-missile-reading.json');
const refs = [
  ...evidence.files,
  ...evidence.assets,
  ...reading.files,
  audit.runner.source,
  audit.runner.frozenBundle,
  ...audit.runs.flatMap((r) => [r.report, r.checkpoint, r.baselineReport, r.baselineCheckpoint]),
];
for (const r of refs) assert.equal(hash(r.path), r.sha256, r.path);
assert.equal(evidence.ruleset, rulesetFingerprint());
assert.equal(evidence.ruleset, audit.ruleset);
assert.equal(evidence.schema, 109);
const coverage = read('docs/reference/lux-e-particle-coverage.json');
assert.equal(coverage.rendered, 55);
assert.equal(coverage.inventory.filter((x) => x.status === 'deferred').length, 9);
assert.equal(coverage.inventory.filter((x) => x.status === 'filtered for base skin').length, 1);
for (const [field, path] of [
  ['sourcePinSha256', 'docs/reference/lux-e-vfx.json'],
  ['profileSha256', 'src/content/lux-e-particles.json'],
  ['burstProfileSha256', 'src/content/lux-e-burst.json'],
  ['fieldProfileSha256', 'src/content/lux-e-field.json'],
])
  assert.equal(coverage[field], hash(path));
assert.equal(audit.roadmap100SeedGateMet, false);
assert.equal(audit.runs.length, 4);
for (const run of audit.runs) {
  const report = read(run.report.path),
    old = read(run.baselineReport.path);
  assert.equal(report.failure, null);
  assert.equal(report.winner, old.winner);
  assert.equal(report.finalTick, old.finalTick);
  assert.deepEqual(report.samples, old.samples);
  const current = read(run.checkpoint.path),
    before = read(run.baselineCheckpoint.path);
  assert.equal(current.version, 109);
  assert.equal(current.ruleset, evidence.ruleset);
  delete current.ruleset;
  delete before.ruleset;
  assert.deepEqual(current, before);
}
assert.equal(evidence.checks.production.result, 'passed');
assert.equal(evidence.checks.production.developmentHook, false);
assert(evidence.checks.production.lucentSourceAssets.includes('assets/models/lux-e-slash.glb'));
const batch = read('artifacts/lux-e-missile-batches.json');
assert.equal(batch.length, 15);
assert(
  batch.every(
    (r) => r.maxDelta <= 1 && r.batchCalls <= (r.role === 'ally' ? 10 : r.role === 'enemy' ? 7 : 3)
  )
);
assert.equal(batch.filter((r) => r.contributions.length).length, 3);
assert(
  batch
    .filter((r) => r.contributions.length)
    .every((r) => r.contributions.every((c) => c.differentBytes > 0))
);
for (const name of ['recovery', 'flight-recovery']) {
  const r = read(`artifacts/lux-e-missile-${name}.json`);
  assert(
    r.before.restored &&
      r.before.seek &&
      r.after.buffers &&
      r.after.snapshot &&
      r.after.retiredField
  );
  assert.equal(r.after.different, 0);
  assert.equal(r.after.disposed, r.after.resources);
}
for (const name of ['fog', 'flight-fog'])
  assert(Object.values(read(`artifacts/lux-e-missile-${name}.json`)).every(Boolean));
console.log(
  JSON.stringify({
    result: 'passed',
    ruleset: evidence.ruleset,
    references: refs.length,
    rendered: 55,
    filtered: 1,
    deferred: 9,
    checkedTicks: audit.summary.checkedTicks,
    exactRoundTrips: audit.summary.exactRoundTrips,
  })
);
