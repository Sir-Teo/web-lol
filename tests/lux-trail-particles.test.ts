import { expect, it } from 'vitest';
import source from '../docs/reference/lux-basic-attack.json';
import { LUX_BASIC_TRAIL as trail } from '../src/content/lux-basic-trail';
import { luxTrailParticles } from '../src/render/lux-trail-particles';
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
      x: i * 100,
      y: 0,
      facing: Math.PI / 2,
      distance: i * 100,
    })),
  };
}
it('matches the binary-verified trail source profile, including authored curve values', () => {
  const s: any = source.data.complexEmitterDefinitionData.find((e) => e.emitterName === 'Trail');
  expect(trail.rate).toBe(s.rate.constantValue);
  expect(trail.particleLife).toBe(s.particleLifetime.constantValue);
  expect(trail.emitterLife).toBe(s.lifetime);
  expect(trail.offset).toEqual(s.EmitterPosition.constantValue);
  expect(trail.blend).toBe(s.blendMode);
  expect(trail.multScroll).toEqual(s.textureMult['{e19d1593}']);
  const primitive = s.primitive['{5e661fd4}'];
  expect(trail.mode).toBe(primitive['{ac59cf4b}']);
  expect(trail.cutoff).toBe(primitive['{ee88201d}']);
  expect(trail.tiling).toEqual(primitive['{8c784fc7}'].constantValue.slice(0, 2));
  for (const [profile, field] of [
    [trail.birthColor, s.birthColor],
    [trail.color, s.Color],
    [trail.shapeRotationDegrees, s.SpawnShape.emitRotationAngles[0]],
  ] as const) {
    expect(profile.times).toEqual(field.dynamics.times);
    expect(profile.values).toEqual(field.dynamics.values);
  }
  for (const [profile, field] of [
    [trail.birthWidth, s.birthScale0],
    [trail.relativeWidth, s.scale0],
  ] as const) {
    expect(profile.times).toEqual(field.dynamics.times);
    expect(profile.values).toEqual(field.dynamics.values.map((v: number[]) => v[0]));
  }
});
it('uses birth-time width and particle-age color/scale without turning the particle frame', () => {
  const point = luxTrailParticles(effect(), 12).find((p) => p.ordinal === 5)!;
  expect(point.birthTick).toBe(6);
  expect(point.age).toBeCloseTo(0.1);
  expect(point.position).toEqual([600, 50, 0]);
  expect(point.wakeU).toBe(1.2);
  expect(point.halfWidth).toBeCloseTo(
    (10 + (40 * (0.1 / 1.05)) / 0.2) * (1 + (0.5 * (0.2 - 0.1)) / 0.9),
    4
  );
  expect(point.facing).toBe(Math.PI / 2);
  expect(point.color[3]).toBeCloseTo(0.345, 4);
  expect(point.multScroll).toEqual([0.1, 0]);
});
it('keeps wake coordinates pinned when the saved prefix and older particles retire', () => {
  const e = effect();
  const before = luxTrailParticles(e, 60);
  expect(before.length).toBeGreaterThan(20);
  expect(before.every((p, i) => i === 0 || p.ordinal < before[i - 1].ordinal)).toBe(true);
  e.frames = e.frames.slice(-40);
  expect(luxTrailParticles(e, 60)).toEqual(before);
  const later = luxTrailParticles(e, 61);
  for (const p of later) {
    const prior = before.find((v) => v.ordinal === p.ordinal);
    if (prior) expect(p.wakeU).toBe(prior.wakeU);
  }
});
it('stops births at impact, restores exact points, and retires the final point', () => {
  const e = effect();
  e.stopTick = 12;
  for (const tick of [12, 18.5, 35, 12]) {
    const points = luxTrailParticles(e, tick);
    expect(luxTrailParticles(JSON.parse(JSON.stringify(e)), tick)).toEqual(points);
    expect(points.every((p) => p.birthTick <= 12)).toBe(true);
  }
  expect(luxTrailParticles(e, 42)).toEqual([]);
});

it('retains each birth heading through a turn without inheriting shape rotation or later heading', () => {
  const e = effect();
  for (const frame of e.frames) frame.facing = frame.tick < 8 ? 0 : Math.PI / 2;
  const points = luxTrailParticles(e, 16);
  expect(points.length).toBeGreaterThan(5);
  for (const point of points) expect(point.facing).toBe(point.birthTick < 8 ? 0 : Math.PI / 2);
  const s: any = source.data.complexEmitterDefinitionData.find((v) => v.emitterName === 'Trail');
  expect(s).not.toHaveProperty('birthRotation0');
  expect(s).not.toHaveProperty('birthVelocity');
  expect(s.SpawnShape).not.toHaveProperty('emitOffset');
});
