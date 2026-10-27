/** Compare all sampler fields to frozen source; check only quad packet changes
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
        if (profile.kind === 'ray') {
          assert.deepEqual(candidate, original);
          cases.push({ ray: true });
          continue;
        }
        const emitterSeed = seed ^ Math.imul(original.profileIndex + 1, 0x85ebca6b),
          roll = before.exports.luxHoopChance(emitterSeed ^ 0x27d4eb2d, original.ordinal);
        request.push({ age: original.age, roll, uv: profile.uv, lookup: original.lookup });
        cases.push({ seed, time, kind, original, candidate, request: request.length - 1 });
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
  changedLookups = 0;
for (const row of cases) {
  if (row.ray) {
    rayParticles++;
    continue;
  }
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
  if (JSON.stringify(original.uv.cell) !== JSON.stringify(e.cell)) changedCells++;
  if (JSON.stringify(original.lookup) !== JSON.stringify(e.lookup)) changedLookups++;
  assert.deepEqual(
    { ...candidate, lookup: original.lookup, uv: { ...candidate.uv, cell: original.uv.cell } },
    original
  );
}
assert(changedCells > 0 && changedLookups > 0 && rayParticles > 0);
const reading = {
  referenceCommit: commit,
  archiveSha256: sha(archive),
  beforeModuleSha256: before.sha256,
  afterModuleSha256: after.sha256,
  sourceSha256: sha(readFileSync('src/render/masteryi-primary-hit-particles.ts')),
  halfSourceSha256: sha(readFileSync('src/render/particle-half.ts')),
  nativeWitnessSha256: sha(readFileSync('docs/reference/native-atlas-runtime.json')),
  pythonReferenceSha256: sha(readFileSync('tools/qa/lib/primary-hit-packet-reference.py')),
  samplerCalls: 9 * 3 * 78,
  quadParticles: request.length,
  rayParticles,
  changedCells,
  changedLookups,
  otherFieldsExact: true,
  rayParticlesExact: true,
  independentPacketReferenceExact: true,
  limits: [
    'Native formula applied to existing local age and indexed random inputs; native RNG/clock producers and live FPCR remain unobserved.',
    'Nearest-even is an explicit local packet rounding policy; no native game or Metal shader execution.',
  ],
};
writeFileSync(resolve(output, 'reading.json'), JSON.stringify(reading, null, 2) + '\n');
console.log(JSON.stringify(reading));
