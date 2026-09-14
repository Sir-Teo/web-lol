import { expect, test } from 'vitest';
import { luxBindingTargetBirths } from '../src/render/lux-binding-target-births';
import { luxBindingTargetAppearance } from '../src/render/lux-binding-target-appearance';
function particle(name: string, phase: number) {
  const p = luxBindingTargetBirths(7, 1 / 60).find((p) => p.name === name)!;
  return { ...p, age: p.life * phase };
}
test('source scale curves preserve uniform rings and nonuniform bar growth', () => {
  const ring = luxBindingTargetAppearance(particle('fireCircleTimer', 0.5))!;
  expect(ring.size).toEqual([9, 9, 9]);
  const start = luxBindingTargetAppearance(particle('blastring', 0))!;
  expect(start.size[0]).toBeCloseTo(144.0000021457672, 8);
  const p = particle('bars', 0.5109999775886536);
  const bars = luxBindingTargetAppearance(p)!;
  expect(bars.size[0] / p.size[0]).toBeCloseTo(5.449999809265137, 10);
  expect(bars.size[1] / p.size[1]).toBeCloseTo(5.449999809265137, 10);
  expect(luxBindingTargetAppearance(particle('bars', 0.0037040000315755606))!.size).toEqual([
    0, 0, 0,
  ]);
});
test('paired cylinder glows preserve their different height and alpha timelines', () => {
  const first = luxBindingTargetAppearance(particle('up_glow', 0.7))!;
  const second = luxBindingTargetAppearance(particle('up_glow1', 0.7))!;
  expect(first.color[3]).toBe(0);
  expect(second.color[3]).toBeGreaterThan(0);
  expect(luxBindingTargetAppearance(particle('up_glow', 0))!.size[1]).toBe(0);
  expect(luxBindingTargetAppearance(particle('up_glow', 0.20000000298023224))!.size[1]).toBeCloseTo(
    3,
    10
  );
  expect(second.color.slice(0, 3)).toEqual([1, 0.8352941274642944, 0.4156862795352936]);
});
test('spin advances with seconds while birth-random lookup stays fixed', () => {
  const p = particle('orbitrunes', 0.6),
    before = JSON.stringify(p);
  const a = luxBindingTargetAppearance(p)!;
  expect(a.rotation[1]).toBeCloseTo(p.rotation[1] + p.spin[1] * p.age, 10);
  expect(a.lookup).toEqual([0.6, p.birthRandom]);
  expect(JSON.stringify(p)).toBe(before);
  expect(luxBindingTargetAppearance({ ...p, age: p.age / 2 })!.lookup[1]).toBe(a.lookup[1]);
});
test('tints remain unpremultiplied and expired particles do not produce appearance', () => {
  const p = particle('fireCircleTimer', 0.05000000074505806);
  const a = luxBindingTargetAppearance(p)!;
  expect(a.color.slice(0, 3)).toEqual([1, 1, 1]);
  expect(a.color[3]).toBeCloseTo(0.20000000298023224, 10);
  for (const age of [-1, p.life, Infinity, NaN])
    expect(luxBindingTargetAppearance({ ...p, age })).toBeNull();
});
