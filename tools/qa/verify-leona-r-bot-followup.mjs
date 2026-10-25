/** Frozen Solar-Flare-follow-up acceptance; offline/read-only, no browser or game launch. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const historical = process.argv.includes('--historical');
const json = (p) => JSON.parse(readFileSync(p));
const digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const ledger = json('docs/reference/leona/r-bot-followup-verification.json');
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
assert.equal(ledger.ruleset, '61c5e51ac925b80aa33dec49e1c2d4834a10c241b8fb226c31e88f44443e5254');
assert(byFile.has('src/content/leona-bot-policy.ts'));
assert.match(
  text('src/simulation/world.ts'),
  /import \{ LEONA_BOT_POLICY \} from '\.\.\/content\/leona-bot-policy'/
);
assert.match(text(ledger.checks.standard), /1940 passed \(1940\)/);
assert.match(text(ledger.checks.standard), /315 passed \(315\)/);
assert.match(text(ledger.checks.standard), /pass 3/);
assert.equal(text(ledger.checks.typecheck), '');
assert.match(text(ledger.checks.browser), /20 passed/);
const browser = data(ledger.checks.browserEvidence),
  r = browser.result;
assert.deepEqual(browser.errors, []);
assert.equal(r.hiddenQueued, 0);
assert.equal(r.queued.length, 1);
assert.equal(r.queued[0].type, 'cast');
assert.equal(r.queued[0].ability, 'r');
assert.deepEqual(r.queued[0].point, { x: 600, y: 0 });
assert.deepEqual(r.launchPosition, { x: 0, y: 0 });
assert.deepEqual(r.origin, r.launchPosition);
assert.equal(r.identicalFuture, true);
assert.equal(r.glError, 0);
assert(r.manaBefore - r.paidMana > 99 && r.manaBefore - r.paidMana <= 100);
assert.equal(r.targets.length, 2);
for (let i = 0; i < 2; i++) {
  assert(r.controlHp[i] - r.hp[i] > 149 && r.controlHp[i] - r.hp[i] <= 150);
  assert.equal(r.sunlight[i].sourceId, r.queued[0].unit);
}
assert(r.centerStun > r.tick);
assert.equal(r.outerStun, 0);
assert(
  r.outerSlows.some(
    (s) =>
      s.kind === 'solar-flare' && s.endTick > r.tick && Math.abs(s.startMultiplier - 0.2) < 1e-9
  )
);
assert.deepEqual(
  r.contacts,
  r.targets.map((targetId, i) => ({ targetId, center: i === 0 }))
);
assert.deepEqual(
  r.phases.map((p) => p.step),
  [9, 21, 40, 47]
);
assert(r.phases.every((p) => p.models > 0 && p.changedPixels > 10));
const snapshot = JSON.parse(r.snapshot);
assert.equal(snapshot.version, 126);
assert.equal(snapshot.ruleset, ledger.ruleset);
assert(snapshot.commands.some((c) => c.type === 'cast' && c.ability === 'r'));
assert.match(text(ledger.checks.focused), /68 passed/);
assert.match(text(ledger.checks.initialUnitFailure), /3 failed/);
assert.match(text(ledger.checks.deadTargetFailure), /1 failed/);
assert.match(text(ledger.checks.deadTargetFailure), /dead champion/);
assert.match(text('src/simulation/world.ts'), /private planLeonaR/);
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
assert.equal(production.unrequestedLeonaPreloads, 0);
const offline = data(ledger.checks.offline),
  manifest = data('dist/offline-pack.json');
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.equal(offline.manifest.id, ledger.pack);
assert.equal(manifest.id, ledger.pack);
assert.equal(manifest.files.length, 1012);
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
assert.equal(assets.publicFiles, 966);
assert.equal(assets.unchanged, true);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    units: 1940,
    browserCases: 20,
    productionRecordings: 32,
    publicFilesUnchanged: 966,
    schema: 126,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
  })
);
