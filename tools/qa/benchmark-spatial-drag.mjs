/** Compare motion replay with a frozen helper on captured primary-hit inputs.
 * V8 input serialization preserves signed zero. This measures sampling, not FPS. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { deserialize } from 'node:v8';
import { spatialDragTravel } from '../../src/render/particle-spatial-drag.ts';

const { values } = parseArgs({
  options: {
    input: { type: 'string' },
    reference: { type: 'string' },
    'reference-sha256': { type: 'string' },
    output: { type: 'string' },
    iterations: { type: 'string', default: '100000' },
  },
});
assert(
  values.input && values.reference && values.output,
  'Supply --input corpus.v8, --reference helper.ts and --output fresh.json'
);
assert(!existsSync(values.output), 'Benchmark output already exists');
const sha = (raw) => createHash('sha256').update(raw).digest('hex'),
  referenceRaw = readFileSync(values.reference),
  inputRaw = readFileSync(values.input),
  corpus = deserialize(inputRaw),
  iterations = Number(values.iterations);
assert.equal(sha(referenceRaw), values['reference-sha256'], 'Frozen reference helper differs');
assert(
  Array.isArray(corpus) &&
    corpus.length > 0 &&
    corpus.every((row) => Array.isArray(row) && row.length === 6),
  'Invalid motion corpus'
);
assert(
  Number.isSafeInteger(iterations) && iterations > 0 && iterations <= 1000000,
  'Invalid iteration count'
);
const { spatialDragTravel: reference } = await import(
  pathToFileURL(resolve(values.reference)).href
);
const before = structuredClone(corpus);
for (const args of corpus) {
  const expected = reference(...args),
    actual = spatialDragTravel(...args);
  assert.deepEqual(actual, expected);
  assert.equal(JSON.stringify(actual), JSON.stringify(expected));
}
assert.deepEqual(corpus, before, 'Sampler changed its inputs');
const edges = [];
for (const age of [0, -0, 1 / 120, 1 / 60, 5.25 / 60, 1.2])
  for (const strength of [0, 2, 60, 600])
    for (const velocity of [
      [0, -0, Number.MIN_VALUE],
      [60, -60, 30],
      [1e20, -1e20, 1e-20],
      [Number.MAX_VALUE, -Number.MAX_VALUE, 1],
    ])
      for (const field of [null, { position: [1, 0, -0], radius: 0.8, strength }])
        edges.push([velocity, [0.1, -600, 1.5], [0, 1, 600], [-0, 0, 0], age, field]);
for (const args of edges) assert.deepEqual(spatialDragTravel(...args), reference(...args));
const ring = new Array(256);
function measure(sample) {
  let checksum = 0;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const result = sample(...corpus[i % corpus.length]);
    ring[i % ring.length] = result;
    checksum += result.position[0];
  }
  return { milliseconds: performance.now() - start, checksum };
}
measure(reference);
measure(spatialDragTravel);
const trials = [];
for (let trial = 0; trial < 7; trial++) {
  let baseline, focused;
  if (trial % 2) {
    focused = measure(spatialDragTravel);
    baseline = measure(reference);
  } else {
    baseline = measure(reference);
    focused = measure(spatialDragTravel);
  }
  assert.equal(focused.checksum, baseline.checksum);
  trials.push({ baselineMs: baseline.milliseconds, focusedMs: focused.milliseconds });
}
const median = (numbers) => [...numbers].sort((a, b) => a - b)[Math.floor(numbers.length / 2)],
  baselineMedianMs = median(trials.map((r) => r.baselineMs)),
  focusedMedianMs = median(trials.map((r) => r.focusedMs)),
  result = {
    node: process.version,
    input: values.input,
    inputSha256: sha(inputRaw),
    reference: values.reference,
    referenceSha256: sha(referenceRaw),
    producerSha256: sha(readFileSync(new URL(import.meta.url))),
    helperSha256: sha(
      readFileSync(new URL('../../src/render/particle-spatial-drag.ts', import.meta.url))
    ),
    capturedMotionInputs: corpus.length,
    additionalEdgeCases: edges.length,
    exactValuesIncludingSignedZero: true,
    inputOwnershipPreserved: true,
    iterationsPerTrial: iterations,
    trials,
    baselineMedianMs,
    focusedMedianMs,
    ratio: baselineMedianMs / focusedMedianMs,
    limits: [
      'Standalone Node motion-replay microbenchmark on captured primary-hit inputs, not game FPS or complete-world throughput.',
      'V8 corpus serialization is version-dependent; retain the recorded Node version and input digest.',
    ],
  };
mkdirSync(dirname(values.output), { recursive: true });
writeFileSync(values.output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result));
