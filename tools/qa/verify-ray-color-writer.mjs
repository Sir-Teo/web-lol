/** Independently verify finite BGRA words and float32 premultiplication against C fmaf. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { rolldown } from 'rolldown';
const { values } = parseArgs({ options: { 'output-dir': { type: 'string' } } }),
  output = resolve(values['output-dir'] ?? `.cache/ray-word-check-${Date.now()}`),
  sha = (raw) => createHash('sha256').update(raw).digest('hex');
assert(!existsSync(output), 'Use fresh evidence');
mkdirSync(output, { recursive: true });
const entry = resolve(output, 'entry.ts'),
  module = resolve(output, 'writer.mjs');
writeFileSync(
  entry,
  `export {writeRayColor} from ${JSON.stringify(resolve('src/render/particle-ray-color.ts'))};`
);
const bundle = await rolldown({ input: entry, platform: 'node' });
try {
  await bundle.write({ file: module, format: 'esm' });
} finally {
  await bundle.close();
}
const { writeRayColor } = await import(pathToFileURL(module).href),
  request = [],
  colors = [];
for (let byte = 0; byte < 256; byte++)
  colors.push([byte / 255, 0.5039215683937073, 0.0019607841968536377, (255 - byte) / 255]);
let state = 0x9e3779b9;
const next = () => {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 0x100000000;
};
for (let i = 0; i < 100000; i++)
  colors.push([next() * 3 - 1, next() * 3 - 1, next() * 3 - 1, next() * 3 - 1]);
for (const color of colors)
  for (const blend of [0, 1, 2, 4])
    request.push({ kind: 'ray', cell: [0, 0], lookup: [0, 0], color, blend });
writeFileSync(resolve(output, 'inputs.json'), JSON.stringify(request));
execFileSync('python3', [
  'tools/qa/lib/primary-hit-packet-reference.py',
  resolve(output, 'inputs.json'),
  resolve(output, 'expected.json'),
]);
const expected = JSON.parse(readFileSync(resolve(output, 'expected.json')));
assert.equal(expected.length, request.length);
let doubleOnlyCounterexamples = 0;
for (let i = 0; i < request.length; i++) {
  const row = request[i],
    bytes = new Uint8Array(12).fill(173);
  writeRayColor(bytes, 1, 1, Object.freeze(row.color), row.blend);
  const rgba = expected[i].color.map((v) => Math.round(v * 255));
  assert.deepEqual(
    [...bytes],
    [173, 173, 173, 173, rgba[2], rgba[1], rgba[0], rgba[3], 173, 173, 173, 173]
  );
  if (row.blend === 0 || row.blend === 2) {
    const old = row.color
      .slice(0, 3)
      .map((v) => Math.max(0, Math.min(255, Math.floor(v * row.color[3] * 255 + 0.5))));
    if (old.some((v, lane) => v !== rgba[lane])) doubleOnlyCounterexamples++;
  }
}
assert(doubleOnlyCounterexamples > 0);
const reading = {
  finiteColors: colors.length,
  packetCases: request.length,
  blends: [0, 1, 2, 4],
  allWordsAndNeighborSentinelsExact: true,
  sourceColorsFrozen: true,
  doubleOnlyPremultiplicationCounterexamples: doubleOnlyCounterexamples,
  sourceSha256: sha(readFileSync('src/render/particle-ray-color.ts')),
  componentSourceSha256: sha(readFileSync('src/render/particle-unorm8.ts')),
  referenceSha256: sha(readFileSync('tools/qa/lib/primary-hit-packet-reference.py')),
  moduleSha256: sha(readFileSync(module)),
  producerSha256: sha(readFileSync(new URL(import.meta.url))),
  nativeExecuted: false,
};
writeFileSync(resolve(output, 'reading.json'), JSON.stringify(reading, null, 2) + '\n');
console.log(JSON.stringify(reading));
