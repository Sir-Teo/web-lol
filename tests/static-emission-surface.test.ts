import { expect, test } from 'vitest';
import fixture from '../docs/reference/static-emission-samples.json';
import { staticEmissionSurface } from '../src/render/static-emission-surface';

for (const sample of fixture.samples)
  test(`static emission matches independent reader: ${sample.name}`, () => {
    const mesh = fixture.meshes[sample.mesh as keyof typeof fixture.meshes];
    let count = 0;
    const birth = staticEmissionSurface(mesh.positions, mesh.indices)(() => sample.draws[count++]);
    expect(count).toBe(sample.draws.length);
    expect(!!birth).toBe(sample.sampled);
    if (birth) {
      birth.position.forEach((value, axis) =>
        expect(Math.abs(value - sample.position[axis])).toBeLessThan(2e-5)
      );
      birth.normal.forEach((value, axis) =>
        expect(Math.abs(value - sample.normal[axis])).toBeLessThan(1e-6)
      );
    }
  });

test('area boundary selects the next face and static corner blend stays nonuniform', () => {
  const mesh = fixture.meshes.unequal;
  const sample = (values: number[]) =>
    staticEmissionSurface(mesh.positions, mesh.indices)(() => values.shift()!);
  expect(sample([0.2, 0, 0])?.triangle).toBe(1);
  expect(sample([0.1, 0.5, 0.5])?.position).toEqual([0.5, 1, 0]);
});

test('prepared mesh and returned births do not share mutable caller storage', () => {
  const positions = [...fixture.meshes.unequal.positions],
    indices = [...fixture.meshes.unequal.indices];
  const sample = staticEmissionSurface(positions, indices),
    draws = () => 0.5;
  const first = sample(draws)!;
  positions.fill(999);
  indices.fill(999);
  first.position.fill(999);
  first.normal.fill(999);
  expect(sample(draws)).toEqual({ position: [11, 2, 0], normal: [0, 0, 1], triangle: 1 });
});

for (const value of [-1, 1, NaN, Infinity])
  test(`invalid random draw rejects ${value}`, () => {
    expect(() =>
      staticEmissionSurface(
        fixture.meshes.unequal.positions,
        fixture.meshes.unequal.indices
      )(() => value)
    ).toThrow(RangeError);
  });

for (const [positions, indices] of [
  [[0, 0], []],
  [[0, 0, 0], [0]],
  [[NaN, 0, 0], []],
  [
    [0, 0, 0],
    [0, 0, 1],
  ],
  [
    [0, 0, 0],
    [0, 0, -1],
  ],
  [
    [0, 0, 0],
    [0, 0, 0.5],
  ],
])
  test(`malformed static mesh rejects ${positions}/${indices}`, () => {
    expect(() => staticEmissionSurface(positions, indices)).toThrow(RangeError);
  });
