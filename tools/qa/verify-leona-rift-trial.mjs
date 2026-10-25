/** Frozen development Leona Rift support acceptance; offline/read-only. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (p) => JSON.parse(readFileSync(p)),
  digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const ledger = json('docs/reference/leona/rift-trial-verification.json');
assert.equal(digest(ledger.sourceArchive), ledger.sourceArchiveSha256);
const sources = json(ledger.sourceArchive).files,
  rows = [...sources, ...ledger.generated, ...ledger.evidence],
  byFile = new Map();
for (const row of rows) {
  assert(!byFile.has(row.file), row.file);
  assert.equal(readFileSync(row.archived).length, row.bytes, row.archived);
  assert.equal(digest(row.archived), row.sha256, row.archived);
  if (!historical && (sources.includes(row) || ledger.generated.includes(row)))
    assert.equal(digest(row.file), row.sha256, row.file);
  byFile.set(row.file, row);
}
const frozen = (p) => {
  assert(byFile.has(p), p);
  return byFile.get(p).archived;
};
const data = (p) => json(frozen(p)),
  text = (p) => readFileSync(frozen(p), 'utf8');
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
assert.equal(ledger.schema, 129);
assert.match(text(ledger.checks.standard), /2034 passed \(2034\)/);
assert.match(text(ledger.checks.standard), /328 passed \(328\)/);
assert.match(text(ledger.checks.standard), /pass 3/);
assert.equal(text(ledger.checks.typecheck), '');
assert.match(text(ledger.checks.regression), /2 failed/);
assert.match(text(ledger.checks.previousAccepted), /"result":"passed"/);
assert.match(text(ledger.checks.previousAccepted), /"historical":true/);
const browser = data(ledger.checks.browser);
assert.deepEqual(browser.errors, []);
assert.equal(browser.stats.expected, 88);
for (const k of ['unexpected', 'skipped', 'flaky']) assert.equal(browser.stats[k], 0);
const artifact = (name) => {
  const found = rows.filter(
    (r) =>
      r.file.startsWith('.cache/leona-rift-trial-v1-20261025/browser-final/leona-rift-trial-') &&
      r.file.endsWith('/' + name)
  );
  assert.equal(found.length, 1, name);
  return data(found[0].file);
};
const support = artifact('rift-support.json');
assert.deepEqual(support.errors, []);
assert.equal(support.initial.battlefield, 'rift');
assert.equal(support.initial.mode, 'lanes');
assert.equal(support.initial.champion, 'leona');
assert.equal(support.initial.role, 'support');
assert.equal(support.initial.ai, false);
assert.equal(support.initial.lane, null);
assert.deepEqual(support.initial.ranks, { q: 0, w: 0, e: 0, r: 0 });
assert.equal(support.initial.points, 1);
assert.equal(support.initial.turrets, 22);
assert.equal(support.initial.dummy, false);
assert.equal(support.initial.champions.length, 10);
assert.equal(support.initial.champions.filter((u) => u.ai).length, 9);
for (const team of ['blue', 'red'])
  assert.deepEqual(
    support.initial.champions
      .filter((u) => u.team === team)
      .map((u) => u.role)
      .sort(),
    ['carry', 'jungle', 'mid', 'support', 'top']
  );
assert.equal(new Set(support.maps.map((u) => new URL(u).pathname.split('/').at(-1))).size, 3);
assert(support.paid.cooldown > support.paid.tick);
assert(support.movement.walkable);
assert(support.movement.distance > 1000);
const snap = JSON.parse(support.movement.snapshot);
assert.equal(snap.version, 129);
assert.equal(snap.ruleset, ledger.ruleset);
assert.equal(snap.battlefield, 'rift');
assert.equal(support.movement.snapshot.includes('developmentLeona'), false);
const saved = artifact('saved-support.json');
assert.deepEqual(saved.errors, []);
assert.equal(saved.prepared.snapshot, saved.restored.snapshot);
assert.equal(saved.prepared.future, saved.restored.future);
assert.equal(saved.restored.champion, 'leona');
assert.equal(saved.restored.role, 'support');
assert.equal(saved.stored.trial, saved.prepared.snapshot);
assert.equal(saved.stored.ordinary, saved.restarted.ordinary);
assert.equal(saved.restarted.tick, 0);
assert.equal(saved.restarted.mode, 'lanes');
assert.equal(saved.restarted.champion, 'leona');
assert.equal(saved.restarted.role, 'support');
assert.equal(saved.restarted.champions, 10);
assert.deepEqual(saved.restarted.ranks, { q: 0, w: 0, e: 0, r: 0 });
assert.equal(
  JSON.parse(saved.stored.ordinary).units.find(
    (u) => u.id === JSON.parse(saved.stored.ordinary).player.id
  ).champion,
  'ashe'
);
const chosen = artifact('chooser.json');
assert.deepEqual(chosen.errors, []);
assert.deepEqual(chosen.selected, { champion: 'lux', role: 'mid', mode: 'lanes', tick: 0 });
const gate = artifact('ordinary-gate.json');
assert.deepEqual(gate.errors, []);
assert.equal(gate.ordinary.champion, 'ashe');
assert.equal(gate.ordinary.mode, 'practice');
assert.equal(gate.ordinary.permission, false);
assert.equal(gate.ordinary.leonas, 0);
const rejected = JSON.parse(gate.ordinary.stored);
assert.equal(rejected.units.find((u) => u.id === rejected.player.id).champion, 'leona');
assert.match(
  text('src/main.ts'),
  /leonaRiftTrial = import.meta.env.DEV && query.get\('scene'\) === 'leona-rift'/
);
const production = text(ledger.checks.production)
  .trim()
  .split('\n')
  .map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })
  .findLast((r) => r?.result === 'passed');
assert.equal(production.recordings, 32);
assert.equal(production.developmentHook, false);
assert.equal(production.leonaPlayerFixtureInProduction, false);
assert.equal(production.leonaRiftTrialInProduction, false);
assert.equal(production.unrequestedLeonaPreloads, 0);
const offline = data(ledger.checks.offline),
  manifest = data('dist/offline-pack.json');
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.equal(offline.manifest.id, ledger.pack);
assert.equal(manifest.id, ledger.pack);
assert.equal(manifest.bytes, ledger.packBytes);
assert.equal(manifest.files.length, 1060);
assert(offline.checks.serviceWorkerResponses > 0);
assert(
  Object.values(offline.checks)
    .filter((v) => typeof v === 'boolean')
    .every(Boolean)
);
assert.equal(
  createHash('sha256')
    .update(
      JSON.stringify({ workerPolicySha256: manifest.workerPolicySha256, files: manifest.files })
    )
    .digest('hex'),
  manifest.id
);
for (const entry of manifest.files) {
  const row = byFile.get('dist/' + entry.path);
  assert(row, entry.path);
  assert.equal(row.bytes, entry.bytes);
  assert.equal(row.sha256, entry.sha256);
}
const assets = data(ledger.checks.assets);
assert.equal(assets.publicFiles, 1010);
assert.equal(assets.unchanged, 1010);
for (const k of ['added', 'modified', 'removed']) assert.deepEqual(assets[k], []);
assert(ledger.acceptance.developmentRiftSupportIntegrated && ledger.acceptance.isolatedBrowserSave);
for (const k of [
  'productionLeonaReleased',
  'normalMatchCohortAccepted',
  'nativeComparisonVerified',
  'fullProjectComplete',
])
  assert.equal(ledger.acceptance[k], false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    units: 2034,
    browserCases: 88,
    publicFilesUnchanged: 1010,
    schema: 129,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
  })
);
