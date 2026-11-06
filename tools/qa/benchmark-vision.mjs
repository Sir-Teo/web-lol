/** Isolate range-query cost; stubbed terrain does not measure full fog or game FPS. */
import { createServer } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';

const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw Error('Usage: node tools/qa/benchmark-vision.mjs sources.json fresh-report.json');
if (existsSync(output)) throw Error('Output exists; use a fresh report path');
const bytes = await readFile(input);
const { sources, tick } = JSON.parse(bytes);
if (
  !Array.isArray(sources) ||
  !sources.length ||
  sources.some((s) => ![s.x, s.y, s.radius].every(Number.isFinite) || s.radius < 0)
)
  throw Error('Expected finite vision-source packet');
const layout = JSON.parse(await readFile('public/assets/maps/rift-layout.json', 'utf8'));
const points = Array.from({ length: 256 * 256 }, (_, i) => ({
  x: (((i % 256) + 0.5) / 256 - 0.5) * layout.half * 2,
  y: ((Math.floor(i / 256) + 0.5) / 256 - 0.5) * layout.half * 2,
}));
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
let seenFrom;
try {
  ({ seenFrom } = await server.ssrLoadModule('/src/simulation/vision.ts'));
} finally {
  await server.close();
}
const original = (point, sources, sight) =>
  sources.some(
    (source) =>
      Math.hypot(source.x - point.x, source.y - point.y) <= source.radius &&
      (source.unobstructed || sight(source, point))
  );
const measure = (query, sight) => {
  const start = performance.now();
  const mask = Uint8Array.from(points, (point) => +query(point, sources, sight));
  return { ms: performance.now() - start, hash: createHash('sha256').update(mask).digest('hex') };
};
const results = [];
for (const clear of [true, false]) {
  const sight = () => clear;
  const expected = measure(original, sight).hash;
  if (measure(seenFrom, sight).hash !== expected) throw Error('Visibility differs before timing');
  const baselineMS = [],
    optimizedMS = [];
  for (let i = 0; i < 10; i++) {
    const run = (query, values) => {
      const result = measure(query, sight);
      if (result.hash !== expected) throw Error('Visibility differs during timing');
      values.push(result.ms);
    };
    if (i % 2) {
      run(seenFrom, optimizedMS);
      run(original, baselineMS);
    } else {
      run(original, baselineMS);
      run(seenFrom, optimizedMS);
    }
  }
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  results.push({
    terrain: clear ? 'always clear' : 'always blocked',
    maskSHA256: expected,
    baselineMS,
    optimizedMS,
    baselineMedianMS: median(baselineMS),
    optimizedMedianMS: median(optimizedMS),
  });
}
const report = {
  scope:
    'Isolated range-query microbenchmark with current match sources and stubbed terrain. Not full fog, game FPS, GPU or device certification.',
  node: process.version,
  cpu: cpus()[0].model,
  input,
  tick,
  sources: sources.length,
  queryPoints: points.length,
  inputSHA256: createHash('sha256').update(bytes).digest('hex'),
  scriptSHA256: createHash('sha256')
    .update(await readFile(new URL(import.meta.url)))
    .digest('hex'),
  results,
};
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
