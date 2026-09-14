import { describe, expect, it } from 'vitest';
import { luxImpactRings } from '../src/render/lux-impact-rings';
import profiles from '../src/content/lux-impact-rings.json';
import source from '../docs/reference/lux-attack-impact.json';

describe('Lux impact ring birth playback', () => {
  it('keeps active source profiles, exact lifetimes and uniform-scale X', () => {
    const records =
      source.records['Characters/Lux/Skins/Skin0/Particles/Lux_Base_BA_tar_crit']
        .complexEmitterDefinitionData;
    expect(profiles.map((p) => p.name)).toEqual(['flash', 'ring', 'blastring', 'outerring']);
    for (const p of profiles) {
      const e = records.find((e) => e.emitterName === p.name)!;
      expect(p.life).toBe(e.particleLifetime.constantValue);
      expect(p.scale).toBe(e.birthScale0.constantValue[0]);
      expect(p.scaleTimes).toEqual(e.scale0.dynamics.times);
      expect(p.scales).toEqual(e.scale0.dynamics.values.map((v) => v[0]));
      expect(luxImpactRings(p.life - 1e-8, true, 0.25).some((s) => s.name === p.name)).toBe(true);
      expect(luxImpactRings(p.life, true, 0.25).some((s) => s.name === p.name)).toBe(false);
    }
  });
  it('samples authored keyframes and birth chance without accumulating seek state', () => {
    for (const p of profiles)
      for (let i = 0; i < p.scaleTimes.length; i++) {
        if (p.scaleTimes[i] === 1) continue;
        const age = p.scaleTimes[i] * p.life;
        const state = luxImpactRings(age, true, 0.25).find((s) => s.name === p.name)!;
        expect(state.size).toBeCloseTo(p.scale * p.scales[i], 10);
      }
    expect(luxImpactRings(0, true, 0).find((s) => s.name === 'flash')!.rotation).toBe(0);
    expect(luxImpactRings(0, true, 1).find((s) => s.name === 'flash')!.rotation).toBe(360);
    expect(luxImpactRings(0, true, 0.25).find((s) => s.name === 'blastring')!.color[3]).toBe(0);
    const before = luxImpactRings(0.05, true, 0.7);
    luxImpactRings(0.49, true, 0.2);
    expect(luxImpactRings(0.05, true, 0.7)).toEqual(before);
    const normal = luxImpactRings(0.05, false, 0.7);
    expect(normal).toEqual(before.filter((p) => ['blastring', 'outerring'].includes(p.name)));
    expect(luxImpactRings(-1, true, 0.5)).toEqual([]);
    expect(luxImpactRings(Infinity, true, 0.5)).toEqual([]);
    expect(() => luxImpactRings(0, true, NaN)).toThrow(RangeError);
  });
  it('uses lifetime versus constant lookup coordinates correctly', () => {
    const flash = luxImpactRings(0.05, true, 0.5).find((s) => s.name === 'flash')!;
    expect(flash.lookup[0]).toBeCloseTo(0.5, 6);
    expect(flash.lookup[1]).toBe(0.5);
    const outer = luxImpactRings(0.125, false, 0.5).find((s) => s.name === 'outerring')!;
    expect(outer.lookup).toEqual([0.75, 0.5]);
    const ring = luxImpactRings(0.25, true, 0.5).find((s) => s.name === 'ring')!;
    expect(ring.lookup).toEqual([0.75, 1]);
  });
});
