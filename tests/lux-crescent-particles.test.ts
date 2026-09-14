import { expect, it } from 'vitest';
import source from '../docs/reference/lux-basic-attack.json';
import { LUX_BASIC_CRESCENT as c } from '../src/content/lux-basic-crescent';
import { luxCrescentParticles } from '../src/render/lux-crescent-particles';
import type { LuxAttackVisual } from '../src/simulation/types';
function effect(): LuxAttackVisual {
  return {
    id: 42,
    sourceId: 1,
    team: 'blue',
    origin: { x: 0, y: 0 },
    launchTick: 0,
    stopTick: null,
    frames: Array.from({ length: 61 }, (_, i) => ({
      tick: i,
      x: i * 20,
      y: i < 10 ? 0 : (i - 10) * 10,
      facing: i < 10 ? Math.PI / 2 : 1,
      distance: i * 25,
    })),
  };
}
it('matches the pinned crescent source values and all reconstruction curves', () => {
  const s: any = source.data.complexEmitterDefinitionData.find(
    (e) => e.emitterName === 'crescentwhite'
  );
  expect(c.rate).toBe(s.rate.constantValue);
  expect(c.particleLife).toBe(s.particleLifetime.constantValue);
  expect(c.emitterLife).toBe(s.lifetime);
  for (const [profile, field] of [
    [c.velocity, s.birthVelocity],
    [c.bind, s.bindWeight],
    [c.scale, s.scale0],
  ] as const) {
    expect(profile.times).toEqual(field.dynamics.times);
    expect(profile.values).toEqual(field.dynamics.values);
  }
  expect(c.drag).toEqual(s.birthDrag.constantValue);
  expect(c.offset).toEqual(s.EmitterPosition.constantValue);
  expect(c.rotationDegrees).toEqual(s.birthRotation0.constantValue);
  expect(c.birthScale).toEqual(s.birthScale0.constantValue);
  expect(c.lookupScales).toEqual(s['{f02bd44d}']);
  expect(c.lookupOffsets).toEqual(s['{cd5a323e}']);
});
it('accumulates per-step binding rather than multiplying net travel by the final weight', () => {
  const e = effect(),
    p = luxCrescentParticles(e, 15).find((p) => p.ordinal === 1)!;
  let x = 60,
    z = 0,
    y = -50,
    v = 400 * (3 / 60 / c.emitterLife);
  for (let tick = 4; tick <= 15; tick++) {
    const weight = c.bind.values[0] * Math.max(0, 1 - tick / 60 / c.emitterLife);
    x += 20 * weight;
    z += (tick > 10 ? 10 : 0) * weight;
    v *= 1 - 2 / 60;
    y += v / 60;
  }
  expect(p.position[0]).toBeCloseTo(x, 10);
  expect(p.position[2]).toBeCloseTo(z, 10);
  expect(p.position[1]).toBeCloseTo(y, 10);
  expect(p.facing).toBe(Math.PI / 2);
  expect(p.position[0]).not.toBeCloseTo(
    60 + 240 * c.bind.values[0] * (1 - 15 / 60 / c.emitterLife),
    5
  );
});
it('applies source scale and default lookup modes, including the constant Y axis', () => {
  const p = luxCrescentParticles(effect(), 3)[0];
  expect(p.position).toEqual([60, -50, 0]);
  expect(p.scale).toEqual([1, 18, 3 * c.scale.values[0][2]]);
  expect(p.lookup).toEqual([c.lookupOffsets[0], 1]);
  const later = luxCrescentParticles(effect(), 21).find((p) => p.ordinal === 1)!;
  expect(later.scale[0]).toBeCloseTo(3, 5);
  expect(later.scale[1]).toBeCloseTo(3, 5);
  expect(later.lookup[0]).toBeCloseTo(0.85, 5);
  expect(later.lookup[1]).toBe(1);
});
it('interpolates the final integration interval and survives retained history / JSON replay', () => {
  const e = effect();
  const a = luxCrescentParticles(e, 12)[0],
    b = luxCrescentParticles(e, 13)[0],
    mid = luxCrescentParticles(e, 12.5)[0];
  mid.position.forEach((v, axis) =>
    expect(v).toBeCloseTo((a.position[axis] + b.position[axis]) / 2, 10)
  );
  const complete = luxCrescentParticles(e, 50);
  expect(complete.length).toBeGreaterThan(0);
  e.frames = e.frames.slice(11);
  expect(luxCrescentParticles(e, 50)).toEqual(complete);
  expect(luxCrescentParticles(JSON.parse(JSON.stringify(e)), 50)).toEqual(complete);
});
it('stops emission on impact or emitter lifetime and retires on source float lifetime', () => {
  const e = effect();
  expect(luxCrescentParticles(e, 19).every((p) => p.birthTick <= 18)).toBe(true);
  e.stopTick = 6;
  e.frames = e.frames.slice(0, 7);
  expect(luxCrescentParticles(e, 8)).toHaveLength(2);
  // Authored life is slightly longer than exactly 0.6 seconds.
  expect(luxCrescentParticles(e, 42)).toHaveLength(1);
  expect(luxCrescentParticles(e, 43)).toEqual([]);
});
