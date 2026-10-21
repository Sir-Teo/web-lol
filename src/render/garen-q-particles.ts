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
