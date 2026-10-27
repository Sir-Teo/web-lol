/** Compare unchanged Gromp source sampling and independent Ray packet projection. */
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
  rows = [],
  counts = {};
let samplerCalls = 0,
  nonRayStates = 0;
for (const death of [0, 100, 65535])
  for (const id of [0, 1, 47, 91, 144, 312, 1337, 65535, 0xffffffff])
    for (let step = 0; step <= 240; step++) {
      const tick = death + step / 2,
        a = before.grompDeathParticles(death, tick, id),
        b = after.grompDeathParticles(death, tick, id);
      assert.deepEqual(b, a);
      samplerCalls++;
      for (const p of a) {
        const profile = before.data.profiles[p.profileIndex];
        if (profile.kind !== 'ray') {
          nonRayStates++;
          continue;
        }
        request.push({
          kind: 'ray',
          cell: [p.frame / 4, 0],
          lookup: [p.phase, 0.5],
          color: p.color,
          blend: profile.blend,
        });
        rows.push(p);
      }
    }
const input = resolve(output, 'packet-inputs.json'),
  expectedPath = resolve(output, 'packet-expected.json');
writeFileSync(input, JSON.stringify(request));
execFileSync('python3', ['tools/qa/lib/primary-hit-packet-reference.py', input, expectedPath]);
const expected = JSON.parse(readFileSync(expectedPath));
for (const [i, p] of rows.entries()) {
  const e = expected[i],
    profile = before.data.profiles[p.profileIndex],
    bytes = new Uint8Array(32).fill(173),
    rgba = e.color.map((v) => Math.round(v * 255));
  after.writeRayColor(bytes, 1, 6, Object.freeze(p.color), profile.blend);
  assert.deepEqual(
    [...bytes],
    [
      173,
      173,
      173,
      173,
      ...Array.from({ length: 6 }, () => [rgba[2], rgba[1], rgba[0], rgba[3]]).flat(),
      173,
      173,
      173,
      173,
    ]
  );
  assert.deepEqual([after.particleHalf(p.phase), 0.5], e.lookup);
  const count = (counts[p.profileIndex] ??= { states: 0, changedColors: 0, changedLookups: 0 });
  count.states++;
  const old = [...p.color];
  if (profile.blend === 0) {
    for (let lane = 0; lane < 3; lane++) old[lane] *= old[3];
    old[3] = 1;
  }
  if (e.color.some((v, lane) => v !== Math.fround(old[lane]))) count.changedColors++;
  if (e.lookup[0] !== Math.fround(p.phase)) count.changedLookups++;
}
assert.deepEqual(Object.keys(counts), ['5', '7']);
assert(Object.values(counts).every((p) => p.changedColors > 0 && p.changedLookups > 0));
const reading = {
  reference,
  samplerCalls,
  nonRayStates,
  rayStates: rows.length,
  counts,
  allSamplerStatesExact: true,
  independentPacketProjectionExact: true,
  limits: [
    'Conditional Ray packet projection from retained local values; native prepared-color producer and actual native draw dispatch unobserved.',
    'Legacy native texture binding, UV routing, sampling and complete composition remain unresolved. Existing local textures, curves, clocks and geometry are preserved.',
  ],
};
writeFileSync(resolve(output, 'reading.json'), JSON.stringify(reading, null, 2) + '\n');
console.log(JSON.stringify(reading));
