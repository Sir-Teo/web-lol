/** Frozen Leona-player-fixture acceptance; offline/read-only, no browser or game launch. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const historical = process.argv.includes('--historical');
const json = (p) => JSON.parse(readFileSync(p));
const digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const ledger = json('docs/reference/leona/player-fixture-verification.json');
assert.equal(digest(ledger.sourceArchive), ledger.sourceArchiveSha256);
const sources = json(ledger.sourceArchive).files,
  rows = [...sources, ...ledger.generated, ...ledger.evidence];
const byFile = new Map();
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
assert.equal(ledger.schema, 126);
assert.equal(ledger.ruleset, 'ceccf829647a6c36aeb10c0e955e7650276965f45787eb4f48cad34487e6d782');
assert(byFile.has('src/content/leona-bot-policy.ts'));
assert.match(
  text('src/simulation/world.ts'),
  /import \{ LEONA_BOT_POLICY \} from '\.\.\/content\/leona-bot-policy'/
);
assert.match(text(ledger.checks.standard), /1949 passed \(1949\)/);
assert.match(text(ledger.checks.standard), /316 passed \(316\)/);
assert.match(text(ledger.checks.standard), /pass 3/);
assert.equal(text(ledger.checks.typecheck), '');
assert.match(text(ledger.checks.browser), /23 passed/);
const hud = data(ledger.checks.hud),
  combat = data(ledger.checks.combat),
  restore = data(ledger.checks.restore);
for (const row of [hud, combat, restore]) assert.deepEqual(row.errors, []);
assert.equal(hud.result.champion, 'leona');
assert.deepEqual(hud.result.ranks, { q: 1, w: 1, e: 0, r: 0 });
assert.equal(hud.result.aim, null);
assert(hud.result.q && hud.result.w);
assert(hud.manaBefore - hud.result.mana > 88 && hud.manaBefore - hud.result.mana <= 90);
assert.equal(hud.result.gl, 0);
assert(Math.abs(combat.e.distance - 70) < 1e-4);
assert(combat.e.cooldown > combat.e.tick);
assert.equal(combat.e.visual, 'arrived');
assert.equal(combat.guide.inner, true);
assert.equal(combat.guide.count, 33);
assert(Math.abs(combat.guide.radius - 1.2) < 1e-6);
assert(combat.result.maxHp - combat.result.hp > 190);
assert.equal(combat.result.sunlight.sourceId, combat.result.caster);
assert.equal(combat.result.r.impact.contacts[0].center, true);
assert.equal(combat.result.gl, 0);
assert.equal(restore.prepared.w, true);
assert.equal(restore.prepared.r, true);
assert.equal(restore.prepared.saved, restore.restored.saved);
assert.equal(restore.prepared.future, restore.restored.future);
assert.equal(restore.restored.champion, 'leona');
assert.equal(restore.restored.gl, 0);
assert.deepEqual(restore.reset, { q: 0, w: 0, e: 0, r: 0 });
const snapshot = JSON.parse(restore.prepared.saved);
assert.equal(snapshot.version, 126);
assert.equal(snapshot.ruleset, ledger.ruleset);
assert.equal(snapshot.units.find((u) => u.id === snapshot.player.id).champion, 'leona');
assert.match(text(ledger.checks.focused), /9 passed/);
assert.match(text(ledger.checks.existingFocused), /46 passed/);
assert.match(text(ledger.checks.initialBrowserFailure), /3 failed/);
assert.match(text(ledger.checks.initialTypecheckFailure), /TS2345/);
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
  .findLast((row) => row?.result === 'passed');
assert.equal(production.recordings, 32);
assert.equal(production.developmentHook, false);
assert.equal(production.garenFixtureInProduction, false);
assert.equal(production.leonaPlayerFixtureInProduction, false);
assert.equal(production.unrequestedLeonaPreloads, 0);
const offline = data(ledger.checks.offline),
  manifest = data('dist/offline-pack.json');
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.equal(offline.manifest.id, ledger.pack);
assert.equal(manifest.id, ledger.pack);
assert.equal(manifest.files.length, 1017);
assert.equal(manifest.bytes, ledger.packBytes);
assert.equal(offline.checks.serviceWorkerResponses, 963);
assert(
  Object.values(offline.checks)
    .filter((v) => typeof v === 'boolean')
    .every(Boolean)
);
for (const entry of manifest.files) {
  const row = byFile.get('dist/' + entry.path);
  assert(row, entry.path);
  assert.equal(row.bytes, entry.bytes, entry.path);
  assert.equal(row.sha256, entry.sha256, entry.path);
}
const assets = data(ledger.checks.assets);
assert.equal(assets.publicFiles, 971);
assert.equal(assets.unchanged, 965);
assert.equal(assets.existingManifestRecordsPreserved, 94);
assert.deepEqual(assets.removed, []);
assert.deepEqual(assets.modified, ['public/assets/reference-manifest.json']);
assert.deepEqual(
  assets.added,
  [
    'LeonaShieldOfDaybreak',
    'LeonaSolarBarrier',
    'LeonaSolarFlare',
    'LeonaZenithBlade',
    'leona',
  ].map((n) => 'public/assets/icons/' + n + '.png')
);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    units: 1949,
    browserCases: 23,
    productionRecordings: 32,
    publicFilesUnchanged: 965,
    publicIconsAdded: 5,
    schema: 126,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
  })
);
