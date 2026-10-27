/** Measure placement only on actual source particles; no game-FPS claim. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { rolldown } from 'rolldown';
import { placementReference } from './lib/prepare-surface-placement-reference.mjs';
import { placementFixtures } from './lib/particle-surface-placement-fixtures.mjs';
const { values } = parseArgs({
    options: {
      'output-dir': { type: 'string' },
      iterations: { type: 'string', default: '20000' },
      'reference-commit': { type: 'string' },
      'ray-only': { type: 'boolean', default: false },
      'packed-colors': { type: 'boolean', default: false },
    },
  }),
  output = resolve(values['output-dir'] ?? `.cache/surface-placement-${Date.now()}`),
  iterations = Number(values.iterations);
assert(!existsSync(output), 'Use a fresh output directory');
assert(Number.isSafeInteger(iterations) && iterations > 0 && iterations <= 1000000);
mkdirSync(output, { recursive: true });
const reference = await placementReference(
    resolve(output, 'reference'),
    values['reference-commit']
  ),
  entry = resolve(output, 'candidate.ts');
writeFileSync(
  entry,
  `export { SourceParticleSurfaces } from ${JSON.stringify(resolve('src/render/source-particle-surfaces.ts'))};\n`
);
const bundle = await rolldown({ input: entry, platform: 'node', external: ['three'] }),
  candidate = resolve(output, 'candidate.mjs');
try {
  await bundle.write({ file: candidate, format: 'esm' });
} finally {
  await bundle.close();
}
const before = await import(pathToFileURL(reference.module).href),
  after = await import(pathToFileURL(candidate).href),
  suite = placementFixtures(before, after, {
    freezeInputs: true,
    rayOnly: values['ray-only'],
    packedColors: values['packed-colors'],
  }),
  measuredFixtures = suite.fixtures.filter((f) => f.particles.length > 0);
assert(measuredFixtures.length > 0, 'No live particles to measure');
try {
  for (const f of suite.fixtures) {
    f.a.update(f.world, 1, f.camera);
    f.b.update(f.world, 1, f.camera);
    assert.deepEqual(suite.snapshot(f.b), suite.snapshot(f.a));
  }
  const measure = (name) => {
    let checksum = 0;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const f = measuredFixtures[i % measuredFixtures.length];
      f[name].update(f.world, 1, f.camera);
      checksum += f[name].models.size;
    }
    return { ms: performance.now() - start, checksum };
  };
  measure('a');
  measure('b');
  const trials = [];
  for (let i = 0; i < 7; i++) {
    let a, b;
    if (i % 2) {
      b = measure('b');
      a = measure('a');
    } else {
      a = measure('a');
      b = measure('b');
    }
    assert.equal(a.checksum, b.checksum);
    trials.push({ baselineMs: a.ms, focusedMs: b.ms });
  }
  assert(suite.inputsUnchanged());
  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)],
    baselineMedianMs = median(trials.map((t) => t.baselineMs)),
    focusedMedianMs = median(trials.map((t) => t.focusedMs)),
    sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
  const result = {
    node: process.version,
    reference,
    fixtures: suite.fixtures.length,
    measuredFixtures: measuredFixtures.length,
    rayOnly: values['ray-only'],
    packedColors: values['packed-colors'],
    particles: suite.particleCount,
    exactMeshStateAndUniforms: true,
    particleInputsUnchanged: true,
    iterationsPerTrial: iterations,
    trials,
    baselineMedianMs,
    focusedMedianMs,
    ratio: baselineMedianMs / focusedMedianMs,
    sourceSha256: sha('src/render/source-particle-surfaces.ts'),
    producerSha256: sha(new URL(import.meta.url)),
    fixtureProducerSha256: sha('tools/qa/lib/particle-surface-placement-fixtures.mjs'),
    limits: [
      'Standalone placement-update timings on captured source particles, not game FPS or complete-world throughput.',
      'Particle sampling and asset/GPU work are excluded; all source assets and numerical force policies are unchanged.',
    ],
  };
  writeFileSync(resolve(output, 'reading.json'), JSON.stringify(result, null, 2) + '\n', {
    flag: 'wx',
  });
  console.log(JSON.stringify(result));
} finally {
  suite.dispose();
}
