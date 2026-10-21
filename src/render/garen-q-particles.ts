import castProfiles from '../content/garen-q-cast-particles.json';
import { luxEmissionBirthTick, luxEmissionCount } from '../content/lux-emission';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';
import { sampleParticleCurve } from './particle-curves';
import profile from '../content/garen-q-particles.json';
import { GAREN_Q } from '../content/garen-q';
import type { ChampionState } from '../simulation/types';
import { particleColorLookup } from './particle-color-lookup';

/** The existing Q pose maps frame 10 to captured release. Frame 8 follows
 * that same provisional mapping, then the local first-update birth convention.
 * An interrupted primary pose hard-stops this bone-bound effect. */
export function garenQTrailParticles(records: ChampionState['garenQVisuals'], tick: number) {
  if (!Number.isFinite(tick)) return [];
  return records.flatMap((record) =>
    record.attacks.flatMap((attack) => {
      const eventTick =
        attack.startTick +
        ((attack.releaseTick - attack.startTick) * profile.startFrame) /
          GAREN_Q.attackTiming.animationCastFrame;
      const bornTick = Math.ceil(eventTick - 1e-5) + 1;
      const age = (tick - bornTick) / 60;
      if (age < 0 || age >= profile.life || (attack.stopTick !== null && tick >= attack.stopTick))
        return [];
      return Array.from({ length: profile.count }, (_, ordinal) => ({
        castTick: record.startTick,
        startTick: attack.startTick,
        bornTick,
        ordinal,
        age,
        facing: attack.facing,
        lookup: particleColorLookup(profile, age / profile.life, 0),
        scroll: profile.scroll.map((v) => v * age),
      }));
    })
  );
}

/** Local dispatch: Cas is an accepted activation one-shot; Cas_Sword follows
 * the armed interval. Type-0 settlement caps total life after an absolute
 * emitter-age wait, not a fresh wait measured from the buff stop. */
export function garenQCastParticles(
  id: number,
  records: ChampionState['garenQVisuals'],
  tick: number
) {
  if (!Number.isFinite(tick)) return [];
  return records.flatMap((record) =>
    castProfiles.flatMap((p, profileIndex) => {
      const delay = Math.ceil(p.delay * 60 - 1e-5),
        now = tick - record.startTick - delay;
      const stop =
        p.role === 'armed' && record.stopTick !== null
          ? record.stopTick - record.startTick - delay
          : Infinity;
      const count = p.single
        ? now >= 1 && stop > 1
          ? Math.max(1, Math.trunc(p.rate))
          : 0
        : luxEmissionCount(p.rate, now, p.emitterLife ?? Infinity, stop);
      const wait = Math.min((p.emitterLife ?? Infinity) + 10, Math.max(p.emitterLinger, 0));
      const finished = Math.floor(now) >= Math.max(stop, Math.floor(wait * 60 + 1e-5) + 1);
      const seed =
        id ^ Math.imul(record.startTick, 0x9e3779b9) ^ Math.imul(profileIndex + 21, 0x85ebca6b);
      const particles = [];
      for (let ordinal = 1; ordinal <= count; ordinal++) {
        const born = p.single ? 1 : luxEmissionBirthTick(p.rate, ordinal),
          age = (now - born) / 60;
        const chance = luxHoopChance(seed, ordinal),
          roll = luxHoopChance(seed ^ 0x27d4eb2d, ordinal);
        const sample = (v: Parameters<typeof luxBeamBirthOffset>[0]) =>
          luxBeamBirthOffset(v, chance);
        const naturalLife = sample(p.life)[0],
          life = finished ? Math.min(naturalLife, p.linger) : naturalLife;
        if (age < 0 || age >= life) continue;
        const phase = age / life,
          velocity = sample(p.velocity),
          spawn = sample(p.spawnOffset),
          origin = sample(p.position),
          size = sample(p.size),
          rotation = sample(p.rotation),
          angular = sample(p.angularVelocity);
        const scale = size.map((v, axis) => v * sampleParticleCurve(p.scale, phase, axis));
        if (p.uniform) scale.fill(scale[0]);
        const scroll = sample(p.scroll),
          multScroll = sample(p.multScroll);
        const frame =
          (p.atlas.start + (p.atlas.random ? Math.floor(roll * p.atlas.frames) : 0)) %
          (p.atlas.grid[0] * p.atlas.grid[1]);
        particles.push({
          castTick: record.startTick,
          profileIndex,
          ordinal,
          age,
          life,
          naturalLife,
          finished,
          offset: origin.map((v, axis) => v + spawn[axis] + velocity[axis] * age),
          scale,
          rotation: rotation.map((v, axis) => v + angular[axis] * age),
          color: [0, 1, 2, 3].map((axis) => sampleParticleCurve(p.color, phase, axis)),
          scroll: scroll.map((v) => v * age),
          multiplier: multScroll.map((v) => v * age),
          frame,
          lookup: particleColorLookup(p, phase, roll, velocity),
        });
      }
      return particles;
    })
  );
}
