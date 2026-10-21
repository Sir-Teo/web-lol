import profiles from '../content/garen-spin.json';
import { GAREN_E } from '../content/garen-e';
import type { ChampionState } from '../simulation/types';
import { luxEmissionBirthTick, luxEmissionCount } from '../content/lux-emission';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';
import { sampleParticleCurve } from './particle-curves';

type Birth = {
  value: number | number[];
  probabilities: { times: number[]; values: number[]; single: number }[] | null;
};
function birth(profile: Birth, chance: number) {
  return luxBeamBirthOffset(
    { ...profile, value: typeof profile.value === 'number' ? [profile.value] : profile.value },
    chance
  );
}

/** Source values, local 60 Hz reconstruction and indexed random streams. No
 * render-driven integration or simulation RNG consumption. Degenerate source
 * probability tables retain their endpoint semantics rather than becoming ranges.
 * The shared emitter adapter forces a first birth and caps total life on stop.
 */
export function garenSpinParticles(
  id: number,
  effect: NonNullable<ChampionState['garenEVisual']>,
  tick: number
) {
  if (!Number.isFinite(tick) || tick < effect.startTick) return [];
  return profiles.flatMap((p) => {
    const delay = Math.ceil(p.delay * 60),
      now = tick - effect.startTick - delay,
      stopped = effect.stopTick !== null && tick >= effect.stopTick,
      stop = effect.stopTick === null ? Infinity : effect.stopTick - effect.startTick - delay,
      count = luxEmissionCount(p.rate, now, GAREN_E.durationSeconds, stop),
      maxLife = p.life.value * Math.max(1, ...(p.life.probabilities?.[0]?.values ?? [])),
      seed = id ^ Math.imul(effect.startTick, 0x9e3779b9) ^ Math.imul(p.index + 1, 0x85ebca6b);
    const particles = [];
    for (
      let ordinal = Math.max(1, count - Math.ceil(p.rate * maxLife) - 1);
      ordinal <= count;
      ordinal++
    ) {
      const age = (now - luxEmissionBirthTick(p.rate, ordinal)) / 60;
      const chance = (channel: number) =>
        luxHoopChance(seed ^ Math.imul(channel, 0x27d4eb2d), ordinal);
      const life = birth(p.life, chance(1))[0];
      if (age < 0 || age >= (stopped ? Math.min(life, p.linger) : life)) continue;
      const phase = age / life,
        rotation = birth(p.rotation, chance(2)),
        velocity = birth(p.velocity, chance(3)),
        rotationalVelocity = birth(p.rotationalVelocity, chance(4)),
        scroll = birth(p.scroll, chance(5));
      particles.push({
        emitterIndex: p.index,
        ordinal,
        age,
        life,
        offset: p.offset.map((v, axis) => v + velocity[axis] * age),
        rotation: rotation.map((v, axis) => v + rotationalVelocity[axis] * age),
        scale: p.birthScale.map(
          (v, axis) =>
            v *
            (p.scale.dynamics
              ? sampleParticleCurve(p.scale.dynamics, phase, axis)
              : p.scale.constantValue![axis])
        ),
        color: [0, 1, 2, 3].map((axis) => sampleParticleCurve(p.color, phase, axis)),
        scroll: scroll.map((v) => v * age),
      });
    }
    return particles;
  });
}
