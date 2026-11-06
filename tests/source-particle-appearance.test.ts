import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import samples from '../docs/reference/source-appearance-samples.json';
import {
  SourceParticleAppearance,
  type SourceAppearanceDefinition,
} from '../src/render/source-particle-appearance';
const appearances = samples.definitions.map(
  (row) => new SourceParticleAppearance(row.definition as SourceAppearanceDefinition)
);
const hex = (array: Float32Array) =>
  Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('hex');
for (const [index, sample] of samples.samples.entries())
  test(`external appearance ${index}`, () => {
    const definition = samples.definitions[sample.definition];
    const out = appearances[sample.definition].sample({
      birthScale: definition.birthScale,
      birthColor: definition.birthColor,
      age: sample.age,
      life: sample.life ?? Infinity,
      instanceScale: sample.instanceScale,
    });
    expect({ scale: hex(out.scale), color: hex(out.color) }).toEqual(sample.expected);
  });
test('external appearance fixtures reproduce without the application helper', () => {
  execFileSync(process.execPath, ['tools/assets/export-source-appearance-samples.mjs', '--check']);
});
test('uniform scaling excludes trails and HDR color is retained without clamping', () => {
  const row = samples.definitions.at(-1)!,
    definition = row.definition as SourceAppearanceDefinition;
  const input = {
    birthScale: row.birthScale,
    birthColor: row.birthColor,
    age: 0,
    life: 1,
    instanceScale: 1,
  };
  const trail = new SourceParticleAppearance(definition).sample(input);
  expect(trail.scale[1]).toBe(6);
  expect(trail.scale[2]).toBe(12);
  expect(trail.color[0]).toBeGreaterThan(1);
  expect(trail.color[2]).toBe(4);
  expect(trail.color[3]).toBe(4.5);
  const quad = new SourceParticleAppearance({ ...definition, geometry: 'quad' }).sample(input);
  expect(Array.from(quad.scale)).toEqual([quad.scale[0], quad.scale[0], quad.scale[0]]);
});
test('prepared curves, modulation and output own their storage', () => {
  const row = samples.definitions.at(-1)!,
    definition = structuredClone(row.definition);
  const appearance = new SourceParticleAppearance(definition as SourceAppearanceDefinition),
    input = {
      birthScale: row.birthScale,
      birthColor: row.birthColor,
      age: 0.5,
      life: 1,
      instanceScale: 1,
    };
  const before = structuredClone(input),
    expected = appearance.sample(input);
  definition.modulation.fill(999);
  definition.color.values[0].fill(999);
  appearance.sample(input).color.fill(999);
  appearance.sample(input).scale.fill(999);
  expect(appearance.sample(input)).toEqual(expected);
  expect(input).toEqual(before);
});
test('live tables require flicker support and malformed appearance inputs reject', () => {
  const definition = samples.definitions[0].definition as SourceAppearanceDefinition;
  expect(
    () =>
      new SourceParticleAppearance({
        ...definition,
        color: { ...definition.color, probabilities: [{ times: [], values: [], single: 1 }] },
      })
  ).toThrow('flicker');
  expect(() => new SourceParticleAppearance({ ...definition, modulation: [1] })).toThrow();
  const input = {
    birthScale: [1, 1, 1],
    birthColor: [1, 1, 1, 1],
    age: 0,
    life: 1,
    instanceScale: 1,
  };
  for (const edit of [
    { age: -Infinity },
    { life: -1 },
    { instanceScale: NaN },
    { birthScale: [1, 2] },
    { birthColor: [Infinity, 0, 0, 1] },
  ])
    expect(() => appearances[0].sample({ ...input, ...edit })).toThrow();
});
