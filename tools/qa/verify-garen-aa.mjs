/** Source closure and local behavior evidence, not native listening/visual parity. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { rulesetFingerprint } from '../ruleset-fingerprint.ts';
const read = (p) => JSON.parse(readFileSync(p, 'utf8')),
  hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const e = read('docs/reference/garen-aa-verification.json'),
  g = read('docs/reference/garen-aa-audio.json'),
  d = read('docs/reference/garen-aa-audio-decoded.json'),
  r = read('docs/reference/garen-aa-source-reading.json'),
  banks = read('docs/reference/garen-audio-extraction.json');
for (const f of e.files) assert.equal(hash(f.path), f.sha256, f.path);
assert.equal(e.schema, 113);
assert.equal(e.ruleset, rulesetFingerprint());
assert.equal(g.events.length, 6);
assert.equal(g.events.flatMap((v) => v.actions).length, 8);
assert.equal(g.nodes.length, 105);
assert.equal(g.media.length, 34);
assert.deepEqual(g.unresolvedHierarchyIds, [211064428]);
assert.equal(d.sourceGraphSha256, hash('docs/reference/garen-aa-audio.json'));
assert.equal(g.extractionSha256, hash('docs/reference/garen-audio-extraction.json'));
assert.equal(g.referenceSha256, hash('docs/reference/garen-model.json'));
assert.equal(r.characterSha256, hash('docs/reference/garen-character.json'));
assert.equal(r.firstAttackAnimationOverride, null);
assert.equal(r.firstAttackLocalClip, 'Attack1');
for (const f of banks.files) assert.equal(hash('.cache/garen-audio-sources/' + f.path), f.sha256);
for (const m of d.media) {
  assert.equal(hash(`.cache/garen-aa-audio-media/${m.id}.wem`), m.encodedSha256);
  assert.equal(hash(`public/assets/audio/garen-aa-${m.id}.wav`), m.wavSha256);
}
for (const s of r.skinMaterials) {
  assert.equal(hash(s.path), s.sha256, s.path);
  let value = read(s.path);
  for (const key of s.recordPath) value = value[key];
  assert.equal(value.armorMaterial, s.material);
}
assert.equal(r.skinMaterials.length, 29);
const pcm = read('artifacts/garen-aa-decoding.json');
assert.equal(pcm.length, 34);
for (const p of pcm) {
  const m = d.media.find((m) => m.id === p.id);
  assert(m);
  assert.equal(p.frames, m.frames);
  assert.equal(p.rate, 44100);
  assert.equal(p.channels, 1);
  assert.equal(p.differences, 0);
  assert.equal(p.peak, m.peak);
  assert.equal(p.wav, m.wavSha256);
  assert.equal(p.pcm, m.pcmSha256);
}
const material = read('artifacts/garen-aa-materials.json');
assert.equal(material.synth, 0);
assert.equal(material.cases.length, 5);
for (const c of material.cases) {
  assert.equal(c.kind, c.want);
  assert.equal(c.clip, c.want);
  assert.equal(c.impact.material, c.material);
  assert.equal(c.calls.length, 2);
}
const cancel = read('artifacts/garen-aa-cancel.json');
assert(cancel.cancelled.cancelTick !== null);
assert.equal(cancel.cancelled.impact, null);
assert.equal(cancel.cancelled.calls.length, 1);
assert.equal(cancel.qAttacks, 1);
assert.equal(cancel.newCalls, 0);
const reload = read('artifacts/garen-aa-reload.json');
assert(reload.identicalSnapshot);
assert.equal(reload.restored.length, 1);
assert.equal(reload.restored[0].offset, 5 / 60);
assert.equal(reload.impact.material, 'Metal');
const fog = read('artifacts/garen-aa-fog-lethal.json');
assert.equal(fog.hidden, 0);
assert.equal(fog.dead, true);
assert.equal(fog.vision, false);
assert(!fog.audiences.cast.includes('blue'));
assert(fog.audiences.hit.includes('blue'));
assert.equal(fog.after.length, 1);
assert.equal(fog.later, 1);
const critical = read('artifacts/garen-aa-critical.json');
assert.equal(critical.prepared.kind, 'crit');
assert.equal(critical.prepared.calls.length, 4);
assert.deepEqual(critical.after, { calls: 4, voices: 0, unchanged: true });
assert(critical.prepared.calls.some((c) => Math.abs(c.rate - 2 ** (-500 / 1200)) < 1e-6));
assert(critical.prepared.calls.some((c) => Math.abs(c.rate - 2 ** (-100 / 1200)) < 1e-6));
const fail = read('artifacts/garen-aa-failure.json');
assert.equal(fail.failed.status, 'failed');
assert.equal(fail.failed.synth, 1);
assert.equal(fail.failed.calls, 0);
assert.equal(fail.recovered.status, 'ready');
assert.equal(fail.recovered.oldCalls, 0);
assert.equal(fail.recovered.calls.length, 2);
assert.equal(fail.recovered.synth, 1);
assert.equal(fail.requests, 35);
assert.deepEqual(read('artifacts/garen-aa-late-presence.json'), {
  requests: 34,
  uniqueMedia: 34,
  initial: 0,
});
assert.match(readFileSync(e.checks.unit.log, 'utf8'), /1422 passed/);
assert.match(readFileSync(e.checks.unit.log, 'utf8'), /260 passed/);
assert.match(readFileSync(e.checks.chrome.log, 'utf8'), /50 passed/);
assert.equal(e.checks.production.result, 'passed');
assert.equal(e.checks.production.recordings, 32);
assert.equal(e.checks.production.garenFixtureInProduction, false);
assert.equal(e.checks.production.developmentHook, false);
assert.equal(e.normalRulesMatches.rerun, false);
console.log(
  JSON.stringify({
    result: 'passed',
    schema: e.schema,
    ruleset: e.ruleset,
    references: e.files.length + banks.files.length + d.media.length * 2 + r.skinMaterials.length,
    events: 6,
    actions: 8,
    profiles: 17,
    exactDecodedMasters: 34,
    chromeCases: 50,
  })
);
