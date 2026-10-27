/** Measure Gromp sampler work and Array.map results; no game-FPS claim. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { grompRayReference } from './lib/prepare-gromp-ray-reference.mjs';
const { values } = parseArgs({
    options: { 'output-dir': { type: 'string' }, iterations: { type: 'string', default: '2000' } },
  }),
  output = resolve(values['output-dir'] ?? `.cache/gromp-curves-${Date.now()}`),
  iterations = Number(values.iterations);
assert(!existsSync(output), 'Use a fresh output directory');
assert(Number.isSafeInteger(iterations) && iterations > 0 && iterations <= 100000);
mkdirSync(output, { recursive: true });
const reference = await grompRayReference(resolve(output, 'reference')),
  optimizedReference = await grompRayReference(
    resolve(output, 'optimized-reference'),
    'baaaa8f302ba192b7d2b696d0688b9f93c5919e9'
  ),
  module = optimizedReference.module;
const before = await import(pathToFileURL(reference.module).href),
  after = await import(pathToFileURL(module).href),
  fixtures = [];
for (const id of [0, 47, 91, 65535])
  for (const age of [0, 0.013, 0.073, 0.137, 0.213, 0.357, 0.519, 0.719, 1.1, 2.1])
    fixtures.push({ death: 100, tick: 101 + age * 60, id });
const samplers = { before: before.grompDeathParticles, after: after.grompDeathParticles };
const countMaps = (sampler, f) => {
  const original = Array.prototype.map;
  let calls = 0,
    result;
  try {
    Array.prototype.map = function (...args) {
      calls++;
      return Reflect.apply(original, this, args);
    };
    result = sampler(f.death, f.tick, f.id);
  } finally {
    Array.prototype.map = original;
  }
  return { mapResults: calls, particles: result.length };
};
const census = [];
for (const f of fixtures) {
  assert.deepEqual(samplers.after(f.death, f.tick, f.id), samplers.before(f.death, f.tick, f.id));
  const a = countMaps(samplers.before, f),
    b = countMaps(samplers.after, f);
  assert.equal(a.particles, b.particles);
  assert(b.mapResults <= a.mapResults);
  census.push({ ...f, before: a, after: b });
}
assert(census.some((r) => r.before.mapResults > r.after.mapResults));
const measured = fixtures.filter((f) => samplers.before(f.death, f.tick, f.id).length > 0),
  measure = (name) => {
    let checksum = 0;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const f = measured[i % measured.length],
        rows = samplers[name](f.death, f.tick, f.id);
      checksum += rows.length;
      for (const row of rows) checksum += row.color[0] + row.scale[1] + row.offset[2];
    }
    return { ms: performance.now() - start, checksum };
  };
measure('before');
measure('after');
const trials = [];
for (let trial = 0; trial < 7; trial++) {
  let a, b;
  if (trial % 2) {
    b = measure('after');
    a = measure('before');
  } else {
    a = measure('before');
    b = measure('after');
  }
  assert.equal(a.checksum, b.checksum);
  trials.push({ beforeMs: a.ms, afterMs: b.ms, checksum: a.checksum });
}
const median = (rows) => [...rows].sort((a, b) => a - b)[Math.floor(rows.length / 2)],
  beforeMedianMs = median(trials.map((r) => r.beforeMs)),
  afterMedianMs = median(trials.map((r) => r.afterMs)),
  reading = {
    node: process.version,
    reference,
    optimizedReference,
    fixtures: fixtures.length,
    measuredFixtures: measured.length,
    iterationsPerTrial: iterations,
    trials,
    beforeMedianMs,
    afterMedianMs,
    ratio: beforeMedianMs / afterMedianMs,
    census,
    allRetainedFixtureStatesExact: true,
    limits: [
      'Isolated sampler CPU times and counted Array.map results, not total allocations, full-world throughput, rendering cost or game FPS.',
      'Historical accepted endpoints are frozen at 4ebf87e and baaaa8f; this is not a benchmark of later color arithmetic changes.',
      'Static source curve views are prepared at module initialization; their one-time preparation is outside steady-state measurements.',
    ],
  };
writeFileSync(resolve(output, 'reading.json'), JSON.stringify(reading, null, 2) + '\n');
console.log(
  JSON.stringify({
    fixtures: fixtures.length,
    beforeMedianMs,
    afterMedianMs,
    ratio: reading.ratio,
    maxMapResultsBefore: Math.max(...census.map((r) => r.before.mapResults)),
    maxMapResultsAfter: Math.max(...census.map((r) => r.after.mapResults)),
  })
);
