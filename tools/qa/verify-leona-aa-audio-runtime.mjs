/** Frozen ordinary Leona source playback acceptance; offline/read-only. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (p) => JSON.parse(readFileSync(p));
const digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const ledger = json('docs/reference/leona/aa-audio-runtime-verification.json');
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
assert.match(text(ledger.checks.standard), /1996 passed \(1996\)/);
assert.match(text(ledger.checks.standard), /322 passed \(322\)/);
assert.match(text(ledger.checks.standard), /pass 3/);
assert.equal(text(ledger.checks.typecheck), '');
assert.match(text(ledger.checks.regression), /1 failed \| 13 passed/);
const browser = data(ledger.checks.browser);
assert.equal(browser.stats.unexpected, 1);
assert.equal(browser.stats.flaky, 0);
assert.equal(browser.stats.skipped, 0);
assert.equal(browser.stats.expected, 52);
assert.deepEqual(browser.errors, []);
// The only full-run failure was the old thirteen-request expectation. Validate
// its exact identity/reason and the corrected focused rerun against the same code.
const specs = (suites) => suites.flatMap((s) => [...(s.specs ?? []), ...specs(s.suites ?? [])]);
const failedSpecs = specs(browser.suites).filter((s) =>
  s.tests.some((t) => t.results.some((r) => r.status !== 'passed'))
);
assert.equal(failedSpecs.length, 1);
assert.equal(
  failedSpecs[0].title,
  'failed Q masters settle readiness and do not retry every frame'
);
assert.match(
  failedSpecs[0].tests[0].results[0].error.message.replace(/\u001b\[[0-9;]*m/g, ''),
  /Expected length: 13[\s\S]*Received length: 20/
);
const repair = data(ledger.checks.browserRepair);
assert.deepEqual(repair.errors, []);
assert.equal(repair.stats.expected, 1);
assert.equal(repair.stats.unexpected, 0);
assert.equal(repair.stats.skipped, 0);
assert.equal(repair.stats.flaky, 0);
assert.equal(specs(repair.suites)[0].title, failedSpecs[0].title);
const repaired = data(ledger.checks.repairedQRequests);
assert.equal(repaired.synth, 1);
assert.deepEqual(repaired.calls, []);
assert.equal(repaired.requests.length, 20);
assert.equal(new Set(repaired.requests).size, 13);
const counts = new Map();
for (const url of repaired.requests) {
  const name = new URL(url).pathname.split('/').at(-1);
  counts.set(name, (counts.get(name) ?? 0) + 1);
}
assert([...counts.values()].every((n) => n === 1 || n === 2));
assert.deepEqual(
  [...counts]
    .filter(([, n]) => n === 2)
    .map(([name]) => name)
    .sort(),
  [65890581, 99858069, 124210504, 149881516, 180033450, 256570934, 271147565]
    .map((id) => `leona-q-${id}.wav`)
    .sort()
);
for (const [mode, file] of Object.entries(ledger.checks.savedSources)) {
  const r = data(file),
    p = r.prepared;
  assert.equal(r.mode, mode);
  assert.equal(p.record.kind, mode);
  assert.equal(p.snapshot, r.restored.snapshot);
  assert.equal(p.future, r.restored.future);
  assert.equal(JSON.parse(p.snapshot).ruleset, ledger.ruleset);
  assert.equal(p.synth, 0);
  assert.equal(r.restored.synth, 0);
  assert.deepEqual(r.errors, []);
  assert.equal(p.start.length, 1);
  assert.equal(p.start[0].offset, 0);
  const delay = mode === 'attack1' || mode === 'spell2_attack' ? 0.04 : 0;
  assert(Math.abs(p.start[0].lead - delay) < 0.01);
  const hit = p.calls.find((v) => v.kind === (mode === 'crit' ? 'criticalHit' : 'hitMetal'));
  assert(hit);
  assert.equal(hit.loop, false);
  assert(hit.rate >= 2 ** (-300 / 1200) && hit.rate <= 2 ** (300 / 1200));
  const compare = (rows) => rows.map(({ stops, gain, lead, ...rest }) => rest);
  assert.deepEqual(compare(p.calls), compare(r.restored.calls));
}
assert.equal(Object.keys(ledger.checks.savedSources).length, 4);
const artifact = (name) =>
  rows.filter(
    (r) =>
      r.file.startsWith(
        '.cache/leona-aa-audio-runtime-v1-20261024/browser-final/leona-aa-audio-'
      ) && r.file.endsWith('/' + name)
  );
for (const name of [
  'canceled-finite.json',
  'visibility.json',
  'fallback.json',
  'failed-source.json',
  'terminal.json',
])
  assert.equal(artifact(name).length, 1, name);
const canceled = data(artifact('canceled-finite.json')[0].file);
assert.equal(canceled.first.record.impact, null);
assert.equal(canceled.last.calls.length, 1);
assert(canceled.last.sameSave);
assert.equal(canceled.last.finished, 1);
const visible = data(artifact('visibility.json')[0].file);
assert.equal(visible.hidden, 0);
assert.equal(visible.revealed, 0);
assert.deepEqual(
  visible.calls.map((v) => v.kind),
  ['hitFlesh']
);
const fallback = data(artifact('fallback.json')[0].file);
assert.equal(fallback.synth, 1);
assert.equal(fallback.suppressed, 7);
assert.deepEqual(fallback.calls, []);
const failed = data(artifact('failed-source.json')[0].file);
assert.equal(failed.synth, 1);
assert.deepEqual(failed.calls, []);
assert.equal(failed.requests.length, 17);
assert.equal(new Set(failed.requests).size, 17);
const terminal = data(artifact('terminal.json')[0].file);
assert(terminal.before > 0);
assert.equal(terminal.remaining, 0);
assert(terminal.sameSave && terminal.sameTick);
assert.equal(terminal.winner, 'blue');
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
assert.equal(manifest.files.length, 1053);
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
assert.equal(assets.publicFiles, 1005);
assert.equal(assets.unchanged, 1005);
for (const key of ['added', 'modified', 'removed']) assert.deepEqual(assets[key], []);
assert(ledger.acceptance.ordinarySourceAudioIntegrated);
for (const key of ['nativeListeningVerified', 'nativeDispatchVerified', 'fullProjectComplete'])
  assert.equal(ledger.acceptance[key], false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    units: 1996,
    browserCases: 53,
    publicFilesUnchanged: 1005,
    schema: 128,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
  })
);
