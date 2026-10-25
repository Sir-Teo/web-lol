/** Frozen Leona death playback acceptance; offline/read-only. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (p) => JSON.parse(readFileSync(p));
const digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const ledger = json('docs/reference/leona/death-audio-runtime-verification.json');
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
assert.match(text(ledger.checks.standard), /2028 passed \(2028\)/);
assert.match(text(ledger.checks.standard), /327 passed \(327\)/);
assert.match(text(ledger.checks.standard), /pass 3/);
assert.equal(text(ledger.checks.typecheck), '');
assert.match(text(ledger.checks.regression), /2 failed/);
const browser = data(ledger.checks.browser);
assert.deepEqual(browser.errors, []);
assert.equal(browser.stats.expected, 75);
assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.skipped, 0);
assert.equal(browser.stats.flaky, 0);
assert.match(text(ledger.checks.sourceAccepted), /"result":"passed"/);
assert.match(text(ledger.checks.sourceAccepted), /"historical":true/);
assert.match(text('src/content/leona-death-audio-timing.ts'), /LEONA_DEATH_AUDIO_TICKS = 338/);
assert.equal(Object.keys(ledger.checks.savedDeaths).length, 2);
for (const [age, path] of Object.entries(ledger.checks.savedDeaths)) {
  const r = data(path),
    p = r.prepared,
    c = r.restored,
    phase = Number(age);
  assert.equal(r.phase, phase);
  assert.deepEqual(r.errors, []);
  assert.equal(p.snapshot, c.snapshot);
  assert.equal(p.future, c.future);
  const snap = JSON.parse(p.snapshot);
  assert.equal(snap.version, 129);
  assert.equal(snap.ruleset, ledger.ruleset);
  assert(p.sameSave && p.sameRng && p.sameId);
  assert.equal(p.synth, 0);
  assert.equal(c.synth, 0);
  assert.equal(p.deathLog, phase < 150);
  assert.equal(c.deathLog, false);
  assert.deepEqual(
    p.initial.map((v) => [v.kind, v.variant, v.offset, v.rate, v.loop]),
    [
      ['first', 0, 0, 1, false],
      ['second', 0, 0, 1, false],
    ]
  );
  assert(Math.abs(p.initial[1].lead - 1.75) < 0.01);
  for (const v of p.initial) assert(Math.abs(v.gain - 0.2 * 10 ** (-10 / 20)) < 1e-6);
  assert.equal(p.calls.length, 2);
  assert(Math.abs(p.calls[0].offset - phase / 60) < 1e-10);
  assert(Math.abs(p.calls[1].offset - Math.max(0, (phase - 105) / 60)) < 1e-10);
  assert(Math.abs(p.calls[1].lead - Math.max(0, (105 - phase) / 60)) < 0.01);
  const compare = (rows) => rows.map(({ stops, lead, ...rest }) => rest);
  assert.deepEqual(compare(p.calls), compare(c.calls));
  const id = Number(p.calls[0].key.split(':')[0]),
    owner = snap.otherChampions.find((o) => o.id === id);
  assert.deepEqual(owner.leonaDeathVisuals, [p.record]);
  assert.equal(owner.leonaDeathVisuals[0].startTick, snap.units.find((u) => u.id === id).deadAt);
  assert.deepEqual(
    JSON.parse(p.future).otherChampions.find((o) => o.id === id).leonaDeathVisuals,
    []
  );
}
const artifact = (name) => {
  const found = rows.filter(
    (r) =>
      r.file.startsWith(
        '.cache/leona-death-audio-runtime-v1-20261025/browser-final/leona-death-audio-'
      ) && r.file.endsWith('/' + name)
  );
  assert.equal(found.length, 1, name);
  return data(found[0].file);
};
const visible = artifact('visibility.json');
assert.equal(visible.hidden, 0);
assert.deepEqual(visible.calls, []);
assert(visible.visible);
assert(!visible.record.audience.includes('blue'));
const finite = artifact('finite.json');
assert.equal(finite.calls.length, 2);
assert.equal(finite.remaining, 0);
assert.equal(finite.finished, 2);
assert(finite.sameSave);
const terminal = artifact('terminal.json');
assert.equal(terminal.before, 2);
assert.equal(terminal.remaining, 0);
assert(terminal.sameSave && terminal.sameTick);
assert.equal(terminal.winner, 'blue');
assert.equal(terminal.records, 1);
const caps = artifact('caps.json');
assert.equal(caps.calls.length, 12);
assert.equal(caps.kept.length, 4);
for (const kind of ['first', 'second'])
  assert.deepEqual(
    caps.voices.filter((k) => k.endsWith(':' + kind)),
    caps.kept.map((id) => `${id}:${caps.start}:${kind}`)
  );
assert.equal(caps.finished, 4);
assert.equal(caps.afterMute, 0);
const solo = artifact('solo-player.json');
assert(solo.dead);
assert.equal(solo.pointVisible, false);
assert(solo.record.audience.includes('blue'));
assert.equal(solo.voices, 2);
assert.equal(solo.calls.length, 2);
const soloBefore = data(ledger.checks.soloRegression);
assert.equal(soloBefore.stats.unexpected, 1);
assert.equal(soloBefore.stats.expected, 0);
assert.deepEqual(soloBefore.errors, []);
const allSpecs = (suites) =>
  suites.flatMap((s) => [...(s.specs ?? []), ...allSpecs(s.suites ?? [])]);
const soloSpec = allSpecs(soloBefore.suites);
assert.equal(soloSpec.length, 1);
assert.equal(
  soloSpec[0].title,
  'an isolated player death keeps both accepted layers after losing its own vision'
);
assert.match(
  soloSpec[0].tests[0].results[0].error.message.replace(/\u001b\[[0-9;]*m/g, ''),
  /Expected: 2[\s\S]*Received: 0/
);

const failed = artifact('failed-source.json');
assert.deepEqual(failed.calls, []);
assert.equal(failed.synth, 0);
assert.equal(failed.records, 1);
assert.equal(failed.requests.length, 2);
assert.equal(new Set(failed.requests).size, 2);
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
assert(ledger.acceptance.savedDeathsIntegrated && ledger.acceptance.deathAudioIntegrated);
for (const k of ['nativeListeningVerified', 'nativeDispatchVerified', 'fullProjectComplete'])
  assert.equal(ledger.acceptance[k], false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    units: 2028,
    browserCases: 75,
    publicFilesUnchanged: 1010,
    schema: 129,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
  })
);
