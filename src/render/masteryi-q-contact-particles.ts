import data from '../content/masteryi-q-contact-particles.json';
import { luxEmissionBirthTick, luxEmissionCount } from '../content/lux-emission';
import type { AlphaContactVisual } from '../simulation/masteryi-q-contact-visuals';
import type { Team } from '../simulation/types';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';
import { sampleParticleCurve } from './particle-curves';
import { particleColorLookup } from './particle-color-lookup';

/** Complete native target profiles on the existing local emission/curve grid.
 * Cosmetic indexed draws never consume simulation randomness or entity IDs. */
export function alphaContactParticles(
  id: number,
  records: readonly AlphaContactVisual[],
  tick: number,
  viewer?: Team
) {
  if (!Number.isFinite(tick)) return [];
  return records.flatMap((record) =>
    data.profiles.flatMap((p, profileIndex) => {
      if (p.critical !== record.critical) return [];
      const now = tick - record.tick;
      const count = p.single
        ? now >= 1
          ? Math.max(1, Math.trunc(p.rate))
          : 0
        : luxEmissionCount(p.rate, now, p.emitterLife);
      const seed =
        id ^
        Math.imul(record.castTick, 0x9e3779b9) ^
        Math.imul(record.markIndex + 1, 0x27d4eb2d) ^
        Math.imul(profileIndex + 131, 0x85ebca6b);
      const frame = (at: number) =>
        record.frames[Math.max(0, Math.min(record.frames.length - 1, at - record.tick))];
      const known = (at: number) =>
        !viewer || [Math.floor(at), Math.ceil(at)].every((t) => frame(t).audience.includes(viewer));
      const point = (at: number) => {
        const a = frame(Math.floor(at)).point,
          b = frame(Math.ceil(at)).point,
          fraction = at - Math.floor(at);
        return { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction };
      };
      const particles = [];
      for (let ordinal = 1; ordinal <= count; ordinal++) {
        const born = p.single ? 1 : luxEmissionBirthTick(p.rate, ordinal),
          bornTick = record.tick + born;
        const age = (tick - bornTick) / 60,
          chance = luxHoopChance(seed, ordinal),
          roll = luxHoopChance(seed ^ 0x165667b1, ordinal);
        const sample = (value: Parameters<typeof luxBeamBirthOffset>[0]) =>
          luxBeamBirthOffset(value, chance);
        const life = sample(p.life)[0];
        if (
          age < 0 ||
          age >= life ||
          (viewer &&
            (!record.audience.includes(viewer) ||
              !known(bornTick) ||
              (p.bindWeight > 0 && !known(tick))))
        )
          continue;
        const phase = age / life,
          bornPoint = point(bornTick),
          currentPoint = point(tick);
        const position = sample(p.position),
          spawn = sample(p.spawnOffset),
          size = sample(p.size);
        const scale = size.map((v, axis) => v * sampleParticleCurve(p.scale, phase, axis));
        if (p.uniform) scale.fill(scale[0]);
        if (p.boundSize !== null)
          scale.forEach((v, axis) => {
            scale[axis] = v * record.radius * 2 * p.boundSize!;
          });
        if (p.boundOffset !== null)
          spawn.forEach((v, axis) => {
            spawn[axis] = v * record.radius * 2 * p.boundOffset!;
          });
        const rotation = sample(p.rotation),
          angular = sample(p.angularVelocity),
          scroll = sample(p.scroll);
        particles.push({
          record,
          profileIndex,
          ordinal,
          bornTick,
          age,
          life,
          phase,
          point: {
            x: bornPoint.x + (currentPoint.x - bornPoint.x) * p.bindWeight,
            y: bornPoint.y + (currentPoint.y - bornPoint.y) * p.bindWeight,
          },
          offset: position.map((v, axis) => v + spawn[axis]),
          scale,
          rotation: rotation.map((v, axis) => v + angular[axis] * age),
          scroll: scroll.map((v) => v * age),
          color: p.color.values[0],
          lookup: particleColorLookup(p, phase, roll),
        });
      }
      return particles;
    })
  );
}
