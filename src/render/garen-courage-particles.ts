import { Vector3 } from 'three';
import profiles from '../content/garen-w-particles.json';
import { GAREN_W } from '../content/garen-w';
import type { ChampionState } from '../simulation/types';
import { luxEmissionBirthTick, luxEmissionCount } from '../content/lux-emission';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';
import { sampleParticleCurve } from './particle-curves';
import { particleColorLookup } from './particle-color-lookup';

/** Pure source reconstruction using the existing local first-birth/rate-budget
 * convention. Current caster translation/facing is supplied by the renderer.
 * The shared stop interpretation caps total particle age by authored linger;
 * native linger-type distinctions and dispatch still require comparison. */
export function garenCourageParticles(
  id: number,
  effect: NonNullable<ChampionState['garenWVisual']>,
  tick: number
) {
  return sampleCourageParticles(id, effect, tick, false);
}

/** Damage reactions have independent clocks and survive subsequent W casts,
 * defense expiry and death. Stop does not stretch or truncate their source life. */
export function garenCourageDeflectParticles(
  id: number,
  reactions: ChampionState['garenWDeflects'],
  tick: number
) {
  return reactions.flatMap((reaction) =>
    sampleCourageParticles(
      id,
      { startTick: reaction.tick, stopTick: null, endReason: null },
      tick,
      true
    )
  );
}

function sampleCourageParticles(
  id: number,
  effect: NonNullable<ChampionState['garenWVisual']>,
  tick: number,
  deflect: boolean
) {
  if (!Number.isFinite(tick) || tick < effect.startTick) return [];
  return profiles.flatMap((p, profileIndex) => {
    if ((p.role === 'deflect') !== deflect) return [];
    const delay = Math.ceil(p.delay * 60 - 1e-5),
      now = tick - effect.startTick - delay;
    const stop = effect.stopTick === null ? Infinity : effect.stopTick - effect.startTick - delay;
    const stopped = effect.stopTick !== null && tick >= effect.stopTick;
    const count = p.single
      ? now >= 1 && stop > 1
        ? Math.max(1, Math.trunc(p.rate))
        : 0
      : luxEmissionCount(p.rate, now, p.emitterLife ?? GAREN_W.damageReductionSeconds, stop);
    const seed =
      id ^ Math.imul(effect.startTick, 0x9e3779b9) ^ Math.imul(profileIndex + 1, 0x85ebca6b);
    const particles = [];
    for (let ordinal = 1; ordinal <= count; ordinal++) {
      const born = p.single ? 1 : luxEmissionBirthTick(p.rate, ordinal),
        age = (now - born) / 60;
      const chance = (channel: number) =>
        luxHoopChance(seed ^ Math.imul(channel, 0x27d4eb2d), ordinal);
      const sample = (value: Parameters<typeof luxBeamBirthOffset>[0], channel: number) =>
        luxBeamBirthOffset(value, chance(channel));
      const life = sample(p.life, 1)[0];
      if (age < 0 || age >= (stopped ? Math.min(life, p.linger) : life)) continue;
      const phase = age / life,
        velocity = new Vector3(...sample(p.velocity, 2)),
        spawn = new Vector3(...sample(p.spawnOffset, 3));
      p.spawnAngles.forEach((value, axis) => {
        const direction = new Vector3(...p.spawnAxes[axis]).normalize(),
          angle = (sample(value, 10 + axis)[0] * Math.PI) / 180;
        velocity.applyAxisAngle(direction, angle);
        spawn.applyAxisAngle(direction, angle);
      });
      const origin = sample(p.position, 6),
        size = sample(p.size, 7),
        rotation = sample(p.rotation, 8),
        angular = sample(p.angularVelocity, 9);
      const scale = size.map((v, axis) => v * sampleParticleCurve(p.scale, phase, axis));
      if (p.uniform) scale.fill(scale[0]);
      const scroll = sample(p.scroll, 13),
        uvOffset = sample(p.uvOffset, 14);
      particles.push({
        startTick: effect.startTick,
        profileIndex,
        ordinal,
        age,
        life,
        phase,
        offset: origin.map(
          (v, axis) => v + spawn.getComponent(axis) + velocity.getComponent(axis) * age
        ),
        scale,
        rotation: rotation.map((v, axis) => v + angular[axis] * age),
        color: [0, 1, 2, 3].map((axis) => sampleParticleCurve(p.color, phase, axis)),
        scroll: scroll.map((v, axis) => v * age + uvOffset[axis]),
        lookup: particleColorLookup(p, phase, chance(17), velocity.toArray()),
      });
    }
    return particles;
  });
}
