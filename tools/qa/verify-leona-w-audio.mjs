/** Read-only retained evidence; native audio/full-project acceptance remains open. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const text = (f) => readFileSync(f, 'utf8'),
  json = (f) => JSON.parse(text(f));
const hash = (b) => createHash('sha256').update(b).digest('hex');
const ledger = json('docs/reference/leona/w-audio-verification.json');
function verify(pin, file = pin.file) {
  const bytes = readFileSync(file);
  assert.equal(bytes.length, pin.bytes, file);
  assert.equal(hash(bytes), pin.sha256, file);
}
for (const file of [ledger.sourceArchive, ...ledger.earlierSourceArchives])
  for (const p of json(file).files) {
    verify(p, p.archived);
    if (!historical && file === ledger.sourceArchive) verify(p);
  }
for (const file of ledger.preservedArchives)
  for (const p of json(file).files) verify(p, p.archived ?? p.file);
for (const p of ledger.reviewInputs) {
  verify(p, p.archived);
  if (!historical) verify(p);
}
for (const p of ledger.evidence) verify(p);
if (!historical) for (const p of json(ledger.buildArchive).files) verify(p, 'dist/' + p.file);
const source = json(ledger.sourceArchive),
  browserSource = json(ledger.browserSourceArchive);
assert.equal(source.schema, 124);
assert.equal(source.schema, ledger.schema);
assert.equal(source.ruleset, ledger.ruleset);
assert.equal(source.files.length, 1514);
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
const before = new Map(browserSource.files.map((p) => [p.file, p.sha256]));
assert.equal(before.size, source.files.length);
assert.deepEqual(
  source.files.filter((p) => before.get(p.file) !== p.sha256).map((p) => p.file),
  ['tests/ruleset-fingerprint.test.ts']
);
const input = (file) => {
  const p = source.files.find((p) => p.file === file);
  assert(p, file);
  return json(p.archived);
};
const graph = input('docs/reference/leona-w-audio.json'),
  decoded = input('docs/reference/leona-w-audio-decoded.json');
assert.equal(graph.events.length, 7);
assert.equal(graph.nodes.length, 40);
assert.equal(graph.media.length, 18);
assert.deepEqual(graph.unresolvedHierarchyIds, [1259461568]);
assert.equal(
  decoded.sourceGraphSha256,
  hash(
    readFileSync(source.files.find((p) => p.file === 'docs/reference/leona-w-audio.json').archived)
  )
);
assert.equal(decoded.media.length, 18);
assert.equal(
  graph.media.reduce((n, m) => n + m.bytes, 0),
  320521
);
assert.equal(
  decoded.media.reduce((n, m) => n + m.wavBytes, 0),
  6748852
);
assert.equal(
  decoded.media.reduce((n, m) => n + m.frames, 0),
  1687015
);
assert.equal(
  decoded.media.reduce((n, m) => n + m.samplesOutsideUnitRange, 0),
  8
);
for (const m of decoded.media) {
  assert.equal(m.channels, 1);
  assert.equal(m.sampleRate, 44100);
  assert.equal(m.decoderMetadata.loopingInfo, null);
  assert.equal(m.encodedSha256, graph.media.find((p) => p.id === m.id).sha256);
  const wav = source.files.find((p) => p.file === `public/assets/audio/leona-w-${m.id}.wav`);
  assert(wav);
  assert.equal(wav.sha256, m.wavSha256);
}
assert.equal(json(ledger.nativeArchive).files.length, 39);
const c = ledger.checks;
assert.match(text(c.unit), /1672 passed \(1672\)/);
assert.match(text(c.unit), /286 passed \(286\)/);
assert.equal(text(c.typecheck), '');
assert.match(text(c.nodeQa), /pass 3/);
assert.match(text(c.nodeQa), /fail 0/);
assert.match(text(c.browser), /36 passed/);
assert.match(text(c.build), /built in/);
assert.equal(json(ledger.buildArchive).files.length, 33);
assert.deepEqual(json(c.export), {
  result: 'passed',
  checkOnly: true,
  events: 7,
  roles: 5,
  media: 18,
  shippedBytes: 6748852,
});
const pcm = json(c.pcm);
assert.equal(pcm.length, 18);
for (const [i, r] of pcm.entries()) {
  assert.equal(r.differences, 0);
  assert.equal(r.frames, r.sourceFrames);
  assert.equal(r.rate, 44100);
  assert.equal(r.channels, 1);
  const m = decoded.media.find((m) => m.wavSha256 === r.hash);
  assert(m, 'PCM ' + i);
  assert.equal(r.frames, m.frames);
  assert.equal(r.peak, m.peak);
}
const saved = json(c.saved);
assert.deepEqual(saved.errors, []);
assert.deepEqual(
  saved.active.map((p) => [p.kind, p.offset, p.loop]),
  [
    ['cast', 0, false],
    ['initial', 0, false],
  ]
);
assert.equal(saved.before.snapshot, saved.restored.snapshot);
const comparable = (rows) => rows.map(({ stops: _contextTime, ...p }) => p);
assert.deepEqual(comparable(saved.before.calls), comparable(saved.restored.calls));
assert.deepEqual(
  saved.before.calls.map((p) => p.kind),
  ['initial', 'extended', 'hit']
);
assert.deepEqual(
  saved.miss.calls.map((p) => p.kind),
  ['initial', 'miss']
);
assert.equal(saved.miss.synth, 0);
assert(saved.miss.calls.every((p) => !p.loop));
const fog = json(c.fog);
assert.equal(fog.hidden, 0);
assert.equal(fog.revealed, 0);
assert(!fog.born.includes('blue'));
assert.deepEqual(
  fog.burst.map((p) => p.kind),
  ['extended', 'hit']
);
assert.equal(fog.winner, 'blue');
assert.equal(fog.remaining, 0);
assert.equal(fog.sameSave, true);
assert(
  fog.burst
    .find((p) => p.kind === 'extended')
    .stops.some((s) => s !== null && Math.abs(s - 0.5) < 1e-6)
);
const late = json(c.late),
  failed = json(c.failed);
assert.deepEqual(
  late.calls.map((p) => p.kind),
  ['initial']
);
assert.equal(late.synth, 1);
assert.deepEqual(failed.calls, []);
assert.equal(failed.synth, 1);
for (const r of [late, failed]) {
  assert.equal(r.requests.length, 18);
  assert.equal(new Set(r.requests).size, 18);
}
const ended = json(c.ended);
assert.equal(ended.before, 2);
assert.equal(ended.after, 2);
assert.equal(ended.finished, 2);
assert.equal(ended.voices, 0);
assert.equal(ended.sameTick, true);
const normal = json(c.normal),
  comparison = json(c.comparison);
assert.equal(normal.result, 'passed');
assert.equal(normal.ruleset, ledger.ruleset);
assert.equal(normal.checkedTicks, 72000);
assert.equal(normal.roundTrips, 20);
assert.equal(normal.futureChecks, 18);
assert.equal(normal.unfinished, 2);
assert.equal(normal.hundredSeedInvariantGate, false);
assert.equal(comparison.result, 'passed');
assert.deepEqual(comparison.normalization, ['ruleset']);
assert.equal(comparison.matches.length, 20);
for (const m of comparison.matches) {
  for (const side of ['older', 'newer'])
    assert.equal(hash(readFileSync(m[side])), m[side + 'Sha256']);
  const older = json(m.older),
    newer = json(m.newer);
  assert.equal(newer.version, 124);
  newer.ruleset = older.ruleset;
  assert.deepEqual(newer, older);
}
const production = json(c.production),
  offline = json(c.offline),
  manifest = json(c.manifest);
assert.equal(production.result, 'passed');
assert.equal(production.recordings, 32);
assert.equal(production.unrequestedLeonaPreloads, 0);
assert.equal(production.developmentHook, false);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.deepEqual(offline.manifest, {
  id: manifest.id,
  files: manifest.files.length,
  bytes: manifest.bytes,
});
assert.equal(manifest.id, '38fd31d3a273bbd748751be648f80b691ddd98c74cc5574b7a14efc4b6055108');
assert.equal(manifest.files.length, 901);
assert.equal(manifest.bytes, 506000253);
for (const [key, value] of Object.entries(offline.checks))
  if (key === 'serviceWorkerResponses') assert(value > 0);
  else assert.equal(value, true, key);
assert.match(text(c.initialInventoryFailure), /FileNotFoundError/);
assert.match(text(c.initialBrowserFailure), /2 failed/);
assert.match(text(c.fullFailure), /5 failed/);
assert.match(text(c.fullFailure), /Test timed out in 5000ms/);
assert.match(text(c.fullFailure), /src\/audio\/leona-w-state.ts/);
assert(Object.values(ledger.acceptance).every((p) => p === false));
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    schema: ledger.schema,
    ruleset: ledger.ruleset,
    archivedInputs: source.files.length,
    nativeFiles: 39,
    sourceEvents: 7,
    finiteAudioRoles: 5,
    recordings: 18,
    exactChromeSamples: 1687015,
    unitTests: 1672,
    browserCases: 36,
    checkedNormalTicks: 72000,
    productionRecordings: 32,
    offlineFiles: manifest.files.length,
    ...ledger.acceptance,
  })
);
