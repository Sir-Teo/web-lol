/** Independent retained-state and C/Python packet comparison for five modern rays. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { rolldown } from 'rolldown';
import { remainingRayReference } from './lib/prepare-remaining-ray-reference.mjs';
const { values } = parseArgs({ options: { 'output-dir': { type: 'string' } } }),
  output = resolve(values['output-dir'] ?? `.cache/remaining-ray-check-${Date.now()}`),
  sha = (raw) => createHash('sha256').update(raw).digest('hex');
assert(!existsSync(output), 'Use a fresh evidence directory');
mkdirSync(output, { recursive: true });
const reference = await remainingRayReference(resolve(output, 'reference'));
for (const file of [
  'leona-w-particles.json',
  'garen-aa-particles.json',
  'garen-q-impact-particles.json',
  'garen-r-particles.json',
])
  assert(
    readFileSync(resolve(output, 'reference/source/src/content', file)).equals(
      readFileSync(resolve('src/content', file))
    ),
    'Authored profile changed'
  );
const entry = resolve(output, 'candidate.ts'),
  module = resolve(output, 'candidate.mjs');
writeFileSync(
  entry,
  [
    `export {eclipseParticles,ECLIPSE_PROFILES} from ${JSON.stringify(resolve('src/render/leona-eclipse-particles.ts'))};`,
    `export {garenAAParticles} from ${JSON.stringify(resolve('src/render/garen-aa-particles.ts'))};`,
    `export {garenQImpactParticles} from ${JSON.stringify(resolve('src/render/garen-q-impact-particles.ts'))};`,
    `export {garenJusticeParticles} from ${JSON.stringify(resolve('src/render/garen-justice-particles.ts'))};`,
    `export {writeRayColor} from ${JSON.stringify(resolve('src/render/particle-ray-color.ts'))};`,
    `export {createGarenAAMaterial} from ${JSON.stringify(resolve('src/render/garen-basic-attacks.ts'))};`,
    `export {createGarenQImpactMaterial} from ${JSON.stringify(resolve('src/render/garen-decisive-strike.ts'))};`,
    `export {createGarenJusticeMaterial} from ${JSON.stringify(resolve('src/render/garen-justice.ts'))};`,
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
  cases = [],
  families = {};
let samplerCalls = 0,
  nonRayStates = 0;
const baseAA = {
    startTick: 100,
    endTick: 160,
    releaseTick: 129,
    poseStopTick: null,
    impact: { tick: 129, radius: 30 },
    kind: 'attack1',
  },
  q = [
    {
      startTick: 100,
      attacks: [{ startTick: 110, impact: { tick: 129, point: { x: 100, y: 30 }, facing: 1.2 } }],
    },
  ],
  r = {
    startTick: 100,
    targetId: 2,
    facing: 0.2,
    point: { x: 200, y: 0 },
    releaseTick: 127,
    stopTick: null,
    killed: true,
  };
for (const seed of [0, 1, 47, 91, 144, 312, 1337, 65535, 0xffffffff])
  for (let tick = 0; tick <= 180; tick++) {
    const time = tick / 120,
      specs = [
        ['W-initial', before.ECLIPSE_PROFILES, 'eclipseParticles', ['buff-initial', seed, time]],
        ['W-extended', before.ECLIPSE_PROFILES, 'eclipseParticles', ['buff-extended', seed, time]],
        ...['attack1', 'attack2', 'crit'].map((kind) => [
          'AA-' + kind,
          before.aaData.profiles,
          'garenAAParticles',
          [seed, [{ ...baseAA, kind }], 129 + time * 60],
        ]),
        ['Q', before.qProfiles, 'garenQImpactParticles', [seed, q, 129 + time * 60]],
        ['R', before.rProfiles, 'garenJusticeParticles', [seed, r, 127 + time * 60]],
      ];
    for (const [family, profiles, name, args] of specs) {
      samplerCalls++;
      const a = before[name](...args),
        b = after[name](...args);
      assert.equal(b.length, a.length);
      for (let i = 0; i < a.length; i++) {
        const p = profiles[a[i].profileIndex];
        if (p.kind !== 'ray') {
          assert.deepEqual(b[i], a[i]);
          nonRayStates++;
          continue;
        }
        assert.deepEqual({ ...b[i], lookup: a[i].lookup }, a[i]);
        cases.push({
          family,
          seed,
          time,
          profileIndex: a[i].profileIndex,
          blend: p.blend,
          original: a[i],
          candidate: b[i],
        });
        request.push({
          kind: 'ray',
          cell: a[i].uv?.cell ?? [0, 0],
          lookup: a[i].lookup,
          color: a[i].color,
          blend: p.blend,
        });
      }
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
    bytes = new Uint8Array(12).fill(173);
  after.writeRayColor(bytes, 1, 1, row.candidate.color, row.blend);
  const rgba = e.color.map((v) => Math.round(v * 255));
  assert.deepEqual(
    [...bytes],
    [173, 173, 173, 173, rgba[2], rgba[1], rgba[0], rgba[3], 173, 173, 173, 173]
  );
  assert.deepEqual(row.candidate.lookup, e.lookup);
  const key = row.family + ':' + row.profileIndex,
    count = (families[key] ??= {
      samples: 0,
      changedColors: 0,
      changedLookups: 0,
      blend: row.blend,
    });
  count.samples++;
  if (JSON.stringify(e.color) !== JSON.stringify(row.original.color)) count.changedColors++;
  if (JSON.stringify(e.lookup) !== JSON.stringify(row.original.lookup)) count.changedLookups++;
}
const THREE = await import('three'),
  white = new THREE.Texture();
for (const [name, index] of [
  ['createGarenAAMaterial', 9],
  ['createGarenQImpactMaterial', 3],
  ['createGarenJusticeMaterial', 18],
]) {
  const material = after[name](index, white, white);
  assert.equal(material.defines.VERTEX_BGRA, 1);
  assert.equal(material.defines.VERTEX_TINT, 1);
  material.dispose();
}
white.dispose();
assert.equal(Object.keys(families).length, 5);
assert(
  Object.values(families).every((r) => r.samples > 0 && r.changedColors > 0 && r.changedLookups > 0)
);
const reading = {
  reference,
  samplerCalls,
  nonRayStates,
  rayStates: cases.length,
  families,
  rawSourceColorsExact: true,
  allOtherRayFieldsExact: true,
  independentPacketProjectionExact: true,
  actualGarenMaterialFlagsChecked: true,
  candidateModuleSha256: sha(readFileSync(module)),
  producerSha256: sha(readFileSync(new URL(import.meta.url))),
  limits: [
    'Finite native Ray packet conversions applied to retained local source values; no native game or Metal execution.',
    'Five modern BIN-backed rays only. Legacy Gromp Troy p-type mappings remain outside this correction.',
    'Source clocks, RNG, curve arithmetic, external modifiers and actual native dispatch remain unobserved.',
  ],
};
writeFileSync(resolve(output, 'reading.json'), JSON.stringify(reading, null, 2) + '\n');
console.log(JSON.stringify(reading));
