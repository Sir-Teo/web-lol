import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import samples from '../docs/reference/source-spin-samples.json';
import { SourceParticleSpin, sourceParticleBasis } from '../src/render/source-particle-spin';
const spins = samples.definitions.map((d) => new SourceParticleSpin(d.definition));
const hex = (array: Float32Array) =>
  Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('hex');
for (const [index, sample] of samples.samples.entries())
  test(`external spin/basis ${index}`, () => {
    const rotation = spins[sample.definition].sample({
      ...sample.input,
      life: sample.input.life ?? Infinity,
    });
    expect(hex(rotation)).toBe(sample.expected.rotation);
    expect(hex(sourceParticleBasis(rotation))).toBe(sample.expected.basis);
    expect(hex(sourceParticleBasis(rotation, 17))).toBe(sample.expected.rolledBasis);
  });
test('external spin fixtures reproduce without the application adapter', () => {
  execFileSync(process.execPath, ['tools/assets/export-source-spin-samples.mjs', '--check']);
});
test('birth spin survives unbounded lifetime and enabled constant adds a fixed integrated amount', () => {
  const sample = samples.samples.find((s) => s.input.age === 0.5)!.input;
  const constant = spins[samples.definitions.findIndex((d) => d.name === 'constant')];
  expect(constant.sample({ ...sample, life: Infinity })[0]).toBe(17.625);
  expect(constant.sample({ ...sample, life: 0.75 })[0]).toBe(62.625);
  const basis = sourceParticleBasis([90, 90, 0]);
  expect(basis[2]).toBeCloseTo(0, 12);
  expect(basis[5]).toBe(-1);
  expect(basis[8]).toBeCloseTo(0, 12);
});
test('spin input, prepared curves and output storage remain independent', () => {
  const definition = structuredClone(samples.definitions.at(-1)!.definition),
    spin = new SourceParticleSpin(definition);
  const input = { ...samples.samples[0].input, life: 0.75 },
    before = structuredClone(input),
    expected = spin.sample(input);
  definition.rotation.values[0][0] = 999;
  const next = spin.sample(input);
  expect(next).toEqual(expected);
  expect(input).toEqual(before);
  next.fill(999);
  sourceParticleBasis(expected).fill(999);
  expect(spin.sample(input)).toEqual(expected);
});
test('invalid spin definitions, vectors and clocks reject', () => {
  const definition = samples.definitions[0].definition;
  expect(
    () =>
      new SourceParticleSpin({ ...definition, rotation: { ...definition.rotation, constant: [1] } })
  ).toThrow();
  const input = { ...samples.samples[0].input, life: 0.75 };
  for (const edit of [
    { age: -1 },
    { age: NaN },
    { life: -1 },
    { angularVelocity: [1, 2] },
    { birthRotation: [NaN, 0, 0] },
  ])
    expect(() => spins[0].sample({ ...input, ...edit })).toThrow();
  expect(() => sourceParticleBasis([1, 2])).toThrow();
  expect(() => sourceParticleBasis([0, 0, 0], NaN)).toThrow();
});
