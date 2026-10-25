/** Frozen development-bot acceptance; offline/read-only, no browser or game launch. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const historical = process.argv.includes('--historical');
const json = (p) => JSON.parse(readFileSync(p));
const digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const ledger = json('docs/reference/leona/bot-setup-verification.json');
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
assert.equal(ledger.ruleset, '9aa1414a6ced806885273939c6de36fee034484022aac4a5c843fdb25f45ae50');
assert(byFile.has('src/content/leona-bot-policy.ts'));
assert.match(
  text('src/simulation/world.ts'),
  /import \{ LEONA_BOT_POLICY \} from '\.\.\/content\/leona-bot-policy'/
);
assert.match(text(ledger.checks.standard), /1892 passed \(1892\)/);
assert.match(text(ledger.checks.standard), /311 passed \(311\)/);
assert.match(text(ledger.checks.standard), /pass 3/);
assert.equal(text(ledger.checks.typecheck), '');
assert.match(text(ledger.checks.browser), /3 passed/);
assert.match(text(ledger.checks.browserFinal), /1 passed/);
const browser = data(ledger.checks.browserEvidence),
  p = browser.prepared,
  r = browser.restored;
assert.deepEqual(browser.errors, []);
assert.equal(p.identicalFuture, true);
assert.equal(p.glError, 0);
assert.deepEqual(p.ranks, { q: 1, w: 3, e: 1, r: 1 });
assert.deepEqual([...p.inventory].sort(), ['belt', 'boots', 'cloak', 'vest']);
assert.equal(r.saved, p.snapshot);
assert.equal(r.hero, 'ashe');
assert.equal(r.role, 'support');
assert.equal(r.ai, true);
assert.equal(r.rig, 'leona-base');
assert.deepEqual(r.ranks, p.ranks);
assert.deepEqual(r.inventory, p.inventory);
const snapshot = JSON.parse(p.snapshot);
assert.equal(snapshot.version, 126);
assert.equal(snapshot.ruleset, ledger.ruleset);
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
assert.equal(manifest.bytes, 513309570);
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
    units: 1892,
    browserCases: 3,
    productionRecordings: 32,
    publicFilesUnchanged: 966,
    schema: 126,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
  })
);
