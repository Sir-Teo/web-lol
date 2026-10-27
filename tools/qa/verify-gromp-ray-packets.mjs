/** Compare retained Gromp state, raw-key float32 color and independent Ray packets. */
import assert from 'node:assert/strict';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { rolldown } from 'rolldown';
import { grompRayReference } from './lib/prepare-gromp-ray-reference.mjs';
const { values } = parseArgs({ options: { 'output-dir': { type: 'string' } } }),
  output = resolve(values['output-dir'] ?? `.cache/gromp-ray-${Date.now()}`);
assert(!existsSync(output));
mkdirSync(output, { recursive: true });
const reference = await grompRayReference(resolve(output, 'reference')),
  entry = resolve(output, 'candidate.ts'),
  module = resolve(output, 'candidate.mjs');
writeFileSync(
  entry,
  [
    `export {grompDeathParticles} from ${JSON.stringify(resolve('src/render/gromp-death-particles.ts'))};`,
    `export {writeRayColor} from ${JSON.stringify(resolve('src/render/particle-ray-color.ts'))};`,
    `export {particleHalf} from ${JSON.stringify(resolve('src/render/particle-half.ts'))};`,
    `export {prepareLegacyParticleColor,sampleLegacyParticleColor} from ${JSON.stringify(resolve('src/render/legacy-particle-color.ts'))};`,
  ].join('\n')
);
const bundle = await rolldown({ input: entry, platform: 'node', external: ['three'] });
try {
  await bundle.write({ file: module, format: 'esm' });
} finally {
  await bundle.close();
}
const before = await import(pathToFileURL(reference.module).href),
  after = await import(pathToFileURL(module).href),
  request = [],
  curveRequest = [],
  rows = [],
  counts = {};
const words = (values) =>
  values.map((value) => {
    const bytes = Buffer.alloc(4);
    bytes.writeFloatLE(value);
    return bytes.readUInt32LE().toString(16).padStart(8, '0');
  });
let samplerCalls = 0,
  nonRayStates = 0;
for (const death of [0, 100, 65535])
  for (const id of [0, 1, 47, 91, 144, 312, 1337, 65535, 0xffffffff])
    for (let step = 0; step <= 240; step++) {
      const tick = death + step / 2,
        a = before.grompDeathParticles(death, tick, id),
        b = after.grompDeathParticles(death, tick, id);
      assert.equal(b.length, a.length);
      samplerCalls++;
      for (let i = 0; i < a.length; i++) {
        const p = a[i],
          actual = b[i],
          profile = before.data.profiles[p.profileIndex];
        if (profile.kind !== 'ray') {
          assert.deepEqual(actual, p);
          nonRayStates++;
          continue;
        }
        const { color: oldColor, ...previousFields } = p,
          { color: newColor, ...actualFields } = actual;
        assert.deepEqual(actualFields, previousFields);
        request.push({
          kind: 'ray',
          cell: [p.frame / 4, 0],
          lookup: [p.phase, 0.5],
          color: oldColor,
          blend: profile.blend,
        });
        curveRequest.push({ profileIndex: p.profileIndex, phase: p.phase });
        rows.push({ before: p, after: actual, death, id, tick });
      }
    }
const retainedRows = curveRequest.length,
  curves = new Map(
    [5, 7].map((index) => {
      const p = before.data.profiles[index];
      return [index, after.prepareLegacyParticleColor(p.color, p.colorCurve)];
    })
  );
const neighbour = (value, delta) => {
  const bytes = Buffer.alloc(4);
  bytes.writeFloatLE(value);
  bytes.writeUInt32LE(bytes.readUInt32LE() + delta);
  return bytes.readFloatLE();
};
for (const [index, curve] of curves)
  for (const key of curve)
    for (const phase of [
      key.time,
      ...(key.time > 0 ? [neighbour(key.time, -1)] : []),
      neighbour(key.time, 1),
    ])
      if (phase >= 0 && phase <= 1) curveRequest.push({ profileIndex: index, phase });
let randomState = 0x6d2b79f5;
for (const profileIndex of [5, 7])
  for (let i = 0; i < 1000; i++) {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    curveRequest.push({ profileIndex, phase: (randomState >>> 0) / 4294967296 });
  }
const input = resolve(output, 'packet-inputs.json'),
  expectedPath = resolve(output, 'packet-expected.json'),
  curveInput = resolve(output, 'curve-inputs.json'),
  curveOutput = resolve(output, 'curve-expected.json');
writeFileSync(input, JSON.stringify(request));
writeFileSync(curveInput, JSON.stringify(curveRequest));
execFileSync('python3', ['tools/qa/lib/primary-hit-packet-reference.py', input, expectedPath]);
execFileSync('python3', ['tools/qa/lib/legacy-ray-color-reference.py', curveInput, curveOutput]);
const expected = JSON.parse(readFileSync(expectedPath)),
  colorExpected = JSON.parse(readFileSync(curveOutput)),
  examples = [];
assert.equal(expected.length, rows.length);
assert.equal(colorExpected.length, curveRequest.length);
for (const [i, row] of rows.entries()) {
  const p = row.after,
    old = row.before,
    e = expected[i],
    color = colorExpected[i],
    profile = before.data.profiles[p.profileIndex],
    bytes = new Uint8Array(32).fill(173);
  assert.deepEqual(p.color, color.rgba);
  assert.deepEqual(words(p.color), color.words);
  after.writeRayColor(bytes, 1, 6, Object.freeze(p.color), profile.blend);
  assert.deepEqual(
    [...bytes],
    [173, 173, 173, 173, ...Array.from({ length: 6 }, () => color.bgra).flat(), 173, 173, 173, 173]
  );
  assert.deepEqual([after.particleHalf(p.phase), 0.5], e.lookup);
  const count = (counts[p.profileIndex] ??= {
    states: 0,
    changedColorTuples: 0,
    changedFloat32ColorStates: 0,
    changedPackets: 0,
    maxByteDelta: 0,
  });
  count.states++;
  if (!p.color.every((v, lane) => Object.is(v, old.color[lane]))) count.changedColorTuples++;
  if (words(old.color).some((v, lane) => v !== color.words[lane]))
    count.changedFloat32ColorStates++;
  const oldRgba = e.color.map((v) => Math.round(v * 255)),
    oldBgra = [oldRgba[2], oldRgba[1], oldRgba[0], oldRgba[3]];
  if (color.bgra.some((v, lane) => v !== oldBgra[lane])) {
    count.changedPackets++;
    count.maxByteDelta = Math.max(
      count.maxByteDelta,
      ...color.bgra.map((v, lane) => Math.abs(v - oldBgra[lane]))
    );
    examples.push({
      death: row.death,
      id: row.id,
      tick: row.tick,
      ordinal: p.ordinal,
      profileIndex: p.profileIndex,
      phase: p.phase,
      beforeBgra: oldBgra,
      afterBgra: color.bgra,
    });
  }
}
for (let i = retainedRows; i < curveRequest.length; i++) {
  const row = curveRequest[i],
    e = colorExpected[i],
    color = after.sampleLegacyParticleColor(curves.get(row.profileIndex), row.phase),
    bytes = new Uint8Array(4);
  assert.deepEqual(color, e.rgba);
  assert.deepEqual(words(color), e.words);
  after.writeRayColor(bytes, 0, 1, Object.freeze(color), row.profileIndex === 5 ? 1 : 0);
  assert.deepEqual([...bytes], e.bgra);
}
assert.equal(samplerCalls, 6507);
assert.equal(nonRayStates, 255500);
assert.equal(rows.length, 59204);
assert.equal(curveRequest.length - retainedRows, 2017);
assert.deepEqual(Object.keys(counts), ['5', '7']);
assert.equal(counts[5].changedFloat32ColorStates, 18085);
assert.equal(counts[7].changedFloat32ColorStates, 8733);
assert.equal(counts[5].changedPackets, 0);
assert.equal(counts[7].changedPackets, 1);
assert.equal(counts[7].maxByteDelta, 1);
const reading = {
  reference,
  samplerCalls,
  nonRayStates,
  rayStates: rows.length,
  additionalCurvePhases: curveRequest.length - retainedRows,
  counts,
  examples,
  allNonRayStatesExact: true,
  allOtherRayFieldsExact: true,
  allRayColorWordsExact: true,
  independentPacketProjectionExact: true,
  atlasAndLookupUnchanged: true,
  limits: [
    'Conditional raw-key color and Ray packet components at retained local phases and unit birth/external colors; native live dispatch, backing-store mode and later cache mutation unobserved.',
    'Native actor clocks, external modifiers, texture binding, UV routing, sampling and complete composition remain unresolved.',
  ],
};
writeFileSync(resolve(output, 'reading.json'), JSON.stringify(reading, null, 2) + '\n');
console.log(JSON.stringify(reading));
