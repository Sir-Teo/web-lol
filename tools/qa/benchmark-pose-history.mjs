/** Compare the owned timeline copier with structuredClone on actual saved poses.
 * Run with Node's TypeScript stripping. This measures copying, not game FPS. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { cloneAnimationTimeline } from '../../src/simulation/animation-timeline.ts';

const { values } = parseArgs({
  options: {
    input: { type: 'string' },
    output: { type: 'string' },
    iterations: { type: 'string', default: '100000' },
  },
});
assert(values.input && values.output, 'Supply --input saved-json and --output fresh-result-json');
assert(!existsSync(values.output), 'Benchmark output already exists');
const iterations = Number(values.iterations);
assert(
  Number.isSafeInteger(iterations) && iterations > 0 && iterations <= 1000000,
  'Invalid iteration count'
);
const raw = readFileSync(values.input),
  input = JSON.parse(raw),
  corpus = [null];
const visit = (value) => {
  if (!value || typeof value !== 'object') return;
  if (value.animationTimeline) corpus.push(value.animationTimeline);
  for (const child of Object.values(value)) if (child && typeof child === 'object') visit(child);
};
if (typeof input.before?.saved === 'string') {
  visit(JSON.parse(input.before.saved));
  if (typeof input.before.future === 'string') visit(JSON.parse(input.before.future));
} else visit(input);
const distinct = [...new Map(corpus.map((value) => [JSON.stringify(value), value])).values()];
assert(distinct.length > 1, 'Input contains no saved animation timelines');
const independent = (source, copy) => {
  if (!source || typeof source !== 'object') return;
  assert.notEqual(copy, source);
  for (const [key, child] of Object.entries(source)) independent(child, copy[key]);
};
for (const source of distinct) {
  const copy = cloneAnimationTimeline(source),
    baseline = structuredClone(source);
  assert.deepEqual(copy, baseline);
  assert.equal(JSON.stringify(copy), JSON.stringify(baseline));
  independent(source, copy);
}
const ring = new Array(256);
function measure(copy) {
  let checksum = 0;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const result = copy(distinct[i % distinct.length]);
    ring[i % ring.length] = result;
    checksum += result?.tick ?? 0;
  }
  return { milliseconds: performance.now() - start, checksum };
}
measure(structuredClone);
measure(cloneAnimationTimeline);
const trials = [];
for (let trial = 0; trial < 7; trial++) {
  let baseline, focused;
  if (trial % 2) {
    focused = measure(cloneAnimationTimeline);
    baseline = measure(structuredClone);
  } else {
    baseline = measure(structuredClone);
    focused = measure(cloneAnimationTimeline);
  }
  assert.equal(baseline.checksum, focused.checksum);
  trials.push({ baselineMs: baseline.milliseconds, focusedMs: focused.milliseconds });
}
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)],
  baselineMedianMs = median(trials.map((t) => t.baselineMs)),
  focusedMedianMs = median(trials.map((t) => t.focusedMs)),
  result = {
    input: values.input,
    inputSha256: createHash('sha256').update(raw).digest('hex'),
    producerSha256: createHash('sha256')
      .update(readFileSync(new URL(import.meta.url)))
      .digest('hex'),
    helperSha256: createHash('sha256')
      .update(readFileSync(new URL('../../src/simulation/animation-timeline.ts', import.meta.url)))
      .digest('hex'),
    node: process.version,
    timelineShapes: distinct.length,
    transitionShapes: distinct.filter((v) => v?.transition).length,
    iterationsPerTrial: iterations,
    trials,
    baselineMedianMs,
    focusedMedianMs,
    ratio: baselineMedianMs / focusedMedianMs,
    exactValuesAndPropertyOrder: true,
    independentMutableObjects: true,
    limits: [
      'Standalone Node copy microbenchmark on the provided timeline corpus, not game FPS or complete-world throughput.',
      'Alternating warmed trial order and retained result ring; wall-clock timing depends on the environment.',
    ],
  };
mkdirSync(dirname(values.output), { recursive: true });
writeFileSync(values.output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result));
