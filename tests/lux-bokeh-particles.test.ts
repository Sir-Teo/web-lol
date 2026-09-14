import { expect, test } from 'vitest';
import profile from '../src/content/lux-bokeh.json';
import { luxBokehBirth, luxBokehParticles } from '../src/render/lux-bokeh-particles';

test('bokeh source distributions retain color, lifetime and correlated endpoints', () => {
  const low = luxBokehBirth(0),
    high = luxBokehBirth(1);
  expect(low.life).toBe(0.5);
  expect(high.life).toBe(1);
  expect(low.offset).toEqual([100, 0, -1000]);
  expect(high.offset).toEqual([-100, 35, 1000]);
  expect(low.color.slice(0, 3)).toEqual([1, 1, 1]);
  expect(low.color[3]).toBeCloseTo(0.03 * 0.3, 6);
  expect(high.color[3]).toBe(profile.birthColor.value[3]);
  expect(low.halfSize[0]).toBeCloseTo(120, 4);
  expect(high.halfSize).toEqual([300, 50, 1]);
  expect(low.velocity[2]).toBeCloseTo(-80, 4);
  expect(luxBokehBirth(0.5).velocity[2]).toBeCloseTo(-160, 4);
  expect(high.velocity[2]).toBe(-1600);
});

test('bokeh follows independently stepped drag, source translation and uniform scale', () => {
  const age = 17.25 / 60;
  for (const p of luxBokehParticles(12345, age)) {
    const birth = luxBokehBirth(p.chance);
    const position = birth.offset.map((v, axis) => v + profile.emitterPosition[axis]);
    const velocity = [...birth.velocity];
    for (let tick = 0; tick < 18; tick++) {
      for (let axis = 0; axis < 3; axis++) {
        velocity[axis] *= 1 - profile.drag[axis] / 60;
        position[axis] += (velocity[axis] / 60) * (tick === 17 ? 0.25 : 1);
      }
    }
    p.position.forEach((v, axis) => expect(v).toBeCloseTo(position[axis], 9));
    const size = birth.halfSize[0] * (1 - (0.5 * age) / birth.life);
    p.halfSize.forEach((v) => expect(v).toBeCloseTo(size, 9));
    expect(p.multOffset[0]).toBeCloseTo(birth.multOffset[0] + 2 * age, 9);
    expect(p.rotation).toBe(90);
  }
});

test('four static atlas cells and ordinal choices survive retirement and reconstruction', () => {
  const born = luxBokehParticles(12345, 0);
  expect(born).toHaveLength(45);
  expect(new Set(born.map((p) => p.frame))).toEqual(new Set([0, 1, 2, 3]));
  for (const p of born) {
    expect(p.cellSize).toEqual([0.5, 0.5]);
    expect(p.cellOffset).toEqual([(p.frame % 2) / 2, Math.floor(p.frame / 2) / 2]);
  }
  const later = luxBokehParticles(12345, 0.75);
  expect(later.length).toBeGreaterThan(0);
  expect(later.length).toBeLessThan(45);
  expect(later).toEqual(luxBokehParticles(12345, 0.75));
  for (const p of later) expect(p.frame).toBe(born[p.ordinal - 1].frame);
  expect(luxBokehParticles(54321, 0).map((p) => p.frame)).not.toEqual(born.map((p) => p.frame));
  for (const age of [-1, NaN, Infinity, 1, 2]) expect(luxBokehParticles(12345, age)).toEqual([]);
});

test('bokeh alpha follows authored dark and bright flicker knots', () => {
  const p = luxBokehParticles(12345, 0)[0];
  for (let i = 3; i < profile.color.times.length - 1; i++) {
    const age = p.life * profile.color.times[i];
    const current = luxBokehParticles(12345, age).find((v) => v.ordinal === p.ordinal)!;
    expect(current.color[3]).toBeCloseTo(p.color[3] * profile.color.values[i][3], 10);
    expect(current.color.slice(0, 3)).toEqual(p.color.slice(0, 3));
  }
});
