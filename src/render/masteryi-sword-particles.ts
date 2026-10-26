import data from '../content/masteryi-sword-particles.json';
import { luxEmissionBirthTick, luxEmissionCount } from '../content/lux-emission';
import { luxHoopChance } from './lux-hoop-particles';
import { eclipseValue, eclipseUv, type EclipseValue } from './leona-eclipse-values';
import { particleColorLookup } from './particle-color-lookup';
import { particleTravel } from './particle-motion';

/** Complete sword profiles on the existing local first-update/random/force grid.
 * Linger values do not extend finite source lives. No simulation RNG is consumed. */
export function swordGlowParticles(
  seed: number,
  time: number,
  stopTime = Infinity,
  system?: string
) {
  if (!Number.isFinite(time) || time < 0 || Number.isNaN(stopTime) || stopTime < 0) return [];
  const rawStopTick = stopTime * 60;
  const stopTick =
    Math.abs(rawStopTick - Math.round(rawStopTick)) < 1e-5 ? Math.round(rawStopTick) : rawStopTick;
  return data.profiles.flatMap((p, profileIndex) => {
    if (system && p.system !== system) return [];
    const delay = Math.max(1, Math.ceil(p.delay * 60 - 1e-5)),
      emitterLife = p.emitterLife ?? Infinity,
      rate = p.rate.values[0][0],
      now = time * 60 - delay + 1,
      count = p.single
        ? now >= 1 && stopTick > delay
          ? Math.max(1, Math.trunc(rate))
          : 0
        : luxEmissionCount(rate, now, emitterLife, stopTick);
    const particles = [];
    const maximumLife = p.life.values[0][0];
    const first = p.single ? 1 : Math.max(1, Math.floor((time - maximumLife) * rate) - 1);
    for (let ordinal = first; ordinal <= count; ordinal++) {
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
        multUv: p.multiplier
          ? eclipseUv(p.multiplier.uv, age, life, birthPhase, phase, chance, roll)
          : null,
        erosion: 0,
      });
    }
    return particles;
  });
}
