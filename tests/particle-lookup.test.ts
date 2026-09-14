import { describe, expect, it } from 'vitest';
import { particleLookupCoordinate as coordinate } from '../src/render/particle-lookup';
import { LUX_BASIC_HOOP_APPEARANCE as hoop } from '../src/content/lux-basic-lookups';
import source from '../docs/reference/lux-basic-attack.json';

const state = { age01: 0.25, travelPerSecond: [3, 4, 12], birthRandom: 0.75 } as const;
describe('particle-color lookup coordinates', () => {
  it('constant reads scale alone, including zero and a nonzero offset', () => {
    expect(coordinate({ type: 0, scale: 0, offset: 0.8 }, state)).toBe(0);
    expect(coordinate({ type: 0, scale: 0.5, offset: -1 }, state)).toBe(0.5);
  });
  it('lifetime retains authored offsets and leaves addressing to the sampler', () => {
    expect(coordinate({ type: 1, scale: 0.5, offset: 0.6 }, state)).toBe(0.725);
    expect(coordinate({ type: 1, scale: 2, offset: 0.9 }, state)).toBe(1.4);
  });
  it('velocity uses full source-unit travel magnitude without an invented divisor', () => {
    expect(coordinate({ type: 2, scale: 0.1, offset: 0.2 }, state)).toBe(1.5);
  });
  it('birth-random remains fixed when the age and travel change', () => {
    const axis = { type: 3, scale: 0.5, offset: 0.1 } as const;
    expect(coordinate(axis, state)).toBe(0.475);
    expect(coordinate(axis, { ...state, age01: 0.9, travelPerSecond: [300, 0, 0] })).toBe(0.475);
  });
  it('pins the hoop lookup, nominal lifetime, color and scale to its source emitter', () => {
    const e = source.data.complexEmitterDefinitionData.find((e) => e.emitterName === 'hoop')!;
    expect(e['{f02bd44d}']).toEqual([hoop.lookupX.scale, hoop.lookupY.scale]);
    expect(e).not.toHaveProperty('colorLookUpTypeX');
    expect(e).not.toHaveProperty('colorLookUpTypeY');
    expect(e.particleLifetime.constantValue).toBe(hoop.nominalLifetime);
    expect(e.birthColor?.constantValue).toEqual(hoop.birthColor);
    expect(e.scale0.dynamics.times).toEqual(hoop.scaleTimes);
    expect(e.scale0.dynamics.values).toEqual(hoop.relativeScale.map((v) => [v, v, v]));
    expect(coordinate(hoop.lookupX, state)).toBe(0.25);
    expect(coordinate(hoop.lookupY, state)).toBe(0.5);
  });
});
