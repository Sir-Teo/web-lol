/** Compare Meditate samplers against frozen source and independent C/Python ray packets. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { rolldown } from 'rolldown';
import { meditateRayReference } from './lib/prepare-meditate-ray-reference.mjs';
const { values } = parseArgs({ options: { 'output-dir': { type: 'string' } } }),
  output = resolve(values['output-dir'] ?? `.cache/meditate-ray-packets-${Date.now()}`),
  sha = (raw) => createHash('sha256').update(raw).digest('hex');
assert(!existsSync(output), 'Use a fresh packet evidence directory');
mkdirSync(output, { recursive: true });
const reference = await meditateRayReference(resolve(output, 'reference'));
for (const file of ['masteryi-w-cast-particles.json', 'masteryi-w-buff-particles.json'])
  assert(
    readFileSync(resolve(output, 'reference/source/src/content', file)).equals(
      readFileSync(resolve('src/content', file))
    ),
    'Source profile changed'
  );
const entry = resolve(output, 'candidate.ts'),
  module = resolve(output, 'candidate.mjs');
writeFileSync(
  entry,
  [
    `export {meditateCastParticles} from ${JSON.stringify(resolve('src/render/masteryi-w-cast-particles.ts'))};`,
    `export {meditateBuffParticles} from ${JSON.stringify(resolve('src/render/masteryi-w-buff-particles.ts'))};`,
    `export {particleUnorm8} from ${JSON.stringify(resolve('src/render/particle-unorm8.ts'))};`,
  ].join('\n') + '\n'
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
for (const family of ['Cast', 'Buff']) {
  const data = before[family === 'Cast' ? 'castData' : 'buffData'];
  for (const seed of [0, 1, 47, 91, 144, 312, 1337, 65535, 0xffffffff])
    for (let tick = 0; tick <= 120; tick++) {
      const time = tick / 120,
        original = before[`meditate${family}Particles`](seed, time),
        candidate = after[`meditate${family}Particles`](seed, time);
      samplerCalls++;
      assert.equal(candidate.length, original.length);
      for (let i = 0; i < original.length; i++) {
        const a = original[i],
          b = candidate[i],
          p = data.profiles[a.profileIndex];
        if (p.kind !== 'ray') {
          assert.deepEqual(b, a);
          nonRayStates++;
          continue;
        }
        assert.deepEqual(
          { ...b, lookup: a.lookup },
          a,
          `${family} ray state seed${seed} time${time}`
        );
        cases.push({ family, seed, time, original: a, candidate: b });
        request.push({ kind: 'ray', cell: a.uv.cell, lookup: a.lookup, color: a.color });
      }
    }
}
writeFileSync(resolve(output, 'packet-inputs.json'), JSON.stringify(request) + '\n');
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
    count = (families[row.family] ??= { samples: 0, changedColors: 0, changedLookups: 0 });
  count.samples++;
  assert.deepEqual(
    row.candidate.lookup,
    e.lookup,
    `${row.family} lookup seed${row.seed} time${row.time}`
  );
  assert.deepEqual(
    row.candidate.color.map(after.particleUnorm8),
    e.color,
    `${row.family} color seed${row.seed} time${row.time}`
  );
  if (JSON.stringify(row.original.color) !== JSON.stringify(e.color)) count.changedColors++;
  if (JSON.stringify(row.original.lookup) !== JSON.stringify(e.lookup)) count.changedLookups++;
}
assert.equal(cases.length, 1062);
assert.equal(samplerCalls, 2178);
assert.equal(families.Cast.changedColors, 306);
assert.equal(families.Buff.changedColors, 531);
assert.equal(families.Cast.changedLookups, 513);
assert.equal(families.Buff.changedLookups, 504);
const sources = [
  'src/render/masteryi-w-cast-particles.ts',
  'src/render/masteryi-w-buff-particles.ts',
  'src/render/masteryi-w-casts.ts',
  'src/render/masteryi-w-buffs.ts',
  'src/render/particle-unorm8.ts',
  'src/render/particle-half.ts',
  'src/render/source-particle-surfaces.ts',
  'tools/qa/lib/primary-hit-packet-reference.py',
  'docs/reference/native-ray-packet.json',
  'docs/reference/native-particle-vertex-format.json',
];
const reading = {
  reference,
  samplerCalls,
  nonRayStates,
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
    'Native byte/half packet conversion applied to retained local source curves, indexed RNG and clocks; no native game or Metal execution.',
    'Both mode-4 rays have unit UV transforms, static exact atlas corners, omitted white modulation and lookup fallback, and no multiplier. Other emitter packet policies remain unchanged.',
    'Native floating-point environment, actual draw-specific shader selection, external modifiers and transform inheritance remain unobserved.',
  ],
};
writeFileSync(resolve(output, 'reading.json'), JSON.stringify(reading, null, 2) + '\n');
console.log(JSON.stringify(reading));
