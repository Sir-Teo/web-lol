/** Read-only archived/current integrity and recorded browser evidence, not a native run. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const historical = process.argv.includes('--historical');
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const ledger = json('docs/reference/leona/rig-verification.json');
function verify(pin, file = pin.file) {
  const bytes = readFileSync(file);
  assert.equal(bytes.length, pin.bytes, file);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256, file);
}
for (const pin of ledger.evidence) verify(pin);
for (const archive of ledger.earlierSourceArchives)
  for (const pin of json(archive.ledger).files) verify(pin, `${archive.frozenInputs}/${pin.file}`);
const source = json(ledger.sourceArchive);
assert.equal(source.schema, 121);
assert.equal(source.ruleset, ledger.ruleset);
for (const pin of source.files) {
  verify(pin, `${ledger.frozenInputs}/${pin.file}`);
  if (!historical) verify(pin);
}
for (const pin of ledger.reviewInputs) {
  verify(pin, pin.archived);
  if (!historical) verify(pin);
}
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
for (const pin of json(ledger.cohortSourceArchive).files) verify(pin, pin.archived);
for (const pin of json(ledger.buildArchive).files) verify(pin);

const c = ledger.checks;
assert.equal(readFileSync(c.typecheck, 'utf8'), '');
assert.equal(readFileSync(c.e2eTypecheck, 'utf8'), '');
const tests = readFileSync(c.standard, 'utf8');
assert(tests.includes('1586 passed (1586)') && tests.includes('276 passed (276)'));
const qa = readFileSync(c.nodeQa, 'utf8');
assert(qa.includes('pass 3') && qa.includes('fail 0'));
assert(readFileSync(c.chrome, 'utf8').includes('10 passed'));
assert(readFileSync(c.build, 'utf8').includes('built in'));
const keys = json(c.sourceKeys);
assert.equal(keys.result, 'passed');
assert.equal(keys.animations, 23);
assert.equal(keys.channels, 5475);
assert.equal(keys.keys, 608016);
assert.equal(keys.correctedQuaternionKeys, 0);
assert.equal(keys.sourceNormalsPreserved, true);
assert.equal(keys.geometryIndicesAndAttributesEqualAfterDeclaredConversion, true);
assert.deepEqual(keys.gltf, { errors: 0, warnings: 0 });
verify(keys.source);
if (!historical) verify(keys.output);
verify(keys.verifier);

const vertices = json(c.vertices);
assert.equal(vertices.clips, 23);
assert.equal(vertices.samples, 225);
assert.equal(vertices.vertices, 1481625);
assert.equal(vertices.maxError, 0);
assert.equal(vertices.outside, 0);
assert.deepEqual(vertices.tracks, [5475, 5475]);
assert(vertices.bounds.every((b) => b.enabled && b.culling && b.radius > 0));
const actions = json(c.actions);
assert.deepEqual(actions.errors, []);
assert.deepEqual(actions.result.swings.sort(), ['attack1', 'attack2']);
const expected = {
  idle: 'idle1',
  run: 'run',
  blend: 'idle1',
  attack1: 'attack1',
  attack2: 'attack2',
  crit: 'crit',
  q: 'spell1',
  'w-cast': 'spell2',
  'w-idle': 'spell2_idle',
  'w-run': 'spell2_run',
  'w-attack': 'spell2_attack',
  e: 'spell3',
  r: 'spell4',
  'recall-first': 'entry_b4dcde19',
  'recall-second': 'idle3',
  death: 'death',
};
assert.equal(actions.result.stages.length, Object.keys(expected).length);
for (const stage of actions.result.stages) {
  assert.equal(stage.before.rig, 'leona-base');
  assert.equal(stage.before.clip, expected[stage.name]);
  assert.equal(stage.before.bones.length, 81 * 16);
  assert(stage.before.bones.every(Number.isFinite));
  assert.equal(stage.samePose, true);
  assert.equal(stage.exactSave, true);
}
assert(actions.result.stages.find((s) => s.name === 'blend').before.actions.length > 1);
const recovery = json(c.recovery);
assert.deepEqual(recovery.before, recovery.after);
assert(recovery.before.changed > 100);
assert.equal(recovery.before.error, 0);
assert.equal(recovery.before.clip, 'spell2_idle');
assert.deepEqual(recovery.disposal, {
  shared: true,
  privateBones: true,
  skeletons: 1,
  geometries: 0,
  materials: 0,
});
assert.deepEqual(recovery.errors, []);
const gate = json(c.fixture);
assert.equal(gate.result.saved, gate.prepared.snapshot);
assert.equal(gate.result.champion, 'ashe');
assert(gate.result.identities.includes('leona'));
assert.equal(gate.result.leonaModels.length, 2);
assert(gate.result.leonaModels.every((m) => m.rig === 'leona-base' && m.hasTimeline));
assert.deepEqual(gate.errors, []);
const production = json(c.production);
assert.equal(production.result, 'passed');
assert.equal(production.prefix, '/nested/rift/');
assert.equal(production.recordings, 32);
assert.equal(production.developmentHook, false);
const cohort = json(c.cohort);
assert.equal(cohort.result, 'passed');
assert.equal(cohort.ruleset, ledger.ruleset);
assert.equal(cohort.checkedTicks, 72000);
assert.equal(cohort.roundTrips, 20);
assert.equal(cohort.futureChecks, 18);
assert.equal(cohort.hundredSeedInvariantGate, false);
const comparison = json(c.checkpointComparison);
assert.equal(comparison.matches.length, 20);
for (const pair of comparison.matches) {
  const before = json(pair.older),
    after = json(pair.newer);
  assert.equal(before.version, 120);
  assert.equal(after.version, 121);
  assert.equal(after.ruleset, ledger.ruleset);
  for (const s of [before, after]) {
    delete s.version;
    delete s.ruleset;
  }
  assert.deepEqual(after, before);
}
assert.equal(json(c.priorIntegrity).result, 'passed');
assert.equal(ledger.acceptance.completeLeonaKit, false);
assert.equal(ledger.acceptance.nativePresentationVerified, false);
assert.equal(ledger.acceptance.productionRosterExpanded, false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    schema: 121,
    ruleset: ledger.ruleset,
    unitTests: 1586,
    chromeCases: 10,
    normalSmokeTicks: 72000,
    archivedInputs: source.files.length,
    generatedBuildFiles: json(ledger.buildArchive).files.length,
    sourceKeys: 608016,
    nativePresentationVerified: false,
    completeLeonaKit: false,
  })
);
