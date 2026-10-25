/** Verify the frozen Ahri NPC checkpoint; --historical checks its retained bytes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const option = process.argv.indexOf('--ledger');
const ledger = JSON.parse(
  readFileSync(
    option < 0 ? 'docs/reference/ahri/development-verification.json' : process.argv[option + 1]
  )
);
const digest = (value) => createHash('sha256').update(value).digest('hex');
assert.equal(digest(readFileSync(ledger.sourceArchive)), ledger.sourceArchiveSha256);
const sources = JSON.parse(readFileSync(ledger.sourceArchive)).files;
const rows = [...sources, ...ledger.generated, ...ledger.evidence];
const byFile = new Map();
for (const row of rows) {
  assert(!byFile.has(row.file), row.file);
  const bytes = readFileSync(row.archived);
  assert.equal(bytes.length, row.bytes, row.file);
  assert.equal(digest(bytes), row.sha256, row.file);
  if (!historical && (sources.includes(row) || ledger.generated.includes(row)))
    assert.equal(digest(readFileSync(row.file)), row.sha256, row.file);
  byFile.set(row.file, row);
}
const bytes = (file) => {
  assert(byFile.has(file), file);
  return readFileSync(byFile.get(file).archived);
};
const text = (file) => bytes(file).toString();
const data = (file) => JSON.parse(text(file));
assert.equal(ledger.schema, 131);
assert.equal(ledger.ruleset, '0f35a470a96ce5847f607f84e344d616526b412aa3f29248595b6a962f848554');
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
assert.match(text('src/simulation/snapshot.ts'), /SNAPSHOT_VERSION = 131;/);
const pack = data('dist/offline-pack.json');
assert.equal(pack.id, ledger.pack);
assert.equal(
  pack.id,
  digest(JSON.stringify({ workerPolicySha256: pack.workerPolicySha256, files: pack.files }))
);
assert.equal(pack.files.length, ledger.packFiles);
assert.equal(pack.bytes, ledger.packBytes);
assert.equal(
  pack.files.reduce((sum, row) => sum + row.bytes, 0),
  pack.bytes
);
for (const file of pack.files) {
  assert.equal(bytes(`dist/${file.path}`).length, file.bytes);
  assert.equal(digest(bytes(`dist/${file.path}`)), file.sha256);
}
assert.match(text(ledger.checks.unit), /331 passed \(331\)/);
assert.match(text(ledger.checks.unit), /2071 passed \(2071\)/);
assert.match(text(ledger.checks.unit), /pass 3/);
const original = data(ledger.checks.browserOriginal),
  reload = data(ledger.checks.browserReload),
  repaint = data(ledger.checks.browserRepaint);
for (const [report, passed, failed] of [
  [original, 20, 1],
  [reload, 5, 1],
  [repaint, 3, 0],
]) {
  assert.equal(report.stats.expected, passed);
  assert.equal(report.stats.unexpected, failed);
  assert.equal(report.stats.skipped, 0);
  assert.equal(report.stats.flaky, 0);
}
function specs(report) {
  return (report.suites ?? []).flatMap((suite) => [...(suite.specs ?? []), ...specs(suite)]);
}
const covered = new Set();
for (const report of [original, reload, repaint]) {
  for (const spec of specs(report)) {
    const statuses = spec.tests.flatMap((test) => test.results.map((result) => result.status));
    if (statuses.every((status) => status === 'passed')) covered.add(spec.title);
    else assert.match(spec.title, /stationary cursor follows moving targets/);
  }
}
assert.equal(covered.size, 22);
assert(
  covered.has('saving and reloading the NPC fixture preserves Ahri and an ordinary pending attack')
);
assert.match(text('src/main.ts'), /repaint: requestFrame/);
assert.match(text('e2e/champion-selection.spec.ts'), /g\.repaint\(\)/);
for (const version of [1, 2]) {
  const prefix = `.cache/ahri-development-browser-v${version}-20261025/results/ahri-development-Ahri-NPC--f243e--run-on-the-development-map/`;
  const rig = data(prefix + 'ahri-rig.json');
  assert.equal(rig.hero, 'ashe');
  assert.equal(rig.npc, 'ahri');
  assert.equal(rig.projectileSpeed, 1750);
  assert.equal(rig.exactFuture, true);
  assert.equal(rig.marker, 'Ahri provisional basic attack');
  assert.deepEqual(
    rig.stages.map((stage) => stage.before.clip),
    ['idle_var2', 'run_in', 'attack1', 'attack1', 'crit', 'death']
  );
  for (const stage of rig.stages) {
    assert.equal(stage.samePose, true);
    assert.equal(stage.exactSave, true);
    assert.equal(stage.before.rig, 'ahri-base');
    assert.equal(stage.before.clipCount, 55);
    assert.equal(stage.before.bones.length, 211 * 16);
    const hidden = stage.before.meshes.filter((mesh) => mesh.defaultHidden);
    assert.equal(hidden.length, 1);
    assert.equal(hidden[0].visible, false);
  }
  assert(
    bytes(prefix + 'ahri-death.png')
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  );
}
const production = text(ledger.checks.production)
  .split('\n')
  .flatMap((line) => {
    try {
      const value = JSON.parse(line);
      return value.result === 'passed' ? [value] : [];
    } catch {
      return [];
    }
  });
assert.equal(production.length, 1);
assert.equal(production[0].recordings, 32);
assert.equal(production[0].developmentHook, false);
assert.equal(production[0].ahriNpcFixtureInProduction, false);
assert.equal(production[0].unrequestedAhriPreloads, 0);
const offline = data(ledger.checks.offline);
assert.equal(offline.result, 'passed');
for (const value of Object.values(offline.checks))
  if (typeof value === 'boolean') assert.equal(value, true);
for (const file of [
  'profile.log',
  'profile-optimized.log',
  'character.log',
  'character-optimized.log',
])
  assert.match(text('.cache/ahri-development-work-v1-20261025/' + file), /Verified/);
assert.deepEqual(ledger.acceptance, {
  developmentNpcIntegrated: true,
  ordinaryAttackContinuationVerified: true,
  sourceRigPoseContinuationVerified: true,
  realBrowserSaveReloadVerified: true,
  ordinaryAhriPreloads: 0,
  productionRosterExpanded: false,
  spellKitImplemented: false,
  nativeBehaviorVerified: false,
  nativePresentationVerified: false,
  fullPerformanceGate: false,
  fullProjectComplete: false,
});
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    schema: ledger.schema,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
    sources: sources.length,
    generated: ledger.generated.length,
    evidence: ledger.evidence.length,
    unitTests: 2071,
    distinctBrowserCases: covered.size,
    nativeBehaviorVerified: false,
    fullProjectComplete: false,
  })
);
