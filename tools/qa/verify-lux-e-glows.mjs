/** Verify retained local field/source evidence, not native equivalence or FPS. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const evidence = read('docs/reference/lux-e-glows-verification.json');
const audit = read('docs/reference/lux-e-glows-match-audit.json');
const refs = [
  ...evidence.files,
  ...evidence.assets,
  audit.runner.source,
  audit.runner.frozenBundle,
  ...audit.runs.flatMap((r) => [r.report, r.checkpoint, r.baselineReport, r.baselineCheckpoint]),
];
for (const r of refs) assert.equal(hash(r.path), r.sha256, r.path);
assert.equal(evidence.ruleset, rulesetFingerprint());
assert.equal(evidence.ruleset, audit.ruleset);
assert.equal(evidence.schema, 109);
assert.equal(evidence.source.renderedEmitterRecords, 49);
assert.equal(evidence.source.deferredEmitterRecords, 16);
assert.equal(evidence.checks.production.result, 'passed');
assert.equal(audit.roadmap100SeedGateMet, false);
assert.equal(audit.runs.length, 4);
const coverage = read('docs/reference/lux-e-particle-coverage.json');
assert.equal(coverage.fieldProfileSha256, hash('src/content/lux-e-field.json'));
assert.equal(coverage.sourcePinSha256, hash('docs/reference/lux-e-vfx.json'));
console.log(
  JSON.stringify({
    result: 'passed',
    ruleset: evidence.ruleset,
    references: refs.length,
    fieldBatches: evidence.source.fieldBatches,
    checkedTicks: audit.summary.checkedTicks,
    exactRoundTrips: audit.summary.exactRoundTrips,
  })
);
