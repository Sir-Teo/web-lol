/** Read-only recorded source/browser/run integrity. No native execution is claimed. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (f) => JSON.parse(readFileSync(f, 'utf8'));
const ledger = json('docs/reference/leona/sunlight-vfx-verification.json');
function verify(pin, file = pin.file) {
  const b = readFileSync(file);
  assert.equal(b.length, pin.bytes, file);
  assert.equal(createHash('sha256').update(b).digest('hex'), pin.sha256, file);
}
for (const p of ledger.evidence) verify(p);
for (const a of ledger.earlierSourceArchives)
  for (const p of json(a.ledger).files) verify(p, `${a.frozenInputs}/${p.file}`);
const source = json(ledger.sourceArchive);
assert.equal(source.schema, 122);
assert.equal(source.ruleset, ledger.ruleset);
for (const p of source.files) {
  verify(p, `${ledger.frozenInputs}/${p.file}`);
  if (!historical) verify(p);
}
for (const p of ledger.reviewInputs) {
  verify(p, p.archived);
  if (!historical) verify(p);
}
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
for (const p of json(ledger.cohortSourceArchive).files) verify(p, p.archived);
for (const p of json(ledger.particleSourceArchive).files) verify(p, p.archived);
for (const p of json(ledger.buildArchive).files) verify(p);
const unitSources = new Map(json(ledger.unitSourceArchive).files.map((p) => [p.file, p]));
for (const p of source.files) {
  if (
    p.file === 'e2e/sunlight.spec.ts' ||
    p.file === 'tools/assets/verify-leona-sunlight-particles.py'
  )
    continue;
  assert.equal(unitSources.get(p.file)?.sha256, p.sha256, p.file);
}
const c = ledger.checks;
assert.equal(readFileSync(c.typecheck, 'utf8'), '');
assert.equal(readFileSync(c.e2eTypecheck, 'utf8'), '');
const tests = readFileSync(c.standard, 'utf8');
assert(tests.includes('1593 passed (1593)') && tests.includes('277 passed (277)'));
const qa = readFileSync(c.nodeQa, 'utf8');
assert(qa.includes('pass 3') && qa.includes('fail 0'));
assert(readFileSync(c.chrome, 'utf8').includes('13 passed'));
assert(readFileSync(c.focused, 'utf8').includes('89 passed (89)'));
const sourceCheck = json(c.source);
assert.equal(sourceCheck.result, 'passed');
assert.equal(sourceCheck.systems, 3);
assert.equal(sourceCheck.emitters, 9);
assert.equal(sourceCheck.textures, 12);
assert.equal(sourceCheck.nativeRenderingVerified, false);
const layers = json(c.layers);
assert.deepEqual(layers.errors, []);
assert.deepEqual(layers.marks.map((m) => m.profile).sort(), [0, 1, 2]);
assert.deepEqual([...new Set(layers.before.map((m) => m.profile))], [3, 4, 5, 6, 7, 8]);
for (const p of [layers.markPixels, layers.hitPixels]) {
  assert.equal(p.error, 0);
  assert(p.profiles.every((p) => p.changed > 0));
}
const disposal = json(c.disposal);
assert.deepEqual(disposal.errors, []);
assert(disposal.disposed.count > 0);
assert.equal(disposal.disposed.materials, disposal.disposed.count);
for (const key of ['geometry', 'textures', 'remaining', 'histories'])
  assert.equal(disposal.disposed[key], 0);
const recovery = json(c.recovery);
assert.deepEqual(recovery.errors, []);
assert.deepEqual(recovery.recovered, recovery.original);
assert.equal(recovery.original.error, 0);
assert.deepEqual(recovery.hidden, { audience: [], hits: 0 });
const terminal = json(c.terminal);
assert.deepEqual(terminal.errors, []);
assert.notEqual(terminal.death.dead, null);
assert.notEqual(terminal.death.detached, null);
assert(terminal.death.active > 0);
assert.equal(terminal.result.winner, 'blue');
assert(terminal.result.active > 0);
assert.equal(terminal.result.remaining, 0);
assert.equal(terminal.result.sameSave, true);
assert.equal(terminal.result.exactRestore, true);
const production = json(c.production);
assert.equal(production.result, 'passed');
assert.equal(production.prefix, '/nested/rift/');
assert.equal(production.recordings, 32);
assert.equal(production.developmentHook, false);
assert.equal(production.unrequestedLeonaPreloads, 0);
const cohort = json(c.cohort);
assert.equal(cohort.result, 'passed');
assert.equal(cohort.ruleset, ledger.ruleset);
assert.equal(cohort.checkedTicks, 72000);
assert.equal(cohort.roundTrips, 20);
assert.equal(cohort.futureChecks, 18);
assert.equal(cohort.hundredSeedInvariantGate, false);
const comparison = json(c.comparison);
assert.equal(comparison.matches.length, 20);
for (const pair of comparison.matches) {
  const before = json(pair.older),
    after = json(pair.newer);
  assert.equal(before.version, 121);
  assert.equal(after.version, 122);
  assert.equal(after.ruleset, ledger.ruleset);
  assert.deepEqual(after.sunlightVisuals, []);
  assert.equal(after.nextSunlightVisual, 1);
  assert(!Object.hasOwn(before, 'sunlightVisuals'));
  assert(!Object.hasOwn(before, 'nextSunlightVisual'));
  delete after.sunlightVisuals;
  delete after.nextSunlightVisual;
  for (const s of [before, after]) {
    delete s.version;
    delete s.ruleset;
  }
  assert.deepEqual(after, before);
}
assert.equal(json(c.priorIntegrity).result, 'passed');
assert.equal(ledger.acceptance.completeLeonaKit, false);
assert.equal(ledger.acceptance.nativeRenderingVerified, false);
assert.equal(ledger.acceptance.productionRosterExpanded, false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    schema: 122,
    ruleset: ledger.ruleset,
    unitTests: 1593,
    chromeCases: 13,
    normalSmokeTicks: 72000,
    archivedInputs: source.files.length,
    generatedBuildFiles: json(ledger.buildArchive).files.length,
    sourceEmitters: 9,
    sourceTextures: 12,
    nativeRenderingVerified: false,
    completeLeonaKit: false,
  })
);
