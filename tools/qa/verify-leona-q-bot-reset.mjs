/** Frozen recovery-Daybreak acceptance; offline/read-only, no browser or game launch. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const historical = process.argv.includes('--historical');
const json = (p) => JSON.parse(readFileSync(p));
const digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const ledger = json('docs/reference/leona/q-bot-reset-verification.json');
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
assert.equal(ledger.ruleset, 'de9c47cb340f6217eb666b186270d839b85ca2773966478a8c36909edc2155e7');
assert(byFile.has('src/content/leona-bot-policy.ts'));
assert.match(
  text('src/simulation/world.ts'),
  /import \{ LEONA_BOT_POLICY \} from '\.\.\/content\/leona-bot-policy'/
);
assert.match(text(ledger.checks.standard), /1912 passed \(1912\)/);
assert.match(text(ledger.checks.standard), /313 passed \(313\)/);
assert.match(text(ledger.checks.standard), /pass 3/);
assert.equal(text(ledger.checks.typecheck), '');
assert.match(text(ledger.checks.browser), /6 passed/);
const browser = data(ledger.checks.browserEvidence),
  r = browser.result;
assert.deepEqual(browser.errors, []);
assert.equal(r.hiddenQueued, 0);
assert.equal(r.queued.length, 1);
assert.equal(r.queued[0].type, 'cast');
assert.equal(r.queued[0].ability, 'q');
assert.equal(r.identicalFuture, true);
assert.equal(r.glError, 0);
assert.equal(r.models, 8);
assert.equal(r.changedPixels, 11146);
assert.equal(r.visuals, 1);
assert(r.release < r.originalNext);
assert.equal(r.originalNext - r.release, 48);
assert(r.mana < r.maxMana - 29);
assert(r.hp < r.hpBefore - 40);
assert(r.controlHp - r.hp > 40);
assert(r.stunUntil > r.tick);
assert.equal(r.sunlight.sourceId, r.queued[0].unit);
assert.equal(r.impact, r.target);
const snapshot = JSON.parse(r.snapshot);
assert.equal(snapshot.version, 126);
assert.equal(snapshot.ruleset, ledger.ruleset);
assert(snapshot.commands.some((c) => c.type === 'cast' && c.ability === 'q'));
assert.match(text(ledger.checks.focused), /36 passed/);
assert.match(text(ledger.checks.initialUnitFailure), /unlearned/);
assert.match(text(ledger.checks.initialUnitFailure), /1 failed/);
assert.match(text(ledger.checks.initialBrowserFailure), /1 failed/);
const contact = data(ledger.checks.contact);
assert.deepEqual(contact.errors, []);
assert.equal(contact.growthPixels.length, 3);
for (const profile of [8, 9, 10, 11, 12, 13, 14])
  assert(
    [contact.hitPixels, ...contact.growthPixels].some((sample) =>
      sample.profiles.some((p) => p.profile === profile && p.changed > 0)
    )
  );
assert([contact.hitPixels, ...contact.growthPixels].every((sample) => sample.error === 0));
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
    units: 1912,
    browserCases: 6,
    productionRecordings: 32,
    publicFilesUnchanged: 966,
    schema: 126,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
  })
);
