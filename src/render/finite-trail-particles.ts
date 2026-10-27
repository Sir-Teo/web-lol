import type data from '../content/masteryi-primary-trail-particles.json';
import { luxEmissionBirthTick, luxEmissionCount } from '../content/lux-emission';
import { luxHoopChance } from './lux-hoop-particles';
import { eclipseValue, eclipseUv, type EclipseValue } from './leona-eclipse-values';
import { particleColorLookup } from './particle-color-lookup';
import { particleTravel } from './particle-motion';

/** Complete current primary trails on the existing local first-update grid.
 * Linger values do not extend finite source lives. No simulation RNG is consumed. */
type TrailProfile = Pick<
  (typeof data.profiles)[number],
  | 'delay'
  | 'emitterLife'
  | 'rate'
  | 'single'
  | 'life'
  | 'position'
  | 'shape'
  | 'velocity'
  | 'worldAcceleration'
  | 'scale'
  | 'spin'
  | 'color'
  | 'size'
  | 'uniform'
  | 'uv'
  | 'birthColor'
  | 'rotation'
  | 'bind'
  | 'lookupTypes'
  | 'lookupScales'
  | 'lookupOffsets'
>;
export function finiteTrailParticles(
  profiles: readonly TrailProfile[],
  seed: number,
  time: number,
  profile?: number
) {
  if (!Number.isFinite(time) || time < 0) return [];
  return profiles.flatMap((p, profileIndex) => {
    if (profile !== undefined && profileIndex !== profile) return [];
    const delay = Math.max(1, Math.ceil(p.delay * 60 - 1e-5)),
      emitterLife = p.emitterLife ?? Infinity,
      rate = p.rate.values[0][0],
      now = time * 60 - delay + 1,
      count = p.single
        ? now >= 1
          ? Math.max(1, Math.trunc(rate))
          : 0
        : luxEmissionCount(rate, now, emitterLife);
    const particles = [];
    for (let ordinal = 1; ordinal <= count; ordinal++) {
      const bornTick = delay + (p.single ? 0 : luxEmissionBirthTick(rate, ordinal) - 1),
        age = time - bornTick / 60,
        birthPhase = Math.min(1, bornTick / 60 / emitterLife),
        chance = luxHoopChance(seed ^ Math.imul(profileIndex + 1, 0x85ebca6b), ordinal),
        roll = luxHoopChance(seed ^ Math.imul(profileIndex + 1, 0x85ebca6b) ^ 0x27d4eb2d, ordinal),
        sample = (value: EclipseValue) => eclipseValue(value, birthPhase, chance),
        life = sample(p.life)[0];
      if (age < 0 || age >= life) continue;
      const phase = age / life,
        position = sample(p.position),
        spawn = sample(p.shape.offset),
        origin = position.map((v, axis) => v + spawn[axis]),
        velocity = sample(p.velocity),
        acceleration = sample(p.worldAcceleration),
        motion = particleTravel(velocity, [0, 0, 0], [0, 0, 0], age),
        world = particleTravel([0, 0, 0], acceleration, [0, 0, 0], age),
        scale = eclipseValue(p.scale, phase),
        spin = sample(p.spin),
        color = eclipseValue(p.color, phase),
        size = sample(p.size).map((v, axis) => v * scale[axis]);
      if (p.uniform) size.fill(size[0]);
      const uv = eclipseUv(p.uv, age, life, birthPhase, phase, chance, roll);
      particles.push({
        profileIndex,
        ordinal,
        bornTick,
        age,
        naturalLife: life,
        life,
        phase,
        offset: origin.map((v, axis) => v + motion.position[axis]),
        worldOffset: world.position,
        worldTravel: world.travel,
        size,
        color: sample(p.birthColor).map((v, axis) => v * color[axis]),
        rotation: sample(p.rotation).map((v, axis) => v + spin[axis] * age),
        spawnTurn: [0, 0, 0, 1] as [number, number, number, number],
        travel: motion.travel,
        stretch: 1,
        bind: eclipseValue(p.bind, Math.min(1, time / emitterLife))[0],
        lookup: particleColorLookup(
          p,
          phase,
          roll,
          motion.travel.map((v, axis) => v + world.travel[axis])
        ),
        uv,
        multUv: null,
        erosion: 0,
      });
    }
    return particles;
  });
}
