import { Vector3 } from 'three';
import profiles from '../content/garen-q-impact-particles.json';
import type { ChampionState } from '../simulation/types';
import { luxEmissionBirthTick, luxEmissionCount } from '../content/lux-emission';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';
import { sampleParticleCurve } from './particle-curves';
import { particleColorLookup } from './particle-color-lookup';
import { particleHalf } from './particle-half';

/** Confirmed contacts alone dispatch this local one-shot. Later pose/armed stops
 * do not cancel it. Indexed birth chance/roll consume no simulation RNG; source
 * distributions share their chance, including the legacy shape's turn. */
export function garenQImpactParticles(
  id: number,
  records: ChampionState['garenQVisuals'],
  tick: number
) {
  if (!Number.isFinite(tick)) return [];
  return records.flatMap((record) =>
    record.attacks.flatMap((attack) => {
      const impact = attack.impact;
      if (!impact || tick <= impact.tick) return [];
      const now = tick - impact.tick;
      return profiles.flatMap((p, profileIndex) => {
        const count = p.single
          ? now >= 1
            ? Math.max(1, Math.trunc(p.rate))
            : 0
          : luxEmissionCount(p.rate, now, p.emitterLife);
        const seed = id ^ Math.imul(impact.tick, 0x9e3779b9) ^ Math.imul(p.index + 41, 0x85ebca6b);
        const particles = [];
        for (let ordinal = 1; ordinal <= count; ordinal++) {
          const born = p.single ? 1 : luxEmissionBirthTick(p.rate, ordinal),
            age = (now - born) / 60,
            chance = luxHoopChance(seed, ordinal),
            roll = luxHoopChance(seed ^ 0x27d4eb2d, ordinal);
          const sample = (v: Parameters<typeof luxBeamBirthOffset>[0]) =>
            luxBeamBirthOffset(v, chance);
          const life = sample(p.life)[0];
          if (age < 0 || age >= life) continue;
          const phase = age / life,
            velocity = new Vector3(...sample(p.velocity)),
            spawn = new Vector3(...sample(p.spawnOffset));
          p.spawnAngles.forEach((v, i) => {
            const axis = new Vector3(...p.spawnAxes[i]).normalize(),
              angle = (sample(v)[0] * Math.PI) / 180;
            velocity.applyAxisAngle(axis, angle);
            spawn.applyAxisAngle(axis, angle);
          });
          const origin = sample(p.position),
            size = sample(p.size);
          const scale = size.map((v, axis) => v * sampleParticleCurve(p.scale, phase, axis));
          if (p.direction && p.kind !== 'ray' && velocity.lengthSq() > 0)
            scale[1] *= Math.max(p.directionMinScale, velocity.length() * p.directionScale);
          const lookup = particleColorLookup(p, phase, roll, velocity.toArray());
          if (p.kind === 'ray') {
            lookup[0] = particleHalf(lookup[0]);
            lookup[1] = particleHalf(lookup[1]);
          }
          particles.push({
            castTick: record.startTick,
            startTick: attack.startTick,
            impactTick: impact.tick,
            point: impact.point,
            facing: impact.facing,
            profileIndex,
            ordinal,
            age,
            life,
            phase,
            offset: origin.map(
              (v, axis) => v + spawn.getComponent(axis) + velocity.getComponent(axis) * age
            ),
            travel: velocity.toArray(),
            scale,
            rotation: sample(p.rotation),
            color: [0, 1, 2, 3].map((axis) => sampleParticleCurve(p.color, phase, axis)),
            lookup,
            frame:
              (p.atlas.start + (p.atlas.random ? Math.floor(roll * p.atlas.frames) : 0)) %
              (p.atlas.grid[0] * p.atlas.grid[1]),
          });
        }
        return particles;
      });
    })
  );
}
