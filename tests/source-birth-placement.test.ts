import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import samples from '../docs/reference/source-birth-placement-samples.json';
import {
  sourceBirthPlacement,
  type SourceBirthPlacementInput,
} from '../src/render/source-birth-placement';
const decode = (hex: string) => {
  const bytes = Buffer.from(hex, 'hex');
  return Float32Array.from({ length: bytes.length / 4 }, (_, i) => bytes.readFloatLE(i * 4));
};
const hex = (value: Float32Array) =>
  Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('hex');
function input(index: number): SourceBirthPlacementInput {
  const s = samples.samples[index].input;
  return {
    ...s,
    base: decode(s.base),
    offset: decode(s.offset),
    turn: decode(s.turn),
    velocity: decode(s.velocity),
    acceleration: decode(s.acceleration),
    surface: s.surface
      ? { position: decode(s.surface.position), normal: decode(s.surface.normal) }
      : null,
  };
}
for (const [index, sample] of samples.samples.entries())
  test(`external birth placement ${sample.name}`, () => {
    const out = sourceBirthPlacement(input(index));
    expect({
      position: hex(out.position),
      velocity: hex(out.velocity),
      acceleration: hex(out.acceleration),
      offset: hex(out.offset),
    }).toEqual(sample.expected);
  });
test('external placement fixtures reproduce without the application helper', () => {
  execFileSync(process.execPath, [
    'tools/assets/export-source-birth-placement-samples.mjs',
    '--check',
  ]);
});
test('surface normal replaces direction before the shape turn, without turning offset twice', () => {
  const s = input(0);
  s.base = [0, 0, 0];
  s.offset = [1, 0, 0];
  s.turn = [0, 0, 1, 0, 1, 0, -1, 0, 0];
  s.turned = true;
  s.velocity = [-3, 4, 0];
  s.acceleration = [-1, 2, 2];
  s.surface = { position: [0, 0, 2], normal: [0, 0, 1] };
  s.surfaceScale = 0.5;
  s.useNormal = true;
  const out = sourceBirthPlacement(s);
  expect(Array.from(out.velocity)).toEqual([5, 0, 0]);
  expect(Array.from(out.acceleration)).toEqual([3, 0, 0]);
  expect(Array.from(out.position)).toEqual([1, 0, 1]);
});
test('placement retains independent buffers and does not mutate source inputs', () => {
  const s = input(20),
    before = structuredClone(s),
    first = sourceBirthPlacement(s);
  expect(s).toEqual(before);
  const second = sourceBirthPlacement(s);
  first.position.fill(999);
  first.velocity.fill(999);
  first.acceleration.fill(999);
  first.offset.fill(999);
  expect(sourceBirthPlacement(s)).toEqual(second);
  expect(s).toEqual(before);
});
test('invalid placement extents, numbers and policies reject', () => {
  for (const edit of [
    { base: [1, 2] },
    { offset: [NaN, 0, 0] },
    { turn: [] },
    { velocity: [Infinity, 0, 0] },
    { surfaceScale: NaN },
    { offsetScale: Infinity },
    { useNormal: 1 },
    { surface: { position: [0, 0, 0], normal: [1, 2] } },
  ])
    expect(() =>
      sourceBirthPlacement({ ...input(0), ...edit } as SourceBirthPlacementInput)
    ).toThrow();
});
