/** Check real missile sampler colors against host C and retain every noncolor field. */
import assert from 'node:assert/strict';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { rolldown } from 'rolldown';
import { grompAttackReference } from './lib/prepare-gromp-attack-reference.mjs';
const { values } = parseArgs({ options: { 'output-dir': { type: 'string' } } }),
  output = resolve(values['output-dir'] ?? `.cache/gromp-attack-color-${Date.now()}`);
assert(!existsSync(output), 'Use a fresh output directory');
mkdirSync(output, { recursive: true });
const reference = await grompAttackReference(resolve(output, 'reference')),
  entry = resolve(output, 'candidate.ts'),
  module = resolve(output, 'candidate.mjs');
writeFileSync(
  entry,
  [
    `export {grompAttackParticles} from ${JSON.stringify(resolve('src/render/gromp-attack-particles.ts'))};`,
    `export {prepareLegacyParticleColor,sampleLegacyParticleColor} from ${JSON.stringify(resolve('src/render/legacy-particle-color.ts'))};`,
    `export {writeGrompAttackColor} from ${JSON.stringify(resolve('src/render/gromp-attack-color.ts'))};`,
  ].join('\n')
);
const build = await rolldown({ input: entry, platform: 'node', external: ['three'] });
try {
  await build.write({ file: module, format: 'esm' });
} finally {
  await build.close();
}
const before = await import(pathToFileURL(reference.module).href),
  after = await import(pathToFileURL(module).href),
  requests = [],
  rows = [];
let calls = 0,
  retainedFields = 0;
for (const id of [1, 91, 0xffffffff])
  for (const launchTick of [0, 65535])
    for (const stop of [null, 7, 37]) {
      const effect = {
        id,
        sourceId: 91,
        launchTick,
        stopTick: stop === null ? null : launchTick + stop,
        frames: Array.from({ length: 181 }, (_, i) => ({
          tick: launchTick + i,
          x: i * 3,
          y: Math.sin(i / 8) * 40,
          facing: i / 20,
        })),
      };
      for (let step = 0; step <= 280; step++) {
        const tick = launchTick + step / 2,
          a = before.grompAttackParticles(effect, tick),
          b = after.grompAttackParticles(effect, tick);
        assert.equal(a.length, b.length);
        calls++;
        for (let i = 0; i < a.length; i++) {
          const { color: oldColor, ...oldFields } = a[i],
            { color, ...fields } = b[i];
          assert.deepEqual(fields, oldFields);
          retainedFields++;
          requests.push({ profileIndex: b[i].profileIndex, phase: b[i].phase });
          rows.push({ color, oldColor });
        }
      }
    }
const retained = rows.length,
  curves = before.data.profiles.map((p) =>
    p.colorCurve.length ? after.prepareLegacyParticleColor(p.color, p.colorCurve) : null
  );
let random = 0x6d2b79f5;
for (let index = 0; index < 4; index++) {
  const phases = new Set([0, 1]);
  for (const key of curves[index] ?? [])
    for (const d of [-1, 0, 1]) {
      const b = Buffer.alloc(4);
      b.writeFloatLE(key.time);
      const bits = b.readUInt32LE() + d;
      if (bits >= 0 && bits <= 0x3f800000) {
        b.writeUInt32LE(bits);
        phases.add(b.readFloatLE());
      }
    }
  for (let i = 0; i < 1000; i++) {
    random ^= random << 13;
    random ^= random >>> 17;
    random ^= random << 5;
    phases.add((random >>> 0) / 4294967296);
  }
  for (const phase of phases) {
    requests.push({ profileIndex: index, phase });
    rows.push({
      color: curves[index]
        ? after.sampleLegacyParticleColor(curves[index], phase)
        : before.data.profiles[index].color,
    });
  }
}
const input = resolve(output, 'inputs.json'),
  expectedPath = resolve(output, 'expected.json');
writeFileSync(input, JSON.stringify(requests));
execFileSync('python3', [
  'tools/qa/lib/legacy-gromp-attack-color-reference.py',
  input,
  expectedPath,
]);
const expected = JSON.parse(readFileSync(expectedPath));
assert.equal(expected.length, rows.length);
let changedFloatStates = 0,
  oldFloatDifferentChannels = 0,
  maxOldFloatDelta = 0;
const counts = {};
for (let i = 0; i < rows.length; i++) {
  const r = rows[i],
    e = expected[i],
    request = requests[i],
    bytes = new Uint8Array(4);
  assert.deepEqual(r.color, e.rgba);
  after.writeGrompAttackColor(
    bytes,
    0,
    1,
    r.color,
    before.data.profiles[request.profileIndex].blend
  );
  assert.deepEqual([...bytes], e.bgra);
  counts[request.profileIndex] = (counts[request.profileIndex] ?? 0) + 1;
  if (i < retained) {
    if (r.color.some((v, l) => Math.fround(v) !== Math.fround(r.oldColor[l]))) changedFloatStates++;
    const old = [...r.oldColor];
    if (before.data.profiles[request.profileIndex].blend !== 4) {
      for (let l = 0; l < 3; l++) old[l] *= old[3];
      old[3] = 1;
    }
    const rgba = [e.bgra[2] / 255, e.bgra[1] / 255, e.bgra[0] / 255, e.bgra[3] / 255];
    for (let l = 0; l < 4; l++) {
      if (Math.fround(old[l]) !== Math.fround(rgba[l])) oldFloatDifferentChannels++;
      maxOldFloatDelta = Math.max(
        maxOldFloatDelta,
        Math.abs(Math.fround(old[l]) - Math.fround(rgba[l]))
      );
    }
  }
}
const reading = {
  reference,
  calls,
  retainedFields,
  retainedColorStates: retained,
  extraPhases: rows.length - retained,
  counts,
  changedFloatStates,
  oldFloatDifferentChannels,
  maxOldFloatDelta,
  allRawColorsAndBgraExact: true,
  allNoncolorStateExact: true,
  nativeExecuted: false,
};
writeFileSync(resolve(output, 'reading.json'), JSON.stringify(reading, null, 2) + '\n');
console.log(JSON.stringify(reading));
