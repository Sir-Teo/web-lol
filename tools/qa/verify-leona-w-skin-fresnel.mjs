/** Frozen mapped-skin-rim acceptance; offline/read-only, no browser or game launch. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';

const historical = process.argv.includes('--historical');
const json = (p) => JSON.parse(readFileSync(p));
const digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const ledger = json('docs/reference/leona/w-skin-fresnel-verification.json');
assert.equal(digest(ledger.sourceArchive), ledger.sourceArchiveSha256);
const sources = json(ledger.sourceArchive).files,
  rows = [...sources, ...ledger.generated, ...ledger.native, ...ledger.evidence];
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
assert.equal(ledger.ruleset, '2f2d7dac16d7b3c1d0e7a35d81ed8c9323ab623dc49e2201eec4094390ff15b0');
assert(byFile.has('src/content/leona-bot-policy.ts'));
assert.match(
  text('src/simulation/world.ts'),
  /import \{ LEONA_BOT_POLICY \} from '\.\.\/content\/leona-bot-policy'/
);
assert.match(text(ledger.checks.standard), /1904 passed \(1904\)/);
assert.match(text(ledger.checks.standard), /312 passed \(312\)/);
assert.match(text(ledger.checks.standard), /pass 3/);
assert.equal(text(ledger.checks.typecheck), '');
assert.match(text(ledger.checks.browser), /16 passed/);
for (const key of ['rimRemap', 'erosion', 'texels']) {
  const result = data(ledger.checks[key]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.results.length, { rimRemap: 111, erosion: 20, texels: 108 }[key]);
  for (const sample of result.results)
    sample.actual.forEach((value, i) => assert(Math.abs(value - sample.expected[i]) <= 1));
}
const animation = data(ledger.checks.animation);
assert.deepEqual(animation.errors, []);
assert.equal(animation.recovery.same, true);
assert.equal(animation.recovery.error, 0);
assert.deepEqual(
  animation.results.map((r) => r.max),
  [1, 1, 2]
);
const skins = data(ledger.checks.skins);
assert.deepEqual(skins.errors, []);
assert.equal(skins.initialPixels.error, 0);
assert.equal(skins.extendedPixels.error, 0);
assert.deepEqual(skins.armed.map((r) => r.profileIndex).sort(), [4, 4, 5, 6]);
assert.deepEqual(
  skins.extended.map((r) => r.profileIndex),
  [9, 9]
);
for (const row of [...skins.initialPixels.results, ...skins.extendedPixels.results]) {
  assert(row.changed > 0 && row.rawPowerChanged > 0);
  assert.equal(row.restoredChanged, 0);
  const power = row.profile === 4 || row.profile === 9 ? 0.3449999988079071 : 0.8350000381469727;
  assert(row.powers.every((p) => p === power));
}
const recovery = data(ledger.checks.recovery);
assert.deepEqual(recovery.errors, []);
assert.deepEqual(recovery.original, recovery.recovered);
assert.equal(recovery.terminal.bones, 4);
assert.equal(recovery.terminal.materials, 4);
assert.equal(recovery.terminal.shared, 0);
assert.equal(recovery.terminal.sameSave, true);
assert.equal(recovery.terminal.restores, true);
const snapshot = JSON.parse(recovery.original.snapshot);
assert.equal(snapshot.version, ledger.schema);
assert.equal(snapshot.ruleset, ledger.ruleset);
const rounds = data(ledger.checks.storage);
assert.equal(rounds.length, 6);
assert(rounds.every((r) => r.active === 4 && r.remaining === 0));
assert(rounds.slice(1).every((r) => JSON.stringify(r.memory) === JSON.stringify(rounds[1].memory)));
assert.match(text(ledger.checks.focused), /23 passed/);
assert.match(text(ledger.checks.native), /PASS/);
assert.match(text(ledger.checks.nativeOptimized), /PASS/);
const negatives = data(ledger.checks.negatives);
assert.equal(negatives.length, 6);
assert(negatives.every((r) => r.rejected));
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
    units: 1904,
    browserCases: 16,
    productionRecordings: 32,
    publicFilesUnchanged: 966,
    schema: 126,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
  })
);
