import { Vector3 } from 'three';
import profiles from '../content/garen-r-particles.json';
import { GAREN_R_PARTICLE_START_TICKS } from '../content/garen-r-presentation';
import type { ChampionState } from '../simulation/types';
import { luxEmissionBirthTick, luxEmissionCount } from '../content/lux-emission';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';
import { sampleParticleCurve } from './particle-curves';
import { particleColorLookup } from './particle-color-lookup';

/** Local analytic motion with constant acceleration and exponential birth drag.
 * Values remain source units. This is not proof of native integrator semantics. */
export function garenJusticeTravel(
  velocity: number[],
  acceleration: number[],
  drag: number[],
  age: number
) {
  const travel: number[] = [];
  const position = velocity.map((v, axis) => {
    const a = acceleration[axis],
      d = Math.max(0, drag[axis]);
    if (d === 0) {
      travel.push(v + a * age);
      return v * age + 0.5 * a * age * age;
    }
    const decay = Math.exp(-d * age),
      factor = -Math.expm1(-d * age) / d;
    travel.push(v * decay + a * factor);
    return v * factor + (a / d) * (age - factor);
  });
  return { position, travel };
}

/** Pure reconstruction: arbitrary rendering order/restore does not change births
 * and no simulation RNG is consumed. Source singles emit rate-sized bursts. */
export function garenJusticeParticles(
  id: number,
  effect: NonNullable<ChampionState['garenRVisual']>,
  tick: number
) {
  if (!Number.isFinite(tick) || tick < effect.startTick) return [];
  return profiles.flatMap((p, profileIndex) => {
    if (
      p.deferred ||
      ((p.role === 'impact' || p.role === 'kill') && effect.releaseTick === null) ||
      (p.role === 'kill' && !effect.killed) ||
      (p.role === 'sword' && effect.stopTick !== null)
    )
      return [];
    const start =
      p.role === 'impact' || p.role === 'kill'
        ? effect.releaseTick!
        : effect.startTick + GAREN_R_PARTICLE_START_TICKS;
    // Remove only float32 representation noise around exact 60 Hz boundaries.
    const delay = Math.ceil(p.delay * 60 - 1e-5),
      now = tick - start - delay;
    const stop = effect.stopTick === null ? Infinity : effect.stopTick - start - delay;
    const count = p.single
      ? now >= 1 && stop > 1
        ? Math.max(1, Math.trunc(p.rate))
        : 0
      : luxEmissionCount(p.rate, now, p.emitterLife, stop);
    const seed =
      id ^ Math.imul(effect.startTick, 0x9e3779b9) ^ Math.imul(profileIndex + 1, 0x85ebca6b);
    const particles = [];
    for (let ordinal = 1; ordinal <= count; ordinal++) {
      const born = p.single ? 1 : luxEmissionBirthTick(p.rate, ordinal);
      const age = (now - born) / 60;
      const chance = (channel: number) =>
        luxHoopChance(seed ^ Math.imul(channel, 0x27d4eb2d), ordinal);
      const sample = (v: Parameters<typeof luxBeamBirthOffset>[0], channel: number) =>
        luxBeamBirthOffset(v, chance(channel));
      const life = sample(p.life, 1)[0];
      if (age < 0 || age >= life) continue;
      const phase = age / life,
        velocity = new Vector3(...sample(p.velocity, 2));
      const spawn = new Vector3(...sample(p.spawnOffset, 3));
      p.spawnAngles.forEach((v, axis) => {
        const direction = new Vector3(...p.spawnAxes[axis]).normalize();
        const angle = (sample(v, 10 + axis)[0] * Math.PI) / 180;
        velocity.applyAxisAngle(direction, angle);
        spawn.applyAxisAngle(direction, angle);
      });
      const motion = garenJusticeTravel(
        velocity.toArray(),
        sample(p.acceleration, 4),
        sample(p.drag, 5),
        age
      );
      const origin = sample(p.position, 6),
        size = sample(p.size, 7),
        rotation = sample(p.rotation, 8),
        angular = sample(p.angularVelocity, 9);
      const scale = size.map((v, axis) => v * sampleParticleCurve(p.scale, phase, axis));
      if (p.uniform) scale.fill(scale[0]);
      const scroll = sample(p.scroll, 13),
        offset = sample(p.uvOffset, 14),
        multiplier = sample(p.multScroll, 15);
      const frame =
        (p.atlas.start + (p.atlas.random ? Math.floor(chance(16) * p.atlas.frames) : 0)) %
        (p.atlas.grid[0] * p.atlas.grid[1]);
      particles.push({
        profileIndex,
        ordinal,
        age,
        life,
        phase,
        offset: origin.map((v, axis) => v + spawn.getComponent(axis) + motion.position[axis]),
        travel: motion.travel,
        scale,
        rotation: rotation.map((v, axis) => v + angular[axis] * age),
        color: [0, 1, 2, 3].map((axis) => sampleParticleCurve(p.color, phase, axis)),
        scroll: scroll.map((v, axis) => v * age + offset[axis]),
        multiplier: multiplier.map((v) => v * age),
        lookup: particleColorLookup(p, phase, chance(17), motion.travel),
        frame,
      });
    }
    return particles;
  });
}
