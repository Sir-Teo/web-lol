import { Vector3 } from 'three';
import p from '../content/garen-passive-particles.json';
import type { ChampionState } from '../simulation/types';
import { luxEmissionBirthTick, luxEmissionCount } from '../content/lux-emission';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';
import { luxEBurstTravel } from './lux-e-burst-particles';
import { sampleParticleCurve } from './particle-curves';
import { particleColorLookup } from './particle-color-lookup';

/** Bounded seeks: inspect only births within the maximum source particle life.
 * Shared birth chance, radians/second orbit and 60 Hz linear drag retain the
 * existing local particle conventions; native RNG/integrator remain unverified. */
export function garenPassiveParticles(
  id: number,
  records: ChampionState['garenPassiveVisuals'],
  tick: number
) {
  if (!Number.isFinite(tick)) return [];
  return records.flatMap((record) => {
    const now = tick - record.startTick,
      stop = record.stopTick === null ? Infinity : record.stopTick - record.startTick,
      count = luxEmissionCount(p.rate, now, Infinity, stop),
      first = Math.max(1, Math.floor(((now - p.maxLife * 60) * p.rate) / 60));
    const seed = id ^ Math.imul(record.startTick, 0x9e3779b9),
      particles = [];
    for (let ordinal = first; ordinal <= count; ordinal++) {
      const age = (now - luxEmissionBirthTick(p.rate, ordinal)) / 60,
        chance = (channel: number) => luxHoopChance(seed ^ Math.imul(channel, 0x85ebca6b), ordinal),
        sample = (value: Parameters<typeof luxBeamBirthOffset>[0], channel: number) =>
          luxBeamBirthOffset(value, chance(channel)),
        life = sample(p.life, 1)[0];
      if (age < 0 || age >= life) continue;
      const phase = age / life,
        motion = luxEBurstTravel(sample(p.velocity, 2), [0, 0, 0], p.drag, age),
        offset = new Vector3(...sample(p.offset, 3)).add(new Vector3(...motion.position)),
        orbit = sample(p.orbit, 4)[1];
      offset.applyAxisAngle(new Vector3(0, 1, 0), orbit * age);
      offset.add(new Vector3(...p.position));
      particles.push({
        startTick: record.startTick,
        ordinal,
        age,
        life,
        offset: offset.toArray(),
        point: record.point,
        scale: p.size.map((v, axis) => v * sampleParticleCurve(p.scale, phase, axis)),
        color: [0, 1, 2, 3].map((axis) => sampleParticleCurve(p.color, phase, axis)),
        lookup: particleColorLookup(p, phase, chance(5), motion.travel),
      });
    }
    return particles;
  });
}
