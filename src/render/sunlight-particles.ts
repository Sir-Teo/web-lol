import profiles from '../content/leona-sunlight-particles.json';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';
import { sampleParticleCurve } from './particle-curves';
import { particleColorLookup } from './particle-color-lookup';
import { particleTravel } from './particle-motion';
import { luxEmissionCount, luxEmissionBirthTick } from '../content/lux-emission';

/** Authored values, indexed cosmetic randomness and seekable local 60 Hz motion.
 * Native PRNG, cadence and the bound-size input have not been measured. */
export function sunlightParticles(
  role: 'mark' | 'champion' | 'hit',
  seed: number,
  time: number,
  radius: number
) {
  if (!Number.isFinite(time) || time < 0 || !Number.isFinite(radius) || radius <= 0) return [];
  return profiles.flatMap((p, profileIndex) => {
    if (p.role !== role) return [];
    const count = p.single
      ? time >= 1 / 60
        ? Math.max(1, Math.trunc(p.rate))
        : 0
      : luxEmissionCount(p.rate, time * 60, p.emitterLife);
    const particles = [];
    for (let ordinal = 1; ordinal <= count; ordinal++) {
      const bornTick = p.single ? 1 : luxEmissionBirthTick(p.rate, ordinal),
        age = time - bornTick / 60;
      const chance = luxHoopChance(seed ^ Math.imul(profileIndex + 1, 0x85ebca6b), ordinal);
      const sample = (v: Parameters<typeof luxBeamBirthOffset>[0]) => luxBeamBirthOffset(v, chance);
      const life = sample(p.life)[0];
      if (age < 0 || age >= life) continue;
      const phase = age / life,
        size = sample(p.size).map((v, axis) => v * sampleParticleCurve(p.scale, phase, axis));
      if (p.uniform) size.fill(size[0]);
      const velocity = sample(p.velocity),
        motion = particleTravel(velocity, [0, 0, 0], sample(p.drag), age);
      // Explicit collision-diameter adapter, shared with the existing AA policy.
      const bound = p.boundOffset === null ? 1 : 2 * radius * p.boundOffset;
      const offset = p.offset.map((v, axis) => v * bound + motion.position[axis]);
      const spin = sample(p.spin),
        rotation = sample(p.rotation).map((v, axis) => v + spin[axis] * age);
      const color = sample(p.birthColor).map((v, axis) => v * p.color[axis]);
      particles.push({
        profileIndex,
        ordinal,
        bornTick,
        age,
        life,
        phase,
        size,
        offset,
        rotation,
        color,
        lookup: particleColorLookup(p, phase, chance, motion.travel),
        bind: p.bind,
      });
    }
    return particles;
  });
}
