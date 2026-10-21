import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import profiles from '../src/content/garen-r-particles.json';
import audit from '../docs/reference/garen-r-particle-profiles.json';
import { garenJusticeParticles, garenJusticeTravel } from '../src/render/garen-justice-particles';
import { GAREN_R_PARTICLE_START_TICKS } from '../src/content/garen-r-presentation';

const effect = {
  startTick: 100,
  targetId: 2,
  facing: 0.2,
  point: { x: 200, y: 0 },
  releaseTick: 127,
  stopTick: null,
};
test('R playback retains every source profile and explicitly defers the scene-distortion pass', () => {
  const hash = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
  expect(hash(audit.output.path)).toBe(audit.output.sha256);
  expect(hash('docs/reference/garen-r-particles.json')).toBe(audit.sourcePinSha256);
  expect(hash('docs/reference/garen-spin-defaults.json')).toBe(audit.defaultsEvidenceSha256);
  expect(audit.implemented).toHaveLength(16);
  expect(audit.deferred).toEqual([
    {
      role: 'impact',
      index: 10,
      reason: 'scene distortion requires a separate verified render pass',
    },
  ]);
  expect(profiles[4].multiplier).toContain('sword_fade');
  expect(profiles[3].acceleration.value).toEqual([0, -123300, 0]);
});
test('caster particle starts at frame ten under the existing local contact-marker mapping and emits source bursts', () => {
  expect(GAREN_R_PARTICLE_START_TICKS).toBeCloseTo((27 * 10) / 18.5);
  expect(garenJusticeParticles(1, effect, 100 + GAREN_R_PARTICLE_START_TICKS)).toEqual([]);
  const particles = garenJusticeParticles(1, effect, 101 + GAREN_R_PARTICLE_START_TICKS);
  expect(particles.filter((p) => p.profileIndex === 0)).toHaveLength(40);
  expect(particles.filter((p) => p.profileIndex === 1)).toHaveLength(2);
  expect(particles.every((p) => p.age === 0)).toBe(true);
});
test('sword drop keeps source velocity and acceleration instead of inventing a fixed-height impact sprite', () => {
  const motion = garenJusticeTravel([0, -2100, 0], [0, -123300, 0], [0, 0, 0], 0.05);
  expect(motion.position[1]).toBeCloseTo(-105 - 154.125);
  expect(motion.travel[1]).toBeCloseTo(-2100 - 6165);
  const tick = effect.startTick + GAREN_R_PARTICLE_START_TICKS + 7 + 3;
  const sword = garenJusticeParticles(1, effect, tick).find((p) => p.profileIndex === 3)!;
  expect(sword.age).toBeCloseTo(0.05);
  expect(sword.offset[1]).toBeCloseTo(1120 - 105 - 154.125);
  expect(sword.scale).toEqual([3.5, 5, 3.5]);
});
test('all sixteen selected layer identities reconstruct deterministically with bounded finite draws and valid random atlas cells', () => {
  const seen = new Set<number>();
  for (let tick = 100; tick < 290; tick += 0.5) {
    const particles = garenJusticeParticles(1, effect, tick);
    expect(particles.length).toBeLessThan(180);
    for (const p of particles) {
      seen.add(p.profileIndex);
      expect([
        ...p.offset,
        ...p.travel,
        ...p.scale,
        ...p.rotation,
        ...p.color,
        ...p.scroll,
        ...p.multiplier,
        ...p.lookup,
      ]).toSatisfy((v: number[]) => v.every(Number.isFinite));
      expect(p.frame).toBeGreaterThanOrEqual(0);
      expect(p.frame).toBeLessThan(profiles[p.profileIndex].atlas.grid.reduce((a, b) => a * b, 1));
    }
  }
  expect([...seen].sort((a, b) => a - b)).toEqual(
    profiles.flatMap((p, i) => (p.deferred ? [] : [i]))
  );
  const at = garenJusticeParticles(1, effect, 136);
  garenJusticeParticles(1, effect, 200);
  expect(garenJusticeParticles(1, effect, 136)).toEqual(at);
  expect(garenJusticeParticles(2, effect, 136)).not.toEqual(at);
  expect(
    new Set(at.filter((p) => profiles[p.profileIndex].name === 'dirt').map((p) => p.frame)).size
  ).toBe(4);
});
test('cancelled and unreleased R never emit impact layers; cancellation removes the target sword while born caster particles finish', () => {
  const pending = { ...effect, releaseTick: null };
  expect(
    garenJusticeParticles(1, pending, 128).every((p) => profiles[p.profileIndex].role !== 'impact')
  ).toBe(true);
  const cancelled = { ...pending, stopTick: 123 };
  const atStop = garenJusticeParticles(1, cancelled, 123);
  expect(atStop.length).toBeGreaterThan(0);
  expect(atStop.every((p) => profiles[p.profileIndex].role === 'cast')).toBe(true);
  expect(garenJusticeParticles(1, { ...pending, stopTick: 101 }, 130)).toEqual([]);
  expect(garenJusticeParticles(1, cancelled, 400)).toEqual([]);
});
test('impact decal follows its release clock and retains its full natural lifetime', () => {
  const index = profiles.findIndex((p) => p.name === 'ground_decal');
  const born = garenJusticeParticles(1, effect, 131).find((p) => p.profileIndex === index)!;
  expect(born.age).toBe(0);
  expect(born.offset).toEqual([0, 3, 0]);
  expect(garenJusticeParticles(1, effect, 265).some((p) => p.profileIndex === index)).toBe(true);
  expect(garenJusticeParticles(1, effect, 266).some((p) => p.profileIndex === index)).toBe(false);
});
