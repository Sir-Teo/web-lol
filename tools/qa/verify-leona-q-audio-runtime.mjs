/** Frozen Daybreak source playback acceptance. Offline and read-only; no native playback claim. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (p) => JSON.parse(readFileSync(p));
const digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const ledger = json('docs/reference/leona/q-audio-runtime-verification.json');
assert.equal(digest(ledger.sourceArchive), ledger.sourceArchiveSha256);
const sources = json(ledger.sourceArchive).files;
const rows = [...sources, ...ledger.generated, ...ledger.evidence];
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
const data = (p) => json(frozen(p));
const text = (p) => readFileSync(frozen(p), 'utf8');
if (!historical) assert.equal(rulesetFingerprint(), ledger.ruleset);
assert.equal(ledger.schema, 127);
const graphPath = 'docs/reference/leona-q-audio.json';
const graph = data(graphPath),
  decoded = data('docs/reference/leona-q-audio-decoded.json');
assert.equal(graph.events.length, 5);
assert.equal(graph.nodes.length, 29);
assert.equal(graph.media.length, 13);
assert.deepEqual(graph.unresolvedHierarchyIds, [1259461568]);
assert.equal(graph.extractionSha256, digest(frozen('docs/reference/leona-audio-extraction.json')));
assert.equal(graph.referenceSha256, digest(frozen('docs/reference/leona-model.json')));
assert.equal(decoded.sourceGraphSha256, digest(frozen(graphPath)));
assert.deepEqual(graph, data(ledger.checks.independentGraph));
for (const input of [...graph.bankSources, { localPath: graph.parserXml.path, ...graph.parserXml }])
  assert.equal(digest(frozen(input.localPath)), input.sha256);
assert.equal(decoded.media.length, 13);
assert.equal(
  decoded.media.reduce((sum, m) => sum + m.wavBytes, 0),
  2474956
);
assert.equal(
  decoded.media.reduce((sum, m) => sum + m.samplesOutsideUnitRange, 0),
  8
);
for (const m of decoded.media) {
  assert.equal(m.channels, 1);
  assert.equal(m.sampleRate, 44100);
  assert.equal(m.decoderMetadata.loopingInfo, null);
  assert.equal(m.encodedSha256, graph.media.find((s) => s.id === m.id).sha256);
  assert.equal(digest(frozen(`public/assets/audio/leona-q-${m.id}.wav`)), m.wavSha256);
  assert.equal(
    digest(frozen(`.cache/leona-q-audio-media-v1-20261024/${m.id}.wem`)),
    m.encodedSha256
  );
}
assert.equal(
  digest(frozen(ledger.checks.independentFindings)),
  '900930be9a9aa7cb671763730eccdfb67c68c033a639a5bbc331d555c4f6b5c1'
);
assert.equal(
  digest(frozen(ledger.checks.independentStopAudit)),
  '98784ca9b7f2aeb6a8ba537c2969093b3832965015f95fe71fdc8ade1f6bb68f'
);
for (const c of ['export', 'optimizedExport'])
  assert.deepEqual(data(ledger.checks[c]), {
    result: 'passed',
    checkOnly: true,
    events: 5,
    roles: 4,
    media: 13,
    shippedBytes: 2474956,
  });
const controls = data(ledger.checks.negative);
assert.equal(controls.length, 14);
assert.equal(controls.filter((r) => r.expectedPass).length, 2);
for (const r of controls) {
  assert.equal(r.returncode === 0, r.expectedPass, r.case);
  if (!r.expectedPass) assert.match(text(r.log), /ValueError/);
}
assert.match(text(ledger.checks.standard), /1966 passed \(1966\)/);
assert.match(text(ledger.checks.standard), /319 passed \(319\)/);
assert.match(text(ledger.checks.standard), /pass 3/);
assert.match(text(ledger.checks.browser), /38 passed/);
assert.equal(text(ledger.checks.typecheck), '');
const pcm = data(ledger.checks.pcm);
assert.equal(pcm.length, 13);
for (const row of pcm) {
  const m = decoded.media.find((m) => m.wavSha256 === row.hash);
  assert(m);
  assert.equal(row.differences, 0);
  assert.equal(row.frames, m.frames);
  assert.equal(row.frames, row.sourceFrames);
  assert.equal(row.peak, m.peak);
  assert.equal(row.rate, 44100);
  assert.equal(row.channels, 1);
}
assert.deepEqual(data(ledger.checks.lazy), { requests: [] });
const saved = data(ledger.checks.saved);
assert.deepEqual(saved.errors, []);
assert.equal(saved.prepared.snapshot, saved.restored.snapshot);
assert.equal(saved.prepared.future, saved.restored.future);
const checkpoint = JSON.parse(saved.prepared.snapshot);
assert.equal(checkpoint.version, 127);
assert.equal(checkpoint.ruleset, ledger.ruleset);
const comparable = (rows) => rows.map(({ stops, gain, ...rest }) => rest);
assert.deepEqual(comparable(saved.prepared.calls), comparable(saved.restored.calls));
assert.deepEqual(saved.prepared.calls.map((r) => r.kind).sort(), ['attack', 'buff', 'cast', 'hit']);
assert.equal(saved.prepared.synth, 0);
assert.equal(saved.restored.synth, 0);
const buff = saved.prepared.calls.find((r) => r.kind === 'buff');
assert.equal(buff.loop, true);
assert(Math.abs(buff.stops.at(-1) - 27 / 60) < 0.001);
assert(buff.gain.some((r) => r[0] === 'setValueAtTime' && Math.abs(r[1] - 0.9) < 1e-6));
assert(saved.prepared.calls.filter((r) => r.kind !== 'buff').every((r) => !r.loop));
const terminal = data(ledger.checks.terminal);
assert.equal(terminal.resumed.length, 1);
assert.equal(terminal.resumed[0].kind, 'buff');
assert.equal(terminal.resumed[0].loop, true);
assert.deepEqual(terminal.resumed[0].stops, []);
assert(Math.abs(terminal.resumed[0].offset - ((200 / 60) % 2.4997732426303854)) < 1e-6);
assert(Math.abs(terminal.stop[0].stops.at(-1) - 0.5) < 0.01);
assert.equal(terminal.winner, 'blue');
assert.equal(terminal.remaining, 0);
assert.equal(terminal.sameSave, true);
assert.equal(terminal.synth, 0);
const visibility = data(ledger.checks.visibility);
assert.equal(visibility.hidden, 0);
assert.equal(visibility.revealed, 0);
assert.equal(visibility.visible, true);
assert(!visibility.cast.includes('blue'));
assert(!visibility.attack.includes('blue'));
assert.deepEqual(data(ledger.checks.fallback), { synth: 2, late: ['buff', 'hit'], suppressed: 2 });
assert.deepEqual(data(ledger.checks.completion), {
  before: 2,
  after: 2,
  remaining: 1,
  afterMute: 0,
  finished: 1,
  sameTick: true,
});
const failed = data(ledger.checks.failed);
assert.deepEqual(failed.calls, []);
assert.equal(failed.synth, 1);
assert.equal(failed.requests.length, 13);
assert.equal(new Set(failed.requests).size, 13);
assert.match(text(ledger.checks.regression), /2 failed/);
assert.match(text('src/content/leona-q-audio-timing.ts'), /CAST_AUDIO_TICKS = 114/);
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
assert.equal(production.leonaPlayerFixtureInProduction, false);
assert.equal(production.unrequestedLeonaPreloads, 0);
const offline = data(ledger.checks.offline),
  manifest = data('dist/offline-pack.json');
assert.equal(offline.result, 'passed');
assert.deepEqual(offline.productionErrors, []);
assert.equal(offline.manifest.id, ledger.pack);
assert.equal(manifest.id, ledger.pack);
assert.equal(manifest.files.length, 1031);
assert.equal(manifest.files.length, ledger.packFiles);
assert.equal(manifest.bytes, ledger.packBytes);
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
  assert.equal(row.bytes, entry.bytes, entry.path);
  assert.equal(row.sha256, entry.sha256, entry.path);
}
const assets = data(ledger.checks.assets);
assert.equal(assets.publicFiles, 984);
assert.equal(assets.unchanged, 984);
assert.deepEqual(assets.modified, []);
assert.deepEqual(assets.removed, []);
assert.deepEqual(assets.added, []);
assert.equal(ledger.acceptance.sourceMastersPrepared, true);
assert.equal(ledger.acceptance.runtimeIntegrated, true);
for (const key of ['nativeListeningVerified', 'nativeDispatchVerified', 'fullProjectComplete'])
  assert.equal(ledger.acceptance[key], false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    events: 5,
    masters: 13,
    units: 1966,
    browserCases: 38,
    files: manifest.files.length,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
  })
);
