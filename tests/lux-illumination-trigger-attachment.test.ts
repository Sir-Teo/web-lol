import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { luxIlluminationTriggerBirths } from '../src/render/lux-illumination-trigger-births';
import { luxIlluminationTriggerAttachment as attach } from '../src/render/lux-illumination-trigger-attachment';
const births = luxIlluminationTriggerBirths(123, 1 / 60);
const ray = births.find((p) => p.name === 'rays')!;
const spark = births.find((p) => p.name === 'sparks')!;
const mote = births.find((p) => p.name === 'motes')!;

describe('detonation attachment translation', () => {
  it('fully bound rays follow current origin, including later births and fractional frames', () => {
    const path = (t: number) => new Vector3(120 * t, 60 * t, -30 * t);
    for (const p of [
      ray,
      luxIlluminationTriggerBirths(123, 0.15)
        .filter((p) => p.name === 'rays')
        .at(-1)!,
    ]) {
      const particle = { ...p, age: 3.5 / 60 };
      const result = attach(particle, path)!;
      const now = path(particle.birthTime + particle.age);
      expect(result.position.distanceTo(now)).toBeLessThan(1e-12);
      expect(result.travel.distanceTo(new Vector3(120, 60, -30))).toBeLessThan(1e-10);
    }
  });
  it('unbound rings stay at their birth origin as the target moves', () => {
    const p = births.find((p) => p.name === 'innerring')!;
    const result = attach({ ...p, age: 0.2 }, (t) => new Vector3(100 * t, 200 * t, 300 * t))!;
    for (const [axis, value] of [100 / 60, 200 / 60, 5].entries())
      expect(result.position.getComponent(axis)).toBeCloseTo(value, 12);
    expect(result.travel.length()).toBe(0);
  });
  it('accumulates changing spark binding instead of multiplying final weight by total travel', () => {
    // Target jumps 10 units before the fade and another 10 after binding reaches zero.
    const path = (t: number) => new Vector3(t < 0.1 ? 0 : t < 0.55 ? 10 : 20, 0, 0);
    const result = attach({ ...spark, life: 1, age: 0.6 }, path)!;
    expect(result.position.x).toBe(5);
    expect(result.travel.length()).toBe(0);
    const fractional = attach({ ...spark, life: 1, age: 4.5 / 60 }, path)!;
    expect(fractional.position.x).toBe(2.5);
  });
  it('orbits an unbound mote around the current system origin', () => {
    const p = { ...mote, life: 1, age: 0.25, orbitalVelocity: [0, 2 * Math.PI, 0] };
    const result = attach(p, (t) => new Vector3((t - p.birthTime) * 40, 0, 0))!;
    expect(result.position.x).toBeCloseTo(10, 10);
    expect(result.position.y).toBe(0);
    expect(result.position.z).toBeCloseTo(10, 10);
    expect(result.travel.length()).toBe(0);
  });
  it('preserves callback vectors, repeats exactly and rejects expired samples', () => {
    const origin = new Vector3(3, 4, 5),
      path = () => origin;
    const p = { ...spark, age: 0.1 };
    const first = attach(p, path)!;
    expect(first.position.toArray()).toEqual([3, 4, 5]);
    expect(origin.toArray()).toEqual([3, 4, 5]);
    first.position.set(9, 9, 9);
    expect(attach(p, path)!.position.toArray()).toEqual([3, 4, 5]);
    for (const age of [-1, NaN, Infinity, spark.life])
      expect(attach({ ...spark, age }, path)).toBeNull();
  });
});
