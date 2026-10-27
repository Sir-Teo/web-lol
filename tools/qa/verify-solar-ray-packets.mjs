/** Compare Solar samplers with frozen source and independent C/Python ray packets. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { rolldown } from 'rolldown';
import { solarRayReference } from './lib/prepare-solar-ray-reference.mjs';
const { values } = parseArgs({ options: { 'output-dir': { type: 'string' } } }),
  output = resolve(values['output-dir'] ?? `.cache/solar-ray-packets-${Date.now()}`),
  sha = (raw) => createHash('sha256').update(raw).digest('hex');
assert(!existsSync(output), 'Use a fresh evidence directory');
mkdirSync(output, { recursive: true });
const reference = await solarRayReference(resolve(output, 'reference'));
assert(
  readFileSync(resolve(output, 'reference/source/src/content/leona-r-particles.json')).equals(
    readFileSync('src/content/leona-r-particles.json')
  ),
  'Source profiles changed'
);
const entry = resolve(output, 'candidate.ts'),
  module = resolve(output, 'candidate.mjs');
writeFileSync(
  entry,
  [
    `export {solarParticles,SOLAR_PROFILES} from ${JSON.stringify(resolve('src/render/leona-solar-particles.ts'))};`,
    `export {LeonaSolarSurfaces} from ${JSON.stringify(resolve('src/render/leona-solar-surfaces.ts'))};`,
    `export {particleUnorm8} from ${JSON.stringify(resolve('src/render/particle-unorm8.ts'))};`,
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
  THREE = await import('three'),
  controller = new after.LeonaSolarSurfaces(new THREE.Scene(), new THREE.Scene(), () => 0),
  policy = controller.program;
controller.dispose();
const cases = [],
  request = [],
  families = {};
let samplerCalls = 0,
  nonRayStates = 0,
  otherRayFields = 0;
for (const role of ['buff', 'cast', 'contact', 'area-green', 'area-red', 'impact'])
  for (const seed of [0, 1, 47, 91, 144, 312, 1337, 65535, 0xffffffff])
    for (let tick = 0; tick <= 180; tick++) {
      const time = tick / 120,
        a = before.solarParticles(role, seed, time),
        b = after.solarParticles(role, seed, time);
      samplerCalls++;
      assert.equal(b.length, a.length);
      for (let i = 0; i < a.length; i++) {
        const p = after.SOLAR_PROFILES[a[i].profileIndex];
        if (p.kind !== 'ray') {
          assert.deepEqual(b[i], a[i]);
          assert.equal(policy.vertexColor(a[i].profileIndex), undefined);
          nonRayStates++;
          continue;
        }
        assert.deepEqual({ ...b[i], lookup: a[i].lookup }, a[i]);
        otherRayFields++;
        assert.equal(policy.vertexColor(a[i].profileIndex), 'bgra-unorm8');
        cases.push({ original: a[i], candidate: b[i], profile: p, seed, time });
        request.push({
          kind: 'ray',
          cell: a[i].uv.cell,
          lookup: a[i].lookup,
          color: a[i].color,
          blend: p.blend,
        });
      }
    }
writeFileSync(resolve(output, 'packet-inputs.json'), JSON.stringify(request));
execFileSync('python3', [
  'tools/qa/lib/primary-hit-packet-reference.py',
  resolve(output, 'packet-inputs.json'),
  resolve(output, 'packet-expected.json'),
]);
const expected = JSON.parse(readFileSync(resolve(output, 'packet-expected.json')));
assert.equal(expected.length, cases.length);
for (let i = 0; i < cases.length; i++) {
  const row = cases[i],
    e = expected[i],
    p = row.candidate,
    packed = policy.tint(p.profileIndex, p.color) ?? p.color,
    count = (families[p.profileIndex] ??= {
      role: row.profile.role,
      blend: row.profile.blend,
      samples: 0,
      changedColors: 0,
      changedLookups: 0,
    });
  count.samples++;
  assert.deepEqual(p.lookup, e.lookup);
  assert.deepEqual(packed.map(after.particleUnorm8), e.color);
  if (JSON.stringify(row.original.color) !== JSON.stringify(e.color)) count.changedColors++;
  if (JSON.stringify(row.original.lookup) !== JSON.stringify(e.lookup)) count.changedLookups++;
}
assert.deepEqual(Object.keys(families), ['11', '17', '23']);
assert(
  Object.values(families).every((r) => r.samples > 0 && r.changedColors > 0 && r.changedLookups > 0)
);
const sources = [
  'src/render/leona-solar-particles.ts',
  'src/render/leona-solar-surfaces.ts',
  'src/render/source-particle-surfaces.ts',
  'src/render/particle-unorm8.ts',
  'src/render/particle-half.ts',
  'src/content/leona-r-particles.json',
  'docs/reference/leona-r-particles.json',
  'docs/reference/native-ray-packet.json',
  'docs/reference/native-particle-vertex-format.json',
  'tools/qa/lib/primary-hit-packet-reference.py',
];
const reading = {
  reference,
  samplerCalls,
  nonRayStates,
  otherRayFields,
  rayStates: cases.length,
  families,
  allOtherRayFieldsExact: true,
  rawSourceColorsExact: true,
  nonRayFieldsExact: true,
  independentPacketProjectionExact: true,
  candidateModuleSha256: sha(readFileSync(module)),
  sourceFiles: sources.map((path) => ({ path, sha256: sha(readFileSync(path)) })),
  producerSha256: sha(readFileSync(new URL(import.meta.url))),
  limits: [
    'Packet conversions applied to retained local source curves and clocks; no native game or shader execution.',
    'Three rays have unit static UV transforms and no multiplier; mode0 premultiplies float32 RGB by alpha and sets packet alpha1; mode4 retains RGBA.',
    'Actual live native dispatch, external modifiers, FPCR and inherited transforms remain unobserved.',
  ],
};
writeFileSync(resolve(output, 'reading.json'), JSON.stringify(reading, null, 2) + '\n');
console.log(JSON.stringify(reading));
