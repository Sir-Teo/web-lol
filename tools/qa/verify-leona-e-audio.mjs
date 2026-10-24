/** Frozen Zenith SFX evidence; VO, native mix/frame and full-project acceptance remain open. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (f) => JSON.parse(readFileSync(f, 'utf8'));
const hash = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const ledger = json('docs/reference/leona/e-audio-verification.json');
const source = json(ledger.sourceArchive).files;
for (const p of [...source, ...ledger.evidence, ...ledger.generated]) {
  assert.equal(hash(p.archived), p.sha256, p.archived);
  assert.equal(readFileSync(p.archived).length, p.bytes, p.archived);
}
if (!historical) {
  for (const p of [...source, ...ledger.generated]) assert.equal(hash(p.file), p.sha256, p.file);
  assert.equal(rulesetFingerprint(), ledger.ruleset);
}
const frozen = (file) => source.find((p) => p.file === file).archived;
const graph = json(frozen('docs/reference/leona-e-audio.json')),
  decoded = json(frozen('docs/reference/leona-e-audio-decoded.json'));
assert.equal(graph.events.length, 8);
assert.equal(graph.nodes.length, 45);
assert.equal(graph.media.length, 21);
assert.deepEqual(graph.unresolvedHierarchyIds, [1259461568]);
assert.equal(graph.extractionSha256, hash(frozen('docs/reference/leona-audio-extraction.json')));
assert.equal(graph.referenceSha256, hash(frozen('docs/reference/leona-model.json')));
assert.equal(decoded.sourceGraphSha256, hash(frozen('docs/reference/leona-e-audio.json')));
assert.equal(decoded.media.length, 21);
assert.equal(
  graph.media.reduce((n, m) => n + m.bytes, 0),
  153551
);
assert.equal(
  decoded.media.reduce((n, m) => n + m.wavBytes, 0),
  3041668
);
assert.equal(
  decoded.media.reduce((n, m) => n + m.frames, 0),
  760186
);
assert.equal(
  decoded.media.reduce((n, m) => n + m.samplesOutsideUnitRange, 0),
  3
);
for (const m of decoded.media) {
  assert.equal(m.channels, 1);
  assert.equal(m.sampleRate, 44100);
  assert.equal(m.decoderMetadata.loopingInfo, null);
  assert.equal(m.encodedSha256, graph.media.find((p) => p.id === m.id).sha256);
  assert.equal(hash(frozen(`public/assets/audio/leona-e-${m.id}.wav`)), m.wavSha256);
}
const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
function properties(id) {
  const rows = nodes.get(id).parameters,
    result = {};
  for (const p of rows)
    if (p[0].endsWith('/pID'))
      result[p[3].split('[').at(-1).replace(']', '')] = Number(
        rows.find((x) => x[0] === p[0].slice(0, -3) + 'pValue')[2]
      );
  return result;
}
assert.equal(properties(2453).Pitch, 300);
assert.deepEqual(properties(148852500), { DelayTime: 250 });
assert.deepEqual(properties(434858585), { TransitionTime: 250 });
for (const p of graph.bankSources) {
  assert.equal(hash(p.localPath), p.sha256);
  assert.equal(readFileSync(p.localPath).length, p.bytes);
}
assert.equal(hash(graph.parserXml.path), graph.parserXml.sha256);
const c = ledger.checks;
assert.match(readFileSync(c.standard, 'utf8'), /1811 passed \(1811\)/);
assert.match(readFileSync(c.standard, 'utf8'), /298 passed \(298\)/);
assert.match(readFileSync(c.standard, 'utf8'), /pass 3/);
assert.match(readFileSync(c.browser, 'utf8'), /11 passed/);
assert.match(readFileSync(c.lifecycleBrowser, 'utf8'), /2 passed/);
assert.deepEqual(json(c.export), {
  result: 'passed',
  checkOnly: true,
  events: 8,
  roles: 6,
  media: 21,
  shippedBytes: 3041668,
});
const pcm = json(c.pcm);
assert.equal(pcm.length, 21);
for (const p of pcm) {
  const m = decoded.media.find((m) => m.wavSha256 === p.hash);
  assert(m);
  assert.equal(p.differences, 0);
  assert.equal(p.frames, m.frames);
  assert.equal(p.frames, p.sourceFrames);
  assert.equal(p.rate, 44100);
  assert.equal(p.channels, 1);
  assert.equal(p.peak, m.peak);
}
const saved = json(c.saved);
assert.deepEqual(saved.errors, []);
assert.equal(saved.prepared.snapshot, saved.restored.snapshot);
const comparable = (rows) => rows.map(({ stops: _stops, gain: _gain, ...p }) => p);
assert.deepEqual(comparable(saved.prepared.calls), comparable(saved.restored.calls));
assert.deepEqual(saved.prepared.calls.map((p) => p.kind).sort(), [
  'championContact',
  'contact',
  'dash',
  'flight',
]);
assert.equal(saved.prepared.synth, 0);
assert.equal(saved.restored.synth, 0);
assert(saved.prepared.calls.every((p) => !p.loop));
assert(Math.abs(saved.prepared.calls.find((p) => p.kind === 'contact').rate - 2 ** 0.25) < 1e-6);
const flight = saved.prepared.calls.find((p) => p.kind === 'flight');
assert(flight.gain.some((g) => g[0] === 'setValueAtTime' && Math.abs(g[1] - 8 / 15) < 1e-6));
const visibility = json(c.visibility);
assert.deepEqual(visibility.errors, []);
const v = visibility.result;
assert.equal(v.hidden, 0);
assert.equal(v.revealed, 0);
assert(!v.audiences.cast.includes('blue'));
assert(!v.audiences.flight.includes('blue'));
assert.equal(v.visible, true);
assert.equal(v.winner, 'blue');
assert.equal(v.remaining, 0);
assert.equal(v.sameSave, true);
const fallback = json(c.fallback);
assert.equal(fallback.synth, 1);
assert.deepEqual(fallback.late, []);
assert.deepEqual(fallback.calls, ['flight']);
assert.equal(fallback.suppressed, 1);
assert.deepEqual(json(c.lazy), { requests: [] });
assert.deepEqual(json(c.completion), {
  before: 1,
  after: 1,
  sameTick: true,
  finished: 1,
  voices: 0,
});
const failed = json(c.failed);
assert.deepEqual(failed.calls, []);
assert.equal(failed.synth, 1);
assert.equal(failed.requests.length, 21);
assert.equal(new Set(failed.requests).size, 21);
const production = readFileSync(c.production, 'utf8')
  .trim()
  .split('\n')
  .map((s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  })
  .find((d) => d?.result === 'passed');
assert.equal(production.recordings, 32);
assert.equal(production.developmentHook, false);
assert.equal(production.unrequestedLeonaPreloads, 0);
const offline = json(c.offline);
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
for (const [key, value] of Object.entries(offline.checks))
  if (key === 'serviceWorkerResponses') assert(value > 0);
  else assert.equal(value, true, key);
const pack = json(ledger.generated.find((p) => p.file === 'dist/offline-pack.json').archived);
assert.equal(pack.id, offline.manifest.id);
assert.equal(pack.files.length, 969);
assert.equal(pack.bytes, 509786617);
assert.equal(
  createHash('sha256')
    .update(JSON.stringify({ workerPolicySha256: pack.workerPolicySha256, files: pack.files }))
    .digest('hex'),
  pack.id
);
for (const p of pack.files) {
  const archived =
    ledger.generated.find((x) => x.file === `dist/${p.path}`)?.archived ??
    source.find((x) => x.file === `public/${p.path}`)?.archived;
  assert(archived, p.path);
  assert.equal(hash(archived), p.sha256, p.path);
  assert.equal(readFileSync(archived).length, p.bytes, p.path);
}
assert.equal(ledger.acceptance.sourceESfxIntegrated, true);
for (const key of [
  'sourceEVoiceIntegrated',
  'swordIntegrated',
  'nativeListeningVerified',
  'nativeFrameVerified',
  'fullProjectComplete',
])
  assert.equal(ledger.acceptance[key], false, key);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    events: 8,
    masters: 21,
    files: pack.files.length,
    ruleset: ledger.ruleset,
  })
);
