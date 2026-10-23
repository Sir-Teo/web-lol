/** Verify retained local target-hit evidence, not native composition or FPS. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const evidence = read('docs/reference/lux-e-hit-verification.json');
const audit = read('docs/reference/lux-e-hit-match-audit.json');
const refs = [
  ...evidence.files,
  ...evidence.assets,
  audit.runner.source,
  audit.runner.frozenBundle,
  ...audit.runs.flatMap((r) => [r.report, r.checkpoint, r.baselineReport, r.baselineCheckpoint]),
];
for (const r of refs) assert.equal(hash(r.path), r.sha256, r.path);
assert.equal(evidence.ruleset, rulesetFingerprint());
assert.equal(audit.ruleset, evidence.ruleset);
assert.equal(evidence.schema, 110);
assert.equal(audit.runs.length, 4);
assert.equal(audit.roadmap100SeedGateMet, false);
for (const run of audit.runs) {
  const now = read(run.report.path),
    old = read(run.baselineReport.path);
  assert.equal(now.failure, null);
  assert.equal(now.winner, old.winner);
  assert.equal(now.finalTick, old.finalTick);
  assert.deepEqual(now.samples, old.samples);
  const a = read(run.checkpoint.path),
    b = read(run.baselineCheckpoint.path);
  assert.equal(a.version, 110);
  assert.equal(b.version, 109);
  assert.equal(a.ruleset, evidence.ruleset);
  delete a.version;
  delete b.version;
  delete a.ruleset;
  delete b.ruleset;
  for (const z of a.singularities) delete z.hits;
  assert.deepEqual(a, b);
}
const coverage = read('docs/reference/lux-e-particle-coverage.json');
assert.equal(coverage.rendered, 56);
assert.equal(coverage.inventory.filter((x) => x.status === 'deferred').length, 8);
assert.equal(coverage.inventory.filter((x) => x.status === 'filtered for base skin').length, 1);
for (const [field, path] of [
  ['sourcePinSha256', 'docs/reference/lux-e-vfx.json'],
  ['profileSha256', 'src/content/lux-e-particles.json'],
  ['burstProfileSha256', 'src/content/lux-e-burst.json'],
  ['fieldProfileSha256', 'src/content/lux-e-field.json'],
])
  assert.equal(coverage[field], hash(path));
const recovery = read('artifacts/lux-e-hit-recovery.json');
assert(recovery.before.restored && recovery.before.seek && recovery.before.contribution > 0);
assert.deepEqual(recovery.after, {
  different: 0,
  buffers: true,
  snapshot: true,
  disposed: 2,
  models: 0,
  hits: 0,
});
for (const name of ['seen', 'unseen']) {
  const r = read(`artifacts/lux-e-hit-fog-${name}.json`);
  assert(r.hidden && r.restored && r.snapshot && r.continued);
  assert.equal(r.models, name === 'seen' ? 1 : 0);
}
const terminal = read('artifacts/lux-e-hit-terminal.json');
assert(terminal.frozen && terminal.repeated && terminal.expired);
assert.equal(terminal.disposed, 2);
assert.equal(evidence.checks.production.result, 'passed');
assert.equal(evidence.checks.production.developmentHook, false);
assert(
  evidence.checks.production.lucentSourceAssets.includes('assets/effects/lux-e-color-hit-mana.png')
);
console.log(
  JSON.stringify({
    result: 'passed',
    ruleset: evidence.ruleset,
    schema: 110,
    references: refs.length,
    rendered: 56,
    filtered: 1,
    deferred: 8,
    checkedTicks: audit.summary.checkedTicks,
    exactRoundTrips: audit.summary.exactRoundTrips,
  })
);
