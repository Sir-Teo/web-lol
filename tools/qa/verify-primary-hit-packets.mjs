/** Compare all sampler fields to frozen source; check quad and ray packet changes
 * against independent Python/C float32 FMA, modulo and binary16 arithmetic. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { rolldown } from 'rolldown';
const { values } = parseArgs({ options: { 'output-dir': { type: 'string' } } }),
  output = resolve(values['output-dir'] ?? `.cache/primary-hit-packets-${Date.now()}`),
  commit = 'c0f75042056ee6d919c93b371e9741e1a5e08fa6',
  sha = (raw) => createHash('sha256').update(raw).digest('hex');
assert(!existsSync(output), 'Use a fresh packet evidence directory');
mkdirSync(output, { recursive: true });
const archive = execFileSync('git', ['archive', commit, 'src', 'package-lock.json'], {
    maxBuffer: 32 * 1024 * 1024,
  }),
  reference = resolve(output, 'reference');
mkdirSync(reference);
writeFileSync(resolve(output, 'source.tar'), archive);
execFileSync('tar', ['-xf', '-', '-C', reference], { input: archive });
assert(
  readFileSync(resolve(reference, 'package-lock.json')).equals(readFileSync('package-lock.json'))
);
assert(
  readFileSync(resolve(reference, 'src/content/masteryi-primary-hit-particles.json')).equals(
    readFileSync('src/content/masteryi-primary-hit-particles.json')
  )
);
async function bundle(root, label) {
  const entry = resolve(output, `${label}.ts`),
    module = resolve(output, `${label}.mjs`);
  writeFileSync(
    entry,
    `export {primaryHitParticles} from ${JSON.stringify(resolve(root, 'src/render/masteryi-primary-hit-particles.ts'))};\nexport {luxHoopChance} from ${JSON.stringify(resolve(root, 'src/render/lux-hoop-particles.ts'))};\nexport {default as data} from ${JSON.stringify(resolve(root, 'src/content/masteryi-primary-hit-particles.json'))};\n`
  );
  if (label === 'after')
    writeFileSync(
      entry,
      readFileSync(entry, 'utf8') +
        `export {particleUnorm8} from ${JSON.stringify(resolve(root, 'src/render/particle-unorm8.ts'))};\n`
    );
  const build = await rolldown({ input: entry, platform: 'node', external: ['three'] });
  try {
    await build.write({ file: module, format: 'esm' });
  } finally {
    await build.close();
  }
  return { exports: await import(pathToFileURL(module).href), sha256: sha(readFileSync(module)) };
}
const before = await bundle(reference, 'before'),
  after = await bundle('.', 'after'),
  cases = [],
  request = [];
for (const seed of [0, 1, 47, 91, 144, 312, 1337, 65535, 0xffffffff])
  for (const kind of ['attack1', 'attack2', 'crit'])
    for (const time of [
      ...Array.from({ length: 76 }, (_, tick) => tick / 60),
      1 / 60 + 0.994,
      1 / 60 + 0.998,
    ]) {
      const a = before.exports.primaryHitParticles(seed, time, kind, 30),
        b = after.exports.primaryHitParticles(seed, time, kind, 30);
      assert.equal(a.length, b.length);
      for (let i = 0; i < a.length; i++) {
        const original = a[i],
          candidate = b[i],
          profile = before.exports.data.profiles[original.profileIndex];
        const emitterSeed = seed ^ Math.imul(original.profileIndex + 1, 0x85ebca6b),
          roll = before.exports.luxHoopChance(emitterSeed ^ 0x27d4eb2d, original.ordinal);
        request.push({
          kind: profile.kind,
          age: original.age,
          roll,
          uv: profile.uv,
          lookup: original.lookup,
          color: original.color,
          cell: original.uv.cell,
        });
        cases.push({
          ray: profile.kind === 'ray',
          seed,
          time,
          kind,
          original,
          candidate,
          request: request.length - 1,
        });
      }
    }
writeFileSync(resolve(output, 'reference-inputs.json'), JSON.stringify(request) + '\n');
execFileSync('python3', [
  'tools/qa/lib/primary-hit-packet-reference.py',
  resolve(output, 'reference-inputs.json'),
  resolve(output, 'reference-output.json'),
]);
const expected = JSON.parse(readFileSync(resolve(output, 'reference-output.json'), 'utf8'));
assert.equal(expected.length, request.length);
let rayParticles = 0,
  changedCells = 0,
  changedLookups = 0,
  changedRayColors = 0,
  changedRayLookups = 0;
for (const row of cases) {
  const e = expected[row.request],
    candidate = row.candidate,
    original = row.original;
  assert.deepEqual(
    candidate.lookup,
    e.lookup,
    `lookup seed ${row.seed} profile ${candidate.profileIndex}`
  );
  assert.deepEqual(
    candidate.uv.cell,
    e.cell,
    `atlas seed ${row.seed} profile ${candidate.profileIndex}`
  );
  assert.deepEqual(candidate.color, original.color, `source color seed ${row.seed}`);
  if (row.ray)
    assert.deepEqual(
      candidate.color.map(after.exports.particleUnorm8),
      e.color,
      `ray color packet seed ${row.seed}`
    );
  if (row.ray) {
    rayParticles++;
    assert.deepEqual(candidate.uv, original.uv);
    if (JSON.stringify(original.color) !== JSON.stringify(e.color)) changedRayColors++;
    if (JSON.stringify(original.lookup) !== JSON.stringify(e.lookup)) changedRayLookups++;
  } else {
    assert.deepEqual(candidate.color, original.color);
    if (JSON.stringify(original.uv.cell) !== JSON.stringify(e.cell)) changedCells++;
    if (JSON.stringify(original.lookup) !== JSON.stringify(e.lookup)) changedLookups++;
  }
  assert.deepEqual(
    {
      ...candidate,
      color: original.color,
      lookup: original.lookup,
      uv: { ...candidate.uv, cell: original.uv.cell },
    },
    original
  );
}
assert(
  changedCells > 0 &&
    changedLookups > 0 &&
    rayParticles > 0 &&
    changedRayColors > 0 &&
    changedRayLookups > 0
);
const scalarInputs = [-1, -0, 0, 0.5, 1, 1.5, -(2 ** -149), 2 ** -149, 3.4028234663852886e38],
  scalarFloat = new Float32Array(1),
  scalarBits = new Uint32Array(scalarFloat.buffer);
for (let byte = 0; byte < 256; byte++) scalarInputs.push(byte / 255);
for (let byte = 0; byte < 255; byte++) {
  scalarFloat[0] = (byte + 0.5) / 255;
  const midpoint = scalarBits[0];
  for (const offset of [-1, 0, 1]) {
    scalarBits[0] = midpoint + offset;
    scalarInputs.push(scalarFloat[0]);
  }
}
let scalarState = 0x12345678;
for (let i = 0; i < 100000; i++) {
  scalarState = (Math.imul(scalarState, 1664525) + 1013904223) >>> 0;
  scalarInputs.push(scalarState / 0x100000000);
}
writeFileSync(resolve(output, 'component-inputs.json'), JSON.stringify(scalarInputs) + '\n');
execFileSync('python3', [
  'tools/qa/lib/primary-hit-packet-reference.py',
  resolve(output, 'component-inputs.json'),
  resolve(output, 'component-reference.json'),
  '--components',
]);
const componentReference = JSON.parse(
  readFileSync(resolve(output, 'component-reference.json'), 'utf8')
);
assert.equal(componentReference.length, scalarInputs.length);
let doubleOnlyByteDifferences = 0;
for (let i = 0; i < scalarInputs.length; i++) {
  const value = scalarInputs[i],
    expected = componentReference[i];
  assert.equal(after.exports.particleUnorm8(value), expected, `UNORM8 component case ${i}`);
  if (Math.min(255, Math.max(0, Math.floor(Math.fround(value) * 255 + 0.5))) / 255 !== expected)
    doubleOnlyByteDifferences++;
}
assert(doubleOnlyByteDifferences >= 128, 'Corpus must detect float32 FMA rounding');
const reading = {
  referenceCommit: commit,
  archiveSha256: sha(archive),
  beforeModuleSha256: before.sha256,
  afterModuleSha256: after.sha256,
  sourceSha256: sha(readFileSync('src/render/masteryi-primary-hit-particles.ts')),
  halfSourceSha256: sha(readFileSync('src/render/particle-half.ts')),
  surfaceSourceSha256: sha(readFileSync('src/render/source-particle-surfaces.ts')),
  primaryRendererSourceSha256: sha(readFileSync('src/render/masteryi-primary-hits.ts')),
  unormSourceSha256: sha(readFileSync('src/render/particle-unorm8.ts')),
  rayWitnessSha256: sha(readFileSync('docs/reference/native-ray-packet.json')),
  vertexFormatWitnessSha256: sha(readFileSync('docs/reference/native-particle-vertex-format.json')),
  nativeWitnessSha256: sha(readFileSync('docs/reference/native-atlas-runtime.json')),
  pythonReferenceSha256: sha(readFileSync('tools/qa/lib/primary-hit-packet-reference.py')),
  samplerCalls: 9 * 3 * 78,
  quadParticles: request.length - rayParticles,
  rayParticles,
  changedCells,
  changedLookups,
  otherFieldsExact: true,
  changedRayPacketColors: changedRayColors,
  changedRayLookups,
  rayFramesAndGeometryExact: true,
  sourceColorsExact: true,
  quadColorsExact: true,
  independentPacketReferenceExact: true,
  independentUnormComponentCases: scalarInputs.length,
  doubleOnlyByteDifferences,
  limits: [
    'Native formula applied to existing local age and indexed random inputs; native RNG/clock producers and live FPCR remain unobserved.',
    'Half nearest-even is an explicit local policy. Ray colors follow the distinct clamped float32 byte path and the observed normalized vertex format; no native game or Metal shader execution.',
  ],
};
writeFileSync(resolve(output, 'reading.json'), JSON.stringify(reading, null, 2) + '\n');
console.log(JSON.stringify(reading));
