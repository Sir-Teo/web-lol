import { orbitalParticleTravel } from './particle-orbital-motion';
import data from '../content/masteryi-w-cast-particles.json';
import { luxEmissionBirthTick, luxEmissionCount } from '../content/lux-emission';
import { luxHoopChance } from './lux-hoop-particles';
import { eclipseValue, eclipseUv, type EclipseValue } from './leona-eclipse-values';
import { particleColorLookup } from './particle-color-lookup';
import { particleTravel } from './particle-motion';
import { particleHalf } from './particle-half';

/** Complete W_Cas on the existing local first-update/random/force grid.
 * Linger values do not extend finite source lives. No simulation RNG is consumed. */
export function meditateCastParticles(seed: number, time: number) {
  if (!Number.isFinite(time) || time < 0) return [];
  return data.profiles.flatMap((p, profileIndex) => {
    const rate = p.rate.values[0][0],
      count = p.single
        ? time * 60 >= 1
          ? Math.max(1, Math.trunc(rate))
          : 0
        : luxEmissionCount(rate, time * 60, p.emitterLife);
    const particles = [];
    for (let ordinal = 1; ordinal <= count; ordinal++) {
      const bornTick = p.single ? 1 : luxEmissionBirthTick(rate, ordinal),
        age = time - bornTick / 60,
        birthPhase = Math.min(1, bornTick / 60 / p.emitterLife),
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
        fields = p.orbitalField
          ? orbitalParticleTravel(velocity, acceleration, origin, age, p.orbitalField.axis)
          : null,
        motion = fields?.local ?? particleTravel(velocity, [0, 0, 0], [0, 0, 0], age),
        world = fields?.world ?? particleTravel([0, 0, 0], acceleration, [0, 0, 0], age),
        scale = eclipseValue(p.scale, phase),
        spin = sample(p.spin),
        color = eclipseValue(p.color, phase),
        size = sample(p.size).map((v, axis) => v * scale[axis]);
      if (p.uniform) size.fill(size[0]);
      const lookup = particleColorLookup(
        p,
        phase,
        roll,
        motion.travel.map((v, axis) => v + world.travel[axis])
      );
      if (p.kind === 'ray') {
        lookup[0] = particleHalf(lookup[0]);
        lookup[1] = particleHalf(lookup[1]);
      }
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
        bind: eclipseValue(p.bind, Math.min(1, time / p.emitterLife))[0],
        lookup,
        uv: eclipseUv(p.uv, age, life, birthPhase, phase, chance, roll),
        multUv: p.multiplier
          ? eclipseUv(p.multiplier.uv, age, life, birthPhase, phase, chance, roll)
          : null,
        erosion: 0,
      });
    }
    return particles;
  });
}
