/** Frozen Leona Death3D source preparation acceptance; offline/read-only. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (p) => JSON.parse(readFileSync(p));
const digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const ledger = json('docs/reference/leona/death-audio-source-verification.json');
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
assert.match(text(ledger.checks.standard), /2009 passed \(2009\)/);
assert.match(text(ledger.checks.standard), /325 passed \(325\)/);
assert.match(text(ledger.checks.standard), /pass 3/);
assert.equal(text(ledger.checks.typecheck), '');
const browser = data(ledger.checks.browser);
assert.deepEqual(browser.errors, []);
assert.equal(browser.stats.expected, 2);
assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.skipped, 0);
assert.equal(browser.stats.flaky, 0);
const graphPath = 'docs/reference/leona-death-audio.json',
  decodedPath = 'docs/reference/leona-death-audio-decoded.json';
const graph = data(graphPath),
  decoded = data(decodedPath),
  copy = structuredClone(graph);
assert.equal(graph.events.length, 1);
assert.equal(graph.nodes.length, 7);
assert.equal(graph.media.length, 2);
assert.equal(graph.events[0].id, 1647906331);
assert.equal(graph.events[0].actions[0].target, 461770655);
assert.equal(graph.events[0].actions.length, 2);
assert.equal(graph.events[0].actions[1].target, 267995038);
assert.deepEqual(
  graph.events[0].actions.map((a) => a.id),
  [22612475, 148653763]
);
assert.equal(decoded.sourceGraphSha256, digest(frozen(graphPath)));
delete copy.stopAudit;
assert.deepEqual(copy, data(ledger.checks.independentGraph));
assert.equal(
  digest(frozen(ledger.checks.independentFindings)),
  '2289e93dbdd0281af385d3156c2f998baf708a65e111a55e48e0f511f17758e6'
);
for (const p of [ledger.checks.independent, ledger.checks.independentOptimized])
  assert.match(text(p), /PASS Death3D static/);
for (const p of [ledger.checks.export, ledger.checks.exportOptimized])
  assert.deepEqual(data(p), {
    result: 'passed',
    checkOnly: true,
    events: 1,
    layers: 2,
    media: 2,
    shippedBytes: 1325344,
    tailTicks: 338,
  });
const controls = data(ledger.checks.controls);
assert.equal(controls.length, 20);
assert.equal(controls.filter((r) => r.expectedPass).length, 2);
for (const r of controls) {
  assert.equal(r.returncode === 0, r.expectedPass);
  if (!r.expectedPass) assert(text(r.log).includes(r.reason));
}
const guard = data(ledger.checks.decoderGuard);
assert.equal(guard.result, 'passed');
assert.equal(guard.rejections.length, 2);
for (const r of guard.rejections) {
  assert(r.returncode !== 0);
  assert.equal(r.unchangedFiles, 3);
  assert.match(text(r.log), /Refuse to overwrite retained Death3D decoded masters/);
}
for (const [p, hash] of Object.entries(guard.before)) assert.equal(digest(frozen(p)), hash, p);
const reproduction = data(ledger.checks.reproduction);
assert.equal(reproduction.result, 'passed');
assert.equal(reproduction.reproducedFiles.length, 10);
assert(reproduction.independentGraphEqualExceptAddedStopAudit);
for (const r of reproduction.reproducedFiles) {
  assert.equal(digest(frozen(r.file)), r.sha256);
  assert.equal(readFileSync(frozen(r.file)).length, r.bytes);
}
let bytes = 0,
  frames = 0,
  outside = 0,
  peak = 0;
assert.deepEqual(
  decoded.media.map((m) => m.id),
  [455387691, 558948421]
);
for (const m of decoded.media) {
  const raw = readFileSync(frozen(`public/assets/audio/leona-death-${m.id}.wav`));
  assert.equal(createHash('sha256').update(raw).digest('hex'), m.wavSha256);
  assert.equal(raw.length, m.wavBytes);
  assert.equal(m.channels, 1);
  assert.equal(m.sampleRate, 44100);
  assert.equal(m.decoderMetadata.loopingInfo, null);
  let pcm, fmt;
  for (let i = 12; i < raw.length;) {
    const n = raw.readUInt32LE(i + 4),
      tag = raw.toString('ascii', i, i + 4);
    if (tag === 'data') pcm = raw.subarray(i + 8, i + 8 + n);
    if (tag === 'fmt ') fmt = raw.subarray(i + 8, i + 8 + n);
    i += 8 + n + (n % 2);
  }
  assert(pcm && fmt);
  assert.equal(fmt.readUInt16LE(0), 3);
  assert.equal(fmt.readUInt16LE(14), 32);
  assert.equal(pcm.length, m.frames * 4);
  assert.equal(createHash('sha256').update(pcm).digest('hex'), m.pcmSha256);
  let high = 0,
    count = 0;
  for (let i = 0; i < pcm.length; i += 4) {
    const sample = pcm.readFloatLE(i);
    assert(Number.isFinite(sample));
    high = Math.max(high, Math.abs(sample));
    if (Math.abs(sample) > 1) count++;
  }
  assert.equal(high, m.peak);
  assert.equal(count, m.samplesOutsideUnitRange);
  assert.equal(m.durationSeconds, m.frames / 44100);
  bytes += raw.length;
  frames += m.frames;
  outside += count;
  peak = Math.max(peak, high);
}
assert.equal(bytes, 1325344);
assert.equal(Math.ceil((decoded.media[1].durationSeconds + 1.75) * 60), 338);
assert.match(text('src/content/leona-death-audio-timing.ts'), /LEONA_DEATH_AUDIO_TICKS = 338/);
assert.equal(frames, 331314);
assert.equal(outside, 0);
assert.equal(peak, 0.9752417802810669);
const browserDecode = data(ledger.checks.browserDecode);
assert.equal(browserDecode.length, 2);
for (const [i, r] of browserDecode.entries()) {
  assert.equal(r.hash, decoded.media[i].wavSha256);
  assert.equal(r.frames, decoded.media[i].frames);
  assert.equal(r.sourceFrames, r.frames);
  assert.equal(r.rate, 44100);
  assert.equal(r.channels, 1);
  assert.equal(r.differences, 0);
  assert.equal(r.peak, decoded.media[i].peak);
}
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
assert.equal(manifest.files.length, 1059);
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
assert.equal(assets.unchanged, 1008);
assert.deepEqual(assets.modified, []);
assert.deepEqual(assets.removed, []);
assert.deepEqual(
  assets.added,
  [455387691, 558948421].map((id) => `public/assets/audio/leona-death-${id}.wav`).sort()
);
assert(ledger.acceptance.deathSourcePrepared);
for (const k of [
  'deathAudioIntegrated',
  'nativeListeningVerified',
  'nativeDispatchVerified',
  'fullProjectComplete',
])
  assert.equal(ledger.acceptance[k], false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    units: 2009,
    browserCases: 2,
    masters: 2,
    newMasterBytes: 1325344,
    publicFilesUnchanged: 1008,
    schema: 128,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
  })
);
