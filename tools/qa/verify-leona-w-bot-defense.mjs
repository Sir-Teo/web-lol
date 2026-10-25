/** Frozen defensive-Eclipse acceptance; offline/read-only, no browser or game launch. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const historical = process.argv.includes('--historical');
const json = (p) => JSON.parse(readFileSync(p));
const digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const ledger = json('docs/reference/leona/w-bot-defense-verification.json');
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
assert.equal(ledger.ruleset, '2e3fa5b7448b670769c35a31c97071db899644f67e678246829503e5d0175fb6');
assert(byFile.has('src/content/leona-bot-policy.ts'));
assert.match(
  text('src/simulation/world.ts'),
  /import \{ LEONA_BOT_POLICY \} from '\.\.\/content\/leona-bot-policy'/
);
assert.match(text(ledger.checks.standard), /1903 passed \(1903\)/);
assert.match(text(ledger.checks.standard), /312 passed \(312\)/);
assert.match(text(ledger.checks.standard), /pass 3/);
assert.equal(text(ledger.checks.typecheck), '');
assert.match(text(ledger.checks.browser), /9 passed/);
const browser = data(ledger.checks.browserEvidence),
  r = browser.result;
assert.deepEqual(browser.errors, []);
assert.equal(r.hiddenQueued, 0);
assert.equal(r.queued.length, 1);
assert.equal(r.queued[0].type, 'cast');
assert.equal(r.queued[0].ability, 'w');
assert.equal(r.identicalFuture, true);
assert.equal(r.glError, 0);
assert.equal(r.surfaces, 30);
assert.equal(r.changedPixels, 38632);
assert.equal(r.visuals, 1);
assert.equal(r.active.rank, 3);
assert(r.mana < r.maxMana - 50);
assert(r.hp < r.maxHp);
const snapshot = JSON.parse(r.snapshot);
assert.equal(snapshot.version, 126);
assert.equal(snapshot.ruleset, ledger.ruleset);
assert(snapshot.commands.some((c) => c.type === 'cast' && c.ability === 'w'));
assert.match(text(ledger.checks.focused), /37 passed/);
assert.match(text(ledger.checks.originalRangeFailure), /2 failed/);
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
assert.equal(manifest.bytes, 513310008);
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
    units: 1903,
    browserCases: 9,
    productionRecordings: 32,
    publicFilesUnchanged: 966,
    schema: 126,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
  })
);
