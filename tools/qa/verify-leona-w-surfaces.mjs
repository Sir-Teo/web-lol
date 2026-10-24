/** Read-only retained-evidence checks. Native W/audio/full-match acceptance remains open. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const historical = process.argv.includes('--historical');
const text = (file) => readFileSync(file, 'utf8');
const json = (file) => JSON.parse(text(file));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ledger = json('docs/reference/leona/w-surfaces-verification.json');
function verify(pin, file = pin.file) {
  const bytes = readFileSync(file);
  assert.equal(bytes.length, pin.bytes, file);
  assert.equal(sha256(bytes), pin.sha256, file);
}
for (const archive of [ledger.sourceArchive, ...ledger.earlierSourceArchives]) {
  for (const pin of json(archive).files) {
    verify(pin, pin.archived);
    if (!historical && archive === ledger.sourceArchive) verify(pin);
  }
}
for (const archive of ledger.preservedArchives)
  for (const pin of json(archive).files) verify(pin, pin.archived ?? pin.file);
for (const pin of ledger.reviewInputs) {
  verify(pin, pin.archived);
  if (!historical) verify(pin);
}
for (const pin of ledger.evidence) verify(pin);
if (!historical) for (const pin of json(ledger.buildArchive).files) verify(pin, 'dist/' + pin.file);

const source = json(ledger.sourceArchive);
assert.equal(source.schema, 124);
assert.equal(source.schema, ledger.schema);
assert.equal(source.ruleset, ledger.ruleset);
assert.equal(source.files.length, 1479);
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
const unitSource = json(ledger.unitSourceArchive);
const previous = new Map(unitSource.files.map((pin) => [pin.file, pin.sha256]));
assert.equal(previous.size, source.files.length);
assert.deepEqual(
  source.files.filter((pin) => previous.get(pin.file) !== pin.sha256).map((pin) => pin.file),
  ['e2e/leona-eclipse-surfaces.spec.ts']
);
const c = ledger.checks;
const archived = (file) => {
  const pin = source.files.find((p) => p.file === file);
  assert(pin, file);
  return json(pin.archived);
};
const profile = archived('src/content/leona-w-particles.json');
assert.equal(profile.profiles.length, 30);
assert.equal(profile.disabled.length, 20);
const surfaceIndices = profile.profiles.flatMap((p, i) => (p.kind === 'skin' ? [] : [i]));
assert.equal(surfaceIndices.length, 26);
const shaders = archived('docs/reference/leona-w-surface-shaders.json');
assert.equal(shaders.tables.length, 4);
assert.equal(shaders.extraction.files.length, 11);
assert.equal(shaders.selections.length, 22);
assert.equal(json(ledger.nativeArchive).files.length, 77);
assert.equal(
  sha256(readFileSync(source.files.find((p) => p.file === shaders.tocReader).archived)),
  shaders.tocReaderSha256
);
assert.deepEqual(json(c.shaders), { result: 'passed', programs: 22, nativeExecuted: false });
assert.match(text(c.unit), /1666 passed \(1666\)/);
assert.match(text(c.unit), /285 passed \(285\)/);
assert.equal(text(c.typecheck), '');
assert.match(text(c.nodeQa), /pass 3/);
assert.match(text(c.nodeQa), /fail 0/);
assert.match(text(c.browser), /22 passed/);
assert.match(text(c.extraBrowser), /1 passed/);
assert.match(text(c.build), /built in/);
assert.equal(json(ledger.buildArchive).files.length, 32);

const families = json(c.families),
  seen = new Map(),
  colored = new Set([14, 18, 20, 24, 25, 26]);
assert.deepEqual(families.errors, []);
for (const stage of families.stages) {
  assert.equal(stage.error, 0);
  for (const p of stage.profiles) {
    seen.set(p.profile, Math.max(seen.get(p.profile) ?? 0, p.changed));
    assert.equal(p.vertexBgra, colored.has(p.profile), 'vertex BGRA route ' + p.profile);
  }
}
assert.deepEqual(
  [...seen.keys()].sort((a, b) => a - b),
  surfaceIndices
);
assert([...seen.values()].every((pixels) => pixels > 0));
const arithmetic = json(c.arithmetic);
assert.equal(arithmetic.error, 0);
assert.equal(arithmetic.reports.length, 39);
for (const r of arithmetic.reports) {
  assert.equal(r.actual.length, 4);
  assert.equal(r.expected.length, 4);
  const delta = Math.max(...r.actual.map((value, i) => Math.abs(value - r.expected[i])));
  assert.equal(delta, r.error, r.name);
  assert(delta <= 1, r.name);
}
const recovery = json(c.recovery);
assert.deepEqual(recovery.errors, []);
const comparable = ({ worldOrder: _diagnostic, ...rest }) => rest;
assert.equal(recovery.before.error, 0);
assert(recovery.before.models.length > 0);
assert.deepEqual(comparable(recovery.restored), comparable(recovery.before));
assert.deepEqual(comparable(recovery.recovered), comparable(recovery.before));
const visibility = json(c.visibility);
assert.deepEqual(visibility.first, []);
assert.deepEqual(visibility.armed, [3]);
assert.deepEqual(visibility.creation, []);
assert.deepEqual(visibility.contact, []);
assert(visibility.burst.length > 0);
assert(visibility.burst.every((p) => p.profile === 8 && p.role === 'buff-extended'));
assert.equal(visibility.restores, true);
const terminal = json(c.terminal);
assert.deepEqual(terminal.errors, []);
const t = terminal.result;
assert.deepEqual(t.roles, ['buff-initial', 'cast-hit', 'target']);
assert.equal(t.winner, 'blue');
assert.equal(t.remaining, 0);
assert(t.detached.source > 0 && t.detached.target > 0);
assert(t.materials.length > 0 && t.materials.every((n) => n === 1));
assert(t.owned.length > 0 && t.owned.every((n) => n === 1));
assert.equal(t.sharedDisposed, 0);
for (const key of ['depthRetired', 'distortionRetired', 'sameSave', 'restores'])
  assert.equal(t[key], true, key);
const storage = json(c.storage);
assert.deepEqual(storage.errors, []);
const s = storage.result;
assert.equal(s.recast.records.length, 2);
assert.equal(s.recast.records[0].reason, 'recast');
assert.equal(s.recast.records[0].detonation, null);
assert.deepEqual(
  s.recast.renderedStarts,
  s.recast.records.map((p) => p.start)
);
assert.equal(s.recast.renderedStarts[0], s.firstStart);
assert.equal(s.restores, true);
assert.equal(s.error, 0);
assert.equal(s.rounds.length, 6);
for (const [i, r] of s.rounds.entries()) {
  assert.equal(r.outcome, i % 2 ? 'miss' : 'hit');
  assert(r.armed > 0);
  assert(r.roles.includes('cast-' + r.outcome));
  if (r.outcome === 'hit') assert(r.roles.includes('target'));
  assert.equal(r.remaining, 0);
  assert.equal(r.skins, 0);
  assert.equal(r.depth, false);
  assert.equal(r.distortion, false);
  assert.deepEqual(r.memory, { geometries: 25, textures: 46 });
}

const normal = json(c.normalVerification),
  comparison = json(c.normalComparison);
assert.equal(normal.result, 'passed');
assert.equal(normal.ruleset, ledger.ruleset);
assert.equal(normal.checkedTicks, 72000);
assert.equal(normal.roundTrips, 20);
assert.equal(normal.futureChecks, 18);
assert.equal(normal.unfinished, 2);
assert.equal(normal.hundredSeedInvariantGate, false);
assert.equal(comparison.result, 'passed');
assert.deepEqual(comparison.normalization, ['ruleset']);
assert.equal(comparison.matches.length, 20);
for (const m of comparison.matches) {
  for (const side of ['older', 'newer'])
    assert.equal(sha256(readFileSync(m[side])), m[side + 'Sha256']);
  const older = json(m.older),
    newer = json(m.newer);
  assert.equal(older.version, 124);
  assert.equal(newer.version, 124);
  newer.ruleset = older.ruleset;
  assert.deepEqual(newer, older);
}
const production = json(c.production),
  offline = json(c.offline),
  manifest = json(c.manifest);
assert.equal(production.result, 'passed');
assert.equal(production.recordings, 32);
assert.equal(production.unrequestedLeonaPreloads, 0);
assert.equal(production.developmentHook, false);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.deepEqual(offline.manifest, {
  id: manifest.id,
  files: manifest.files.length,
  bytes: manifest.bytes,
});
assert.equal(manifest.id, 'ca6f4494cc59dd0b33e2659e4f5c37ca4030c6317357ab2a48cdf387b9175b1b');
assert.equal(manifest.files.length, 882);
assert.equal(manifest.bytes, 499237703);
assert.equal(offline.checks.serviceWorkerResponses, 963);
for (const [key, value] of Object.entries(offline.checks))
  if (key !== 'serviceWorkerResponses') assert.equal(value, true, key);
assert.match(text(c.failedTypes), /TS2345/);
assert.match(text(c.interruptedStartup), /1 interrupted/);
assert.equal(json(c.startupTriage).observedHeadContentType, 'text/html');
assert.match(text(c.failedShadowSampler), /Mismatch between texture format and sampler type/);
const failedCanvas = json(c.failedCanvas);
assert.notDeepEqual(failedCanvas.before.canvasHashes, failedCanvas.restored.canvasHashes);
assert.match(text(c.failedVertexRoute), /'vertexBgra' does not exist/);
assert(Object.values(ledger.acceptance).every((value) => value === false));
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    schema: ledger.schema,
    ruleset: ledger.ruleset,
    archivedInputs: source.files.length,
    nativeFiles: 77,
    renderedFamilies: 30,
    surfaceFamilies: seen.size,
    gpuProbes: arithmetic.reports.length,
    unitTests: 1666,
    browserCases: 23,
    exactReloadAndRecovery: true,
    fullCycles: s.rounds.length,
    checkedNormalTicks: normal.checkedTicks,
    productionRecordings: 32,
    offlineFiles: manifest.files.length,
    ...ledger.acceptance,
  })
);
