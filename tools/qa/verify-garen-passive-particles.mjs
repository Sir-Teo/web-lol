/** Verify frozen source/resource identities and the scope of this fixture increment. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const evidence = read('docs/reference/garen-passive-particles-verification.json');
const pin = read('docs/reference/garen-passive-particles.json');
const decoded = read('docs/reference/garen-passive-particles-decoded.json');
for (const r of evidence.files) assert.equal(hash(r.path), r.sha256, r.path);
for (const f of pin.extraction.files)
  assert.equal(
    hash(
      `.cache/garen-passive-particle-sources/${f.wadPathHash}${f.path.slice(f.path.lastIndexOf('.'))}`
    ),
    f.sha256,
    f.path
  );
for (const f of decoded.textures) assert.equal(hash(f.path), f.sha256, f.path);
assert.equal(hash('docs/reference/garen-passive-particles.json'), decoded.sourcePinSha256);
assert.equal(hash(decoded.profile.path), decoded.profile.sha256);
assert.equal(evidence.ruleset, rulesetFingerprint());
assert.equal(evidence.schema, 111);
assert.equal(decoded.rendered.length, 1);
assert.equal(decoded.filtered.length, 1);
assert.equal(decoded.deferred.length, 1);
const recovery = read('artifacts/garen-passive-source-recovery.json'),
  life = read('artifacts/garen-passive-source-lifecycle.json'),
  batch = read('artifacts/garen-passive-source-batch.json');
assert(recovery.before.seek && recovery.before.contribution > 100);
assert.deepEqual(recovery.after, { different: 0, buffers: true, snapshot: true });
assert(life.hidden && life.restored && life.frozen);
assert.deepEqual(life.death, { disposed: 2, models: 0, records: 0 });
assert.deepEqual(life.terminal, { active: 1, drained: true, unchanged: true });
assert.equal(batch.length, 13);
assert(batch.every((p) => p.delta === 0));
assert(batch.some((p) => p.batchCalls === 1 && p.separateCalls === 15));
assert(batch.some((p) => p.particles === 0 && p.batchCalls === 0));
assert.match(readFileSync(evidence.checks.unit.log, 'utf8'), /1407 passed/);
assert.match(readFileSync(evidence.checks.unit.log, 'utf8'), /258 passed/);
assert.match(readFileSync(evidence.checks.chrome.log, 'utf8'), /22 passed/);
assert.equal(evidence.checks.production.result, 'passed');
assert.equal(evidence.checks.production.developmentHook, false);
assert.equal(evidence.checks.production.garenFixtureInProduction, false);
assert.equal(evidence.normalRulesMatches.rerun, false);
console.log(
  JSON.stringify({
    result: 'passed',
    ruleset: evidence.ruleset,
    schema: evidence.schema,
    references: evidence.files.length + pin.extraction.files.length + decoded.textures.length,
    rendered: 1,
    deferred: 1,
    disabled: 1,
    gpuSamples: batch.length,
  })
);
