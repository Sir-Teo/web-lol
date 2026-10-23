import data from '../content/garen-aa-particles.json';
import { MOBILE_CLIP_DURATIONS } from '../content/mobile-clip-durations';
import { luxEmissionBirthTick, luxEmissionCount } from '../content/lux-emission';
import type { ChampionState, Team } from '../simulation/types';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';
import { sampleParticleCurve } from './particle-curves';
import { particleColorLookup } from './particle-color-lookup';
import { particleTravel } from './particle-motion';

/** Source probabilities remain correlated per birth. Indexed cosmetic draws
 * consume no World RNG. Timing/motion are the existing local 60 Hz adapters. */
export function garenAAParticles(
  id: number,
  records: ChampionState['garenAAVisuals'],
  tick: number,
  viewer?: Team
) {
  if (!Number.isFinite(tick)) return [];
  return records.flatMap((record) =>
    data.profiles.flatMap((p, profileIndex) => {
      if (p.deferred) return [];
      const hit = p.phase === 'hit';
      const event = data.events.find((e) => e.clip === record.kind && e.system === p.system);
      if (hit ? !record.impact || p.critical !== (record.kind === 'crit') : !event) return [];
      const eventTick = hit
        ? record.impact!.tick
        : Math.ceil(
            record.startTick +
              (event!.clipSeconds * (record.endTick - record.startTick)) /
                MOBILE_CLIP_DURATIONS['garen-base'][record.kind] -
              1e-5
          );
      const delay = Math.ceil(p.delay * 60 - 1e-5),
        now = tick - eventTick - delay;
      const stop =
        !hit && record.poseStopTick !== null ? record.poseStopTick - eventTick - delay : Infinity;
      // Bound swing layers stop with the pose. Confirmed hits have their own tail.
      if (!hit && tick >= (record.poseStopTick ?? record.endTick)) return [];
      const count = p.single
        ? now >= 1 && stop > 1
          ? Math.max(1, Math.trunc(p.rate))
          : 0
        : luxEmissionCount(p.rate, now, p.emitterLife, stop);
      const seed =
        id ^ Math.imul(record.startTick, 0x9e3779b9) ^ Math.imul(profileIndex + 81, 0x85ebca6b);
      const particles = [];
      for (let ordinal = 1; ordinal <= count; ordinal++) {
        const born = p.single ? 1 : luxEmissionBirthTick(p.rate, ordinal),
          bornTick = eventTick + delay + born,
          age = (tick - bornTick) / 60,
          chance = luxHoopChance(seed, ordinal),
          roll = luxHoopChance(seed ^ 0x27d4eb2d, ordinal);
        const sample = (value: Parameters<typeof luxBeamBirthOffset>[0]) =>
          luxBeamBirthOffset(value, chance);
        const life = sample(p.life)[0];
        if (age < 0 || age >= life) continue;
        if (hit && viewer) {
          const frames = record.impact!.frames,
            first = frames[0].tick;
          const known = (at: number) =>
            [Math.floor(at), Math.ceil(at)].every((t) =>
              frames[Math.max(0, Math.min(frames.length - 1, t - first))].audience.includes(viewer)
            );
          if (
            !record.impact!.audience.includes(viewer) ||
            !known(bornTick) ||
            (p.bindWeight > 0 && !known(tick))
          )
            continue;
        }
        const phase = age / life,
          velocity = sample(p.velocity),
          motion = particleTravel(velocity, sample(p.acceleration), sample(p.drag), age),
          position = sample(p.position),
          spawn = sample(p.spawnOffset),
          size = sample(p.size),
          rotation = sample(p.rotation),
          angular = sample(p.angularVelocity);
        const scale = size.map((v, axis) => v * sampleParticleCurve(p.scale, phase, axis));
        if (p.uniform) scale.fill(scale[0]);
        // Native bound-size interpretation is unobserved. This local adapter uses
        // the captured collision diameter; the source coefficient stays explicit.
        if (p.boundSize !== null)
          scale.forEach((v, axis) => (scale[axis] = v * record.impact!.radius * 2 * p.boundSize!));
        if (p.direction && p.kind !== 'ray' && Math.hypot(...motion.travel) > 0)
          scale[1] *= Math.max(
            p.directionMinScale,
            Math.hypot(...motion.travel) * p.directionScale
          );
        particles.push({
          record,
          profileIndex,
          ordinal,
          bornTick,
          age,
          life,
          phase,
          bone: hit ? data.hitBone : event!.bone,
          offset: position.map((v, axis) => v + spawn[axis] + motion.position[axis]),
          travel: motion.travel,
          scale,
          rotation: rotation.map((v, axis) => v + angular[axis] * age),
          color: [0, 1, 2, 3].map((axis) => sampleParticleCurve(p.color, phase, axis)),
          lookup: particleColorLookup(p, phase, roll, motion.travel),
          scroll: sample(p.scroll).map((v) => v * age),
          frame:
            (p.atlas.random ? Math.floor(roll * p.atlas.frames) : 0) %
            (p.atlas.grid[0] * p.atlas.grid[1]),
        });
      }
      return particles;
    })
  );
}
