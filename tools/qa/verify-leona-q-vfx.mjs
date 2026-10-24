/** Read-only source/archive/recorded-browser integrity, not native execution. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical'),
  json = (f) => JSON.parse(readFileSync(f, 'utf8'));
const ledger = json('docs/reference/leona/q-vfx-verification.json');
function verify(p, file = p.file) {
  const b = readFileSync(file);
  assert.equal(b.length, p.bytes, file);
  assert.equal(createHash('sha256').update(b).digest('hex'), p.sha256, file);
}
for (const p of ledger.evidence) verify(p);
for (const a of ledger.earlierSourceArchives)
  for (const p of json(a.ledger).files) verify(p, `${a.frozenInputs}/${p.file}`);
const source = json(ledger.sourceArchive);
assert.equal(source.schema, 123);
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
for (const archive of ledger.preservedArchives)
  for (const p of json(archive).files) verify(p, p.archived ?? p.file);
const c = ledger.checks;
assert.equal(readFileSync(c.typecheck, 'utf8'), '');
assert.equal(readFileSync(c.e2eTypecheck, 'utf8'), '');
const tests = readFileSync(c.standard, 'utf8');
assert(tests.includes('1607 passed (1607)') && tests.includes('278 passed (278)'));
const qa = readFileSync(c.nodeQa, 'utf8');
assert(qa.includes('pass 3') && qa.includes('fail 0'));
assert(readFileSync(c.chrome, 'utf8').includes('16 passed'));
assert(readFileSync(c.focused, 'utf8').includes('111 passed (111)'));
const adversarial = readFileSync(c.adversarial, 'utf8');
assert(adversarial.includes('5 failed | 9 passed (14)'));
for (const phase of ['death', 'match-end', 'recast', 'caster-detachment', 'target-detachment'])
  assert(adversarial.includes(`saved Q rejects contradictory ${phase} phases`));
const raw = json(c.source);
assert.equal(raw.result, 'passed');
assert.equal(raw.systems, 2);
assert.equal(raw.emitters, 15);
assert.equal(raw.textures, 17);
assert.equal(raw.nativeRenderingVerified, false);
const exported = json(c.export);
assert.equal(exported.result, 'passed');
assert.equal(exported.emitters, 15);
assert.equal(exported.enabled, 13);
assert.equal(exported.disabled, 2);
const cast = json(c.cast),
  contact = json(c.contact);
assert.deepEqual(cast.errors, []);
assert.deepEqual(contact.errors, []);
assert.deepEqual([...new Set(cast.armed.map((m) => m.profile))], [0, 1, 2, 3, 4, 5]);
assert.deepEqual(
  [...new Set(contact.hit.filter((m) => m.profile >= 6).map((m) => m.profile))],
  [8, 9, 10, 11, 12, 13, 14]
);
assert.deepEqual(
  cast.castPixels.profiles.map((p) => p.profile),
  [0, 1, 2, 3, 4, 5]
);
assert.deepEqual(
  contact.hitPixels.profiles.filter((p) => p.profile >= 6).map((p) => p.profile),
  [8, 9, 10, 11, 12, 13, 14]
);
for (const pixels of [cast.castPixels, contact.hitPixels]) {
  assert.equal(pixels.error, 0);
  assert(pixels.profiles.every((p) => p.changed > 0));
}
const recovery = json(c.recovery);
assert.deepEqual(recovery.errors, []);
assert.deepEqual(recovery.original, recovery.recovered);
assert.equal(recovery.original.error, 0);
const terminal = recovery.terminal;
assert.notEqual(terminal.detached.caster, null);
assert.notEqual(terminal.detached.target, null);
assert.equal(terminal.winner, 'blue');
assert(terminal.active > 0);
assert.equal(terminal.remaining, 0);
assert.equal(terminal.materials, terminal.active);
assert(terminal.owned > 0);
assert.equal(terminal.shared, 0);
assert.equal(terminal.textures, 0);
assert.equal(terminal.sameSave, true);
assert.equal(terminal.restores, true);
const visibility = json(c.visibility);
assert.deepEqual(visibility.firstAudience, []);
assert.equal(visibility.hidden, 0);
assert.deepEqual(visibility.later, [1, 2, 3]);
assert.deepEqual(json(c.saved).errors, []);
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
for (const p of comparison.matches) {
  const before = json(p.older),
    after = json(p.newer);
  assert.equal(before.version, 122);
  assert.equal(after.version, 123);
  assert.equal(after.ruleset, ledger.ruleset);
  for (const o of [before.player, ...before.otherChampions])
    assert(!Object.hasOwn(o, 'leonaQVisuals'));
  for (const o of [after.player, ...after.otherChampions]) {
    assert.deepEqual(o.leonaQVisuals, []);
    delete o.leonaQVisuals;
  }
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
    schema: 123,
    ruleset: ledger.ruleset,
    unitTests: 1607,
    chromeCases: 16,
    normalSmokeTicks: 72000,
    archivedInputs: source.files.length,
    generatedBuildFiles: json(ledger.buildArchive).files.length,
    sourceEmitters: 15,
    enabledSourceEmitters: 13,
    sourceTextures: 17,
    nativeRenderingVerified: false,
    completeLeonaKit: false,
  })
);
