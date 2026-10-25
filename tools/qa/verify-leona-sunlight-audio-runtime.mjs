/** Frozen Leona Sunlight playback acceptance; offline/read-only. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (p) => JSON.parse(readFileSync(p));
const digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const ledger = json('docs/reference/leona/sunlight-audio-runtime-verification.json');
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
assert.equal(ledger.schema, 128);
assert.match(text(ledger.checks.standard), /2006 passed \(2006\)/);
assert.match(text(ledger.checks.standard), /324 passed \(324\)/);
assert.match(text(ledger.checks.standard), /pass 3/);
assert.equal(text(ledger.checks.typecheck), '');
const browser = data(ledger.checks.browser);
assert.deepEqual(browser.errors, []);
assert.equal(browser.stats.expected, 65);
assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.skipped, 0);
assert.equal(browser.stats.flaky, 0);
assert.match(text(ledger.checks.sourceAccepted), /"result":"passed"/);
assert.match(text(ledger.checks.sourceAccepted), /"historical":true/);
const saved = Object.entries(ledger.checks.savedSources);
assert.equal(saved.length, 2);
for (const [mode, p] of saved) {
  const r = data(p),
    s = r.prepared,
    c = r.restored;
  assert.equal(r.lethal, mode === 'lethal');
  assert.deepEqual(r.errors, []);
  assert.equal(s.snapshot, c.snapshot);
  assert.equal(s.future, c.future);
  assert.equal(JSON.parse(s.snapshot).ruleset, ledger.ruleset);
  assert.equal(s.initial.length, 1);
  assert.equal(s.initial[0].offset, 0);
  assert.equal(s.initial[0].rate, 1);
  assert.equal(s.initial[0].loop, false);
  assert(Math.abs(s.initial[0].gain - 0.2 * 10 ** (-12 / 20)) < 1e-6);
  assert.equal(s.calls.length, 1);
  assert(Math.abs(s.calls[0].offset - 7 / 60) < 1e-10);
  assert.equal(s.synth, 0);
  assert.equal(c.synth, 0);
  assert.equal(s.calls[0].key, `${s.record.id}:${s.record.startTick}:hit`);
  assert.equal(s.record.detachedTick === null, mode !== 'lethal');
  const compare = (rows) => rows.map(({ stops, ...r }) => r);
  assert.deepEqual(compare(s.calls), compare(c.calls));
}
const artifact = (name) => {
  const found = rows.filter(
    (r) =>
      r.file.startsWith(
        '.cache/leona-sunlight-audio-runtime-v1-20261025/browser-final/leona-sunlight-audio-'
      ) && r.file.endsWith('/' + name)
  );
  assert.equal(found.length, 1, name);
  return data(found[0].file);
};
const visible = artifact('visibility.json');
assert.equal(visible.hidden, 0);
assert.deepEqual(visible.calls, []);
assert(visible.visible);
assert(!visible.audience.includes('blue'));
const finite = artifact('finite.json');
assert.equal(finite.calls.length, 1);
assert.equal(finite.remaining, 0);
assert.equal(finite.finished, 1);
assert(finite.sameSave);
const terminal = artifact('terminal.json');
assert.equal(terminal.before, 1);
assert.equal(terminal.remaining, 0);
assert(terminal.sameSave && terminal.sameTick);
assert.equal(terminal.winner, 'blue');
const caps = artifact('caps.json');
assert.equal(caps.calls.length, 10);
assert.deepEqual(caps.voices, [`9:${caps.start}:hit`, `10:${caps.start}:hit`]);
assert.equal(caps.finished, 8);
assert.equal(caps.afterMute, 0);
const failed = artifact('failed-source.json');
assert.deepEqual(failed.calls, []);
assert.equal(failed.synth, 0);
assert.equal(failed.records, 1);
assert.equal(failed.requests.length, 3);
assert.equal(new Set(failed.requests).size, 3);
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
assert.equal(production.unrequestedLeonaPreloads, 0);
assert.equal(production.leonaPlayerFixtureInProduction, false);
const offline = data(ledger.checks.offline),
  manifest = data('dist/offline-pack.json');
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.equal(offline.manifest.id, ledger.pack);
assert.equal(manifest.id, ledger.pack);
assert.equal(manifest.bytes, ledger.packBytes);
assert.equal(manifest.files.length, 1057);
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
assert.equal(assets.publicFiles, 1008);
assert.equal(assets.unchanged, 1008);
for (const k of ['added', 'removed', 'modified']) assert.deepEqual(assets[k], []);
assert(ledger.acceptance.sunlightAudioIntegrated);
for (const k of ['nativeListeningVerified', 'nativeDispatchVerified', 'fullProjectComplete'])
  assert.equal(ledger.acceptance[k], false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    units: 2006,
    browserCases: 65,
    publicFilesUnchanged: 1008,
    schema: 128,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
  })
);
