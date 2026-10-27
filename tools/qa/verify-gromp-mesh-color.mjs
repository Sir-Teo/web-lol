/** Check the audited mesh float color against host C and retain all other sampler state. */
import assert from 'node:assert/strict';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { rolldown } from 'rolldown';
import { grompRayReference } from './lib/prepare-gromp-ray-reference.mjs';
const { values } = parseArgs({ options: { 'output-dir': { type: 'string' } } }),
  output = resolve(values['output-dir'] ?? `.cache/gromp-mesh-${Date.now()}`);
assert(!existsSync(output), 'Use a fresh output directory');
mkdirSync(output, { recursive: true });
const reference = await grompRayReference(
    resolve(output, 'reference'),
    '891abcc0d25eb0dfbf2af7d18a62d8235fbb8d8c'
  ),
  entry = resolve(output, 'candidate.ts'),
  module = resolve(output, 'candidate.mjs');
writeFileSync(
  entry,
  [
    `export {grompDeathParticles} from ${JSON.stringify(resolve('src/render/gromp-death-particles.ts'))};`,
    `export {prepareLegacyParticleColor,sampleLegacyParticleColor} from ${JSON.stringify(resolve('src/render/legacy-particle-color.ts'))};`,
  ].join('\n')
);
const build = await rolldown({ input: entry, platform: 'node', external: ['three'] });
try {
  await build.write({ file: module, format: 'esm' });
} finally {
  await build.close();
}
const before = await import(pathToFileURL(reference.module).href),
  after = await import(pathToFileURL(module).href),
  requests = [],
  rows = [],
  counts = {},
  words = (values) =>
    values.map((value) => {
      const bytes = Buffer.alloc(4);
      bytes.writeFloatLE(value);
      return bytes.readUInt32LE().toString(16).padStart(8, '0');
    });
let samplerCalls = 0,
  unchangedOtherStates = 0;
for (const death of [0, 100, 65535])
  for (const id of [0, 1, 47, 91, 144, 312, 1337, 65535, 0xffffffff])
    for (let step = 0; step <= 610; step++) {
      const tick = death + step / 2,
        a = before.grompDeathParticles(death, tick, id),
        b = after.grompDeathParticles(death, tick, id);
      assert.equal(a.length, b.length);
      samplerCalls++;
      for (let i = 0; i < a.length; i++) {
        const old = a[i],
          current = b[i];
        if (current.profileIndex !== 6) {
          assert.deepEqual(current, old);
          unchangedOtherStates++;
          continue;
        }
        const { color: oldColor, ...oldFields } = old,
          { color: currentColor, ...currentFields } = current;
        assert.deepEqual(currentFields, oldFields);
        requests.push({ profileIndex: current.profileIndex, phase: current.phase });
        rows.push({ old, current, death, id, tick });
      }
    }
const retained = requests.length,
  curves = new Map(
    [6].map((index) => {
      const p = before.data.profiles[index];
      return [index, after.prepareLegacyParticleColor(p.color, p.colorCurve)];
    })
  );
assert.deepEqual(
  [6].map((index) => before.data.profiles[index].blend),
  [1]
);
for (const [profileIndex, curve] of curves)
  for (const key of curve)
    for (const delta of [-1, 0, 1]) {
      const bytes = Buffer.alloc(4);
      bytes.writeFloatLE(key.time);
      const value = bytes.readUInt32LE() + delta;
      if (value < 0 || value > 0x3f800000) continue;
      bytes.writeUInt32LE(value);
      requests.push({ profileIndex, phase: bytes.readFloatLE() });
    }
let random = 0x6d2b79f5;
for (const profileIndex of [6])
  for (let i = 0; i < 1000; i++) {
    random ^= random << 13;
    random ^= random >>> 17;
    random ^= random << 5;
    requests.push({ profileIndex, phase: (random >>> 0) / 4294967296 });
  }
const input = resolve(output, 'inputs.json'),
  expectedPath = resolve(output, 'expected.json');
writeFileSync(input, JSON.stringify(requests));
execFileSync('python3', ['tools/qa/lib/legacy-mesh-color-reference.py', input, expectedPath]);
const expected = JSON.parse(readFileSync(expectedPath)),
  examples = [];
assert.equal(expected.length, requests.length);
for (let i = 0; i < requests.length; i++) {
  const request = requests[i],
    e = expected[i],
    color = after.sampleLegacyParticleColor(curves.get(request.profileIndex), request.phase);
  assert.deepEqual(color, e.rgba);
  assert.deepEqual(words(color), e.words);
  assert.deepEqual([...new Float32Array(color)], e.rgba);
  if (i >= retained) continue;
  const row = rows[i];
  assert.deepEqual(row.current.color, e.rgba);
  const count = (counts[request.profileIndex] ??= {
    states: 0,
    changedFloat32ColorStates: 0,
    differentFromOldFloatTint: 0,
    maxFloat32ColorDelta: 0,
  });
  count.states++;
  if (words(row.old.color).some((v, lane) => v !== e.words[lane]))
    count.changedFloat32ColorStates++;
  const rgba = e.rgba,
    differs = rgba.some((v, lane) => v !== Math.fround(row.old.color[lane]));
  if (differs) count.differentFromOldFloatTint++;
  for (let lane = 0; lane < 4; lane++)
    count.maxFloat32ColorDelta = Math.max(
      count.maxFloat32ColorDelta,
      Math.abs(rgba[lane] - Math.fround(row.old.color[lane]))
    );
  if (differs && examples.filter((r) => r.profileIndex === request.profileIndex).length < 3)
    examples.push({
      ...request,
      death: row.death,
      id: row.id,
      tick: row.tick,
      before: row.old.color,
      rgba: e.rgba,
    });
}
const result = {
  result: 'passed',
  reference,
  samplerCalls,
  retainedMeshStates: retained,
  unchangedOtherStates,
  extraPhases: requests.length - retained,
  counts,
  examples,
  reading:
    'Profile6 float colors match independent host C; all other fields and all other profiles, including complex billboards, plane, Rays and Simple flash, match the frozen accepted source exactly. Full four-second mesh lifetime covered; lookup/atlas/geometry inputs and local clocks remain unchanged. Component acceptance, not native execution or full appearance parity.',
};
writeFileSync(resolve(output, 'reading.json'), JSON.stringify(result, null, 2) + '\n');
console.log(
  JSON.stringify({
    result: 'passed',
    samplerCalls,
    retainedMeshStates: retained,
    unchangedOtherStates,
    extraPhases: requests.length - retained,
    counts,
  })
);
