/** Frozen Leona attack source preparation. Offline and read-only; no native playback claim. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const historical = process.argv.includes('--historical');
const json = (p) => JSON.parse(readFileSync(p));
const digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const ledger = json('docs/reference/leona/aa-audio-source-verification.json');
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
const graphPath = 'docs/reference/leona-aa-audio.json';
const graph = data(graphPath),
  decoded = data('docs/reference/leona-aa-audio-decoded.json');
assert.equal(graph.events.length, 10);
assert.equal(graph.nodes.length, 65);
assert.equal(graph.media.length, 28);
assert.deepEqual(graph.unresolvedHierarchyIds, [211064428]);
assert.equal(graph.extractionSha256, digest(frozen('docs/reference/leona-audio-extraction.json')));
assert.equal(graph.referenceSha256, digest(frozen('docs/reference/leona-model.json')));
assert.equal(decoded.sourceGraphSha256, digest(frozen(graphPath)));
assert.deepEqual(graph, data(ledger.checks.independentGraph));
for (const input of [...graph.bankSources, { localPath: graph.parserXml.path, ...graph.parserXml }])
  assert.equal(digest(frozen(input.localPath)), input.sha256);
assert.equal(
  digest(frozen(ledger.checks.independentFindings)),
  '12bec5f815d4b62a16800b59b397c0b2f53a7a7c4bde7e03caccc5e01fa846ee'
);
const shared = new Set([65890581, 99858069, 124210504, 149881516, 180033450, 256570934, 271147565]);
assert.equal(decoded.media.length, 28);
assert.equal(
  decoded.media.reduce((n, m) => n + m.wavBytes, 0),
  3130340
);
assert.equal(
  decoded.media.reduce((n, m) => n + m.frames, 0),
  782277
);
assert.equal(
  decoded.media.reduce((n, m) => n + m.samplesOutsideUnitRange, 0),
  82
);
for (const m of decoded.media) {
  assert.equal(m.channels, 1);
  assert.equal(m.sampleRate, 44100);
  assert.equal(m.decoderMetadata.loopingInfo, null);
  assert.equal(m.encodedSha256, graph.media.find((s) => s.id === m.id).sha256);
  assert.equal(
    digest(frozen(`public/assets/audio/${shared.has(m.id) ? 'leona-q' : 'leona-aa'}-${m.id}.wav`)),
    m.wavSha256
  );
  assert.equal(
    digest(frozen(`.cache/leona-aa-audio-media-v1-20261024/${m.id}.wem`)),
    m.encodedSha256
  );
}
for (const c of ['export', 'optimizedExport'])
  assert.deepEqual(data(ledger.checks[c]), {
    result: 'passed',
    checkOnly: true,
    events: 10,
    containers: 8,
    media: 28,
    reusedQ: 7,
    newMasters: 21,
    totalMasterBytes: 3130340,
    newBytes: 2366276,
  });
const controls = data(ledger.checks.negative);
assert.equal(controls.length, 18);
assert.equal(controls.filter((r) => r.expectedPass).length, 2);
for (const r of controls) {
  assert.equal(r.returncode === 0, r.expectedPass, r.case);
  if (!r.expectedPass) assert.match(text(r.log), /ValueError/);
}
const guards = data(ledger.checks.decoderGuard);
assert.equal(guards.length, 2);
for (const g of guards) {
  assert.equal(g.returncode, 1);
  assert.equal(g.unchanged, true);
  assert.equal(g.files, 29);
  assert.match(text(g.log), /Refuse to overwrite retained AA decoded masters/);
}
assert.match(text(ledger.checks.standard), /1970 passed \(1970\)/);
assert.match(text(ledger.checks.standard), /320 passed \(320\)/);
assert.match(text(ledger.checks.standard), /pass 3/);
assert.match(text(ledger.checks.browser), /2 passed/);
assert.equal(text(ledger.checks.typecheck), '');
const pcm = data(ledger.checks.pcm);
assert.equal(pcm.length, 28);
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
assert.equal(manifest.files.length, 1052);
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
assert.equal(assets.publicFiles, 1005);
assert.equal(assets.unchanged, 984);
assert.deepEqual(assets.modified, []);
assert.deepEqual(assets.removed, []);
assert.deepEqual(
  assets.added,
  decoded.media
    .filter((m) => !shared.has(m.id))
    .map((m) => `public/assets/audio/leona-aa-${m.id}.wav`)
    .sort()
);
assert.equal(ledger.acceptance.sourceMastersPrepared, true);
for (const key of [
  'runtimeIntegrated',
  'nativeListeningVerified',
  'nativeDispatchVerified',
  'fullProjectComplete',
])
  assert.equal(ledger.acceptance[key], false);
console.log(
  JSON.stringify({
    result: 'passed',
    historical,
    events: 10,
    masters: 28,
    reusedQ: 7,
    units: 1970,
    browserCases: 2,
    files: manifest.files.length,
    ruleset: ledger.ruleset,
    pack: ledger.pack,
  })
);
