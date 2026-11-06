import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import samples from '../docs/reference/source-particle-frame-samples.json';
import {
  SourceParticleFrame,
  type SourceParticleFrameInput,
} from '../src/render/source-particle-frame';
const frames = samples.definitions.map((d) => new SourceParticleFrame(d.definition));
const decode = (hex: string) => {
  const b = Buffer.from(hex, 'hex');
  return Float32Array.from({ length: b.length / 4 }, (_, i) => b.readFloatLE(i * 4));
};
const hex = (array: Float32Array) =>
  Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('hex');
function input(index: number): SourceParticleFrameInput {
  const s = samples.samples[index].input;
  return {
    ...s,
    life: s.life ?? Infinity,
    position: decode(s.position),
    previousPlaced: decode(s.previousPlaced),
    bound: decode(s.bound),
    anchor: decode(s.anchor),
    birthFrame: decode(s.birthFrame),
    currentYaw: decode(s.currentYaw),
    emitterPosition: decode(s.emitterPosition),
    worldBasis: decode(s.worldBasis),
    orbit: s.orbit ? decode(s.orbit) : null,
  };
}
for (const [index, sample] of samples.samples.entries())
  test(`external particle frame ${index}`, () => {
    const out = frames[sample.definition].sample(input(index));
    expect(Object.fromEntries(Object.entries(out).map(([key, v]) => [key, hex(v)]))).toEqual(
      sample.expected
    );
  });
test('external frame fixtures reproduce without the application helper', () => {
  execFileSync(process.execPath, [
    'tools/assets/export-source-particle-frame-samples.mjs',
    '--check',
  ]);
});
test('fresh particles suppress binding and select the correct standing frame', () => {
  const index = samples.samples.findIndex(
    (s) =>
      !s.input.fresh &&
      !s.input.worldHud &&
      !s.input.orbit &&
      s.input.life !== null &&
      samples.definitions[s.definition].definition.bindWeight.constant[0] === 1
  );
  expect(index).toBeGreaterThanOrEqual(0);
  const sample = samples.samples[index],
    frame = frames[sample.definition],
    s = input(index);
  const fresh = frame.sample({ ...s, fresh: true });
  expect(fresh.bound).toEqual(s.bound);
  expect(Array.from(fresh.drift)).toEqual([0, 0, 0]);
  const moved = frame.sample(s);
  expect(moved.bound).not.toEqual(s.bound);
  expect(moved.standingFrame).toEqual(
    samples.definitions[sample.definition].definition.particleLocalOrientation
      ? s.currentYaw
      : s.birthFrame
  );
});
test('frame inputs, definitions and every returned buffer remain independent', () => {
  const sample = samples.samples.at(-1)!,
    definition = structuredClone(samples.definitions[sample.definition].definition);
  const frame = new SourceParticleFrame(definition),
    s = input(samples.samples.length - 1),
    before = structuredClone(s),
    expected = frame.sample(s);
  definition.bindWeight.values[0][0] = 999;
  definition.worldAcceleration.values[0][0] = 999;
  const next = frame.sample(s);
  expect(next).toEqual(expected);
  expect(s).toEqual(before);
  Object.values(next).forEach((v) => v.fill(999));
  expect(frame.sample(s)).toEqual(expected);
});
test('invalid frame policy, extents and clocks reject', () => {
  const definition = samples.definitions[0].definition;
  expect(
    () =>
      new SourceParticleFrame({
        ...definition,
        bindWeight: { ...definition.bindWeight, constant: [1, 2] },
      })
  ).toThrow();
  const s = input(0);
  for (const edit of [
    { position: [1, 2] },
    { worldBasis: [] },
    { moved: [NaN, 0, 0] },
    { dt: -1 },
    { age: Infinity },
    { life: -1 },
    { worldHud: 1 },
  ])
    expect(() => frames[0].sample({ ...s, ...edit } as SourceParticleFrameInput)).toThrow();
});
