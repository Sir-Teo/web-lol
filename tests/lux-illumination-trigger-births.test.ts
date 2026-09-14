import { describe, expect, it } from 'vitest';
import {
  luxIlluminationTriggerBirth as birth,
  luxIlluminationTriggerBirths as live,
} from '../src/render/lux-illumination-trigger-births';

describe('Illumination detonation births', () => {
  it('emits the full twenty-spark burst together, alongside four other layers', () => {
    expect(live(123, 0)).toEqual([]);
    const particles = live(123, 1 / 60);
    expect(particles.map((p) => p.name)).toEqual([
      'innerring',
      'outerring',
      ...Array(20).fill('sparks'),
      'motes',
      'rays',
    ]);
    const sparks = particles.filter((p) => p.name === 'sparks');
    expect(sparks.map((p) => p.ordinal)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(sparks.every((p) => p.birthTime === 1 / 60 && p.age === 0)).toBe(true);
    expect(new Set(sparks.map((p) => p.chance)).size).toBe(20);
  });
  it('preserves coupled spark birth distributions and empty-table defaults', () => {
    const low = birth(2, 0),
      high = birth(2, 1),
      middle = birth(2, 0.5);
    expect(low.life).toBeCloseTo(0.2);
    expect(middle.life).toBeCloseTo(0.35);
    expect(high.life).toBe(0.5);
    expect(low.velocity).toEqual([800, -400, -1800]);
    expect(high.velocity).toEqual([-800, 800, 1800]);
    expect(low.size).toEqual([12.5, 30, 0]);
    expect(high.size).toEqual([25, 90, 0]);
    expect(high.drag).toEqual([8, 8, 8]);
    expect(high.emitterPosition).toEqual([0, 50, 0]);
    expect(birth(0, 1).rotation).toEqual([360, 0, 0]);
  });
  it('retains mote orbital, spawn and birth data independently of motion', () => {
    const low = birth(3, 0),
      high = birth(3, 1);
    expect(low.life).toBeCloseTo(0.35);
    expect(high.life).toBeCloseTo(1.4);
    expect(low.velocity[0]).toBeCloseTo(102);
    expect(high.velocity).toEqual([340, 20, 0]);
    expect(low.orbitalVelocity).toEqual(high.orbitalVelocity.map((v) => -v));
    expect(high.spawnAngles).toEqual([360]);
    expect(high.spawnOffset).toEqual([0, 50, 0]);
    expect(low.color).toEqual([1, 1, 1, 0.5]);
    expect(high.color).toEqual([1, 1, 1, 1]);
    expect(low.size[1]).toBe(20);
    expect(low.size[2]).toBe(10);
    expect(birth(4, 0).life).toBe(0.125);
    expect(birth(4, 1).life).toBe(0.25);
  });
  it('charges continuous births against the budget and stops new births without deleting tails', () => {
    const atEnd = live(123, 0.2);
    expect(atEnd.filter((p) => p.name === 'motes')).toHaveLength(20);
    expect(atEnd.filter((p) => p.name === 'rays')).toHaveLength(12);
    expect(live(123, 0.2, 1 / 60)).toEqual([]);
    const stopped = live(123, 0.1, 0.05);
    expect(stopped.filter((p) => p.name === 'motes')).toHaveLength(3);
    expect(stopped.filter((p) => p.name === 'rays')).toHaveLength(2);
    expect(stopped.filter((p) => p.name === 'sparks')).toHaveLength(20);
    expect(live(123, 0.1, 0.05)).toEqual(stopped);
    expect(live(123, 1.61)).toEqual([]);
    const spark = live(123, 1 / 60).find((p) => p.name === 'sparks')!;
    expect(
      live(123, spark.birthTime + spark.life).some(
        (p) => p.name === 'sparks' && p.ordinal === spark.ordinal
      )
    ).toBe(false);
  });
  it('seeks without history or caller mutation and rejects invalid inputs', () => {
    const first = live(321, 0.1);
    live(321, 1.2);
    expect(live(321, 0.1)).toEqual(first);
    first[0].size[0] = -999;
    expect(live(321, 0.1)[0].size[0]).toBe(150);
    for (const age of [-1, NaN, Infinity]) expect(live(1, age)).toEqual([]);
    expect(live(1, 0.1, NaN)).toEqual([]);
    expect(() => birth(5, 0.5)).toThrow(RangeError);
    expect(() => birth(0, 2)).toThrow(RangeError);
  });
});
