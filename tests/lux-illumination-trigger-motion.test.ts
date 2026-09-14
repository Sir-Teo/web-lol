import { describe, expect, it } from 'vitest';
import { luxIlluminationTriggerBirths } from '../src/render/lux-illumination-trigger-births';
import { luxIlluminationTriggerStaticMotion as motion } from '../src/render/lux-illumination-trigger-motion';
const births = luxIlluminationTriggerBirths(123, 1 / 60);
const spark = births.find((p) => p.name === 'sparks')!;
const mote = births.find((p) => p.name === 'motes')!;

describe('static Illumination detonation motion', () => {
  it('matches stepped drag and interpolates the next segment without mutating birth data', () => {
    const p = { ...spark, life: 1, age: 12.5 / 60 };
    const expected = [0, 50, 0],
      velocity = [...p.velocity];
    for (let tick = 0; tick < 13; tick++)
      for (let axis = 0; axis < 3; axis++) {
        velocity[axis] *= 1 - 8 / 60;
        expected[axis] += (velocity[axis] / 60) * (tick === 12 ? 0.5 : 1);
      }
    const before = JSON.stringify(p),
      result = motion(p)!;
    for (let axis = 0; axis < 3; axis++) {
      expect(result.position[axis]).toBeCloseTo(expected[axis], 10);
      expect(result.travel[axis]).toBeCloseTo(velocity[axis], 10);
    }
    expect(result.stretch).toBeCloseTo(
      Math.max(1.2999999523162842, Math.hypot(...velocity) * 0.004000000189989805)
    );
    expect(JSON.stringify(p)).toBe(before);
  });
  it('turns mote spawn velocity about its authored Y axis before displacement', () => {
    const p = {
      ...mote,
      life: 1,
      age: 0.1,
      velocity: [100, 0, 0],
      drag: [0, 0, 0],
      orbitalVelocity: [0, 0, 0],
      spawnAngles: [90],
    };
    const result = motion(p)!;
    expect(result.position[0]).toBeCloseTo(0, 10);
    expect(result.position[1]).toBeCloseTo(54, 10);
    expect(result.position[2]).toBeCloseTo(-10, 10);
    expect(result.travel[2]).toBeCloseTo(-100, 10);
    expect(result.stretch).toBe(1);
  });
  it('orbits the initial offset in radians, then adds the lifetime-scaled world offset', () => {
    const p = {
      ...mote,
      life: 1,
      age: 0.25,
      velocity: [0, 0, 0],
      spawnAngles: [0],
      orbitalVelocity: [2 * Math.PI, 0, 0],
    };
    const result = motion(p)!;
    expect(result.position[0]).toBeCloseTo(0, 10);
    expect(result.position[1]).toBeCloseTo(10, 10);
    expect(result.position[2]).toBeCloseTo(50, 10);
    expect(result.orbitRadians).toEqual([Math.PI / 2, 0, 0]);
    expect(motion({ ...p, life: 0.5 })!.position[1]).toBeCloseTo(5, 10);
    expect(result.travel).toEqual([0, 0, 0]);
    expect(result.stretch).toBe(1);
  });
  it('keeps stationary rings and rays at the source offset and rejects dead samples', () => {
    for (const p of births.filter((p) => ['innerring', 'outerring', 'rays'].includes(p.name))) {
      expect(motion({ ...p, age: 0.05 })!.position).toEqual([0, 50, 0]);
      expect(motion({ ...p, age: 0.05 })!.stretch).toBe(1);
      for (const age of [-1, NaN, Infinity, p.life]) expect(motion({ ...p, age })).toBeNull();
    }
    const first = motion({ ...mote, age: 0.1 });
    motion({ ...mote, age: 0.5 });
    expect(motion({ ...mote, age: 0.1 })).toEqual(first);
  });
});
