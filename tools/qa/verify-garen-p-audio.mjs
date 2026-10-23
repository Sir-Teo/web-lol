/** Source identities + decoded PCM/scheduling evidence; not native listening parity. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const read = (p) => JSON.parse(readFileSync(p, 'utf8')),
  hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const evidence = read('docs/reference/garen-p-audio-verification.json'),
  graph = read('docs/reference/garen-p-audio.json'),
  decoded = read('docs/reference/garen-p-audio-decoded.json'),
  reading = read('docs/reference/garen-p-audio-reading.json'),
  extraction = read('docs/reference/garen-audio-extraction.json');
for (const f of evidence.files) assert.equal(hash(f.path), f.sha256, f.path);
assert.equal(evidence.schema, 112);
assert.equal(evidence.ruleset, rulesetFingerprint());
assert.equal(graph.extractionSha256, hash('docs/reference/garen-audio-extraction.json'));
assert.equal(graph.referenceSha256, hash('docs/reference/garen-model.json'));
assert.equal(decoded.sourceGraphSha256, hash('docs/reference/garen-p-audio.json'));
assert.equal(hash(reading.path), reading.sha256);
for (const f of extraction.files)
  assert.equal(hash('.cache/garen-audio-sources/' + f.path), f.sha256);
for (const m of decoded.media) {
  assert.equal(hash(`.cache/garen-p-audio-media/${m.id}.wem`), m.encodedSha256);
  assert.equal(hash(`public/assets/audio/garen-p-${m.id}.wav`), m.wavSha256);
}
assert.equal(graph.events.length, 3);
assert.equal(graph.nodes.length, 14);
assert.equal(graph.media.length, 2);
assert.deepEqual(graph.unresolvedHierarchyIds, [1259461568]);
const pcm = read('artifacts/garen-p-audio-decoding.json');
assert.equal(pcm.length, 2);
for (const r of pcm) {
  const clip = decoded.media.find((m) => m.frames === r.frames);
  assert(clip);
  assert.equal(r.wav, clip.wavSha256);
  assert.equal(r.pcm, clip.pcmSha256);
  assert.equal(r.differences, 0);
  assert.equal(r.rate, 44100);
  assert.equal(r.channels, 1);
  assert.equal(r.peak, clip.peak);
}
const scheduling = read('artifacts/garen-p-audio-scheduling.json');
assert.deepEqual(
  scheduling.calls.map((c) => c.kind),
  ['onset', 'active']
);
assert.equal(scheduling.calls[0].when, scheduling.calls[1].when);
assert(scheduling.minionHeld && scheduling.moved.sameRamps);
assert.equal(scheduling.synth, 0);
const active = scheduling.begin.find((v) => v.kind === 'active');
assert.equal(active.loop, true);
assert.equal(active.loopStart, 0);
assert.equal(active.frames, 165832);
assert.equal(active.loopEnd, 165832 / 44100);
assert.equal(active.sets[0][0], 0.5);
assert.equal(active.ramps[0][0], 1);
const reload = read('artifacts/garen-p-audio-reload.json');
assert(reload.restored && reload.prepared.noPauseDuplicate);
assert.equal(reload.prepared.muted, 0);
assert.equal(reload.prepared.paused, 'suspended');
assert.equal(reload.calls.length, 1);
assert.equal(reload.calls[0].offset, 190 / 60);
const fog = read('artifacts/garen-p-audio-fog.json'),
  failure = read('artifacts/garen-p-audio-failure.json'),
  terminal = read('artifacts/garen-p-audio-terminal.json');
assert.equal(fog.hidden, 0);
assert.equal(fog.suppressed, 0);
assert.equal(fog.shown.length, 1);
assert.equal(fog.shown[0].kind, 'active');
assert.equal(fog.requests, 2);
assert.equal(failure.status, 'failed');
assert.equal(failure.calls, 0);
assert.equal(failure.synth, 0);
assert.equal(failure.attempts, 1);
assert.equal(failure.retryRequests, 1);
assert.equal(failure.recovered.status, 'ready');
assert(failure.recovered.unchanged);
assert.equal(failure.recovered.calls.length, 2);
assert.deepEqual(terminal, { calls: 2, before: 2, voices: 0, unchanged: true });
const particles = read('artifacts/garen-p-audio-regression-garen-passive-source-recovery.json'),
  batch = read('artifacts/garen-p-audio-regression-garen-passive-source-batch.json');
assert.deepEqual(particles.after, { different: 0, buffers: true, snapshot: true });
assert.equal(batch.length, 13);
assert(batch.every((s) => s.delta === 0));
assert.match(readFileSync(evidence.checks.unit.log, 'utf8'), /1414 passed/);
assert.match(readFileSync(evidence.checks.unit.log, 'utf8'), /259 passed/);
assert.match(readFileSync(evidence.checks.chrome.log, 'utf8'), /35 passed/);
assert.equal(evidence.checks.production.result, 'passed');
assert.equal(evidence.checks.production.recordings, 32);
assert.equal(evidence.checks.production.developmentHook, false);
assert.equal(evidence.checks.production.garenFixtureInProduction, false);
assert.equal(evidence.normalRulesMatches.rerun, false);
console.log(
  JSON.stringify({
    result: 'passed',
    schema: evidence.schema,
    ruleset: evidence.ruleset,
    references: evidence.files.length + extraction.files.length + decoded.media.length * 2 + 1,
    events: 3,
    nodes: 14,
    media: 2,
    exactBrowserPCM: 2,
    chromeCases: 35,
  })
);
