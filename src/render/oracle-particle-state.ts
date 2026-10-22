import { Euler, Vector3 } from 'three';
import profiles from '../content/oracle-particles.json';
import { sampleParticleCurve } from './particle-curves';
import { luxHoopChance } from './lux-hoop-particles';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxEmissionBirthTick, luxEmissionCount } from '../content/lux-emission';
import { particleColorLookup } from './particle-color-lookup';
import { particleTravel } from './particle-motion';
export { oracleChildTick } from '../content/oracle-presentation';
export interface OracleValue {
  readonly constant: readonly number[];
  readonly times: readonly number[];
  readonly values: readonly (readonly number[])[];
  readonly probabilities: readonly {
    readonly times: readonly number[];
    readonly values: readonly number[];
    readonly single: number;
  }[];
}
export interface OracleParticleWindow {
  role: 'buff' | 'death' | 'alert';
  startTick: number;
  stopTick: number | null;
}
/** Temporal values and probability multipliers remain independent. Birth values
 * use emitter age; live values use particle age. These time domains are a named
 * reconstruction policy while native dispatch is unavailable.
 */
export function oracleValue(value: OracleValue, phase: number, chance: number): number[] {
  const base = value.times.length
    ? value.constant.map((_, axis) => sampleParticleCurve(value, phase, axis))
    : [...value.constant];
  return luxBeamBirthOffset({ value: base, probabilities: value.probabilities }, chance);
}
/** First-update emission, stable indexed random channels and source lifetimes.
 * Stops cap particles at stop+linger without rescaling their authored curves.
 * Orbital values rotate displacement in radians locally; native units remain open.
 */
export function oracleParticles(ownerId: number, window: OracleParticleWindow, tick: number) {
  if (!Number.isFinite(tick) || tick < window.startTick) return [];
  return profiles.flatMap((p, profileIndex) => {
    if (p.role !== window.role) return [];
    const delay = Math.ceil(p.delay * 60 - 1e-5),
      elapsed = tick - window.startTick - delay;
    const stop = window.stopTick === null ? Infinity : window.stopTick - window.startTick - delay;
    const count = p.single
      ? elapsed >= 1 && stop > 1
        ? Math.max(1, Math.trunc(p.rate))
        : 0
      : luxEmissionCount(p.rate, elapsed, p.emitterLife ?? Infinity, stop);
    const seed =
      ownerId ^ Math.imul(window.startTick, 0x9e3779b9) ^ Math.imul(profileIndex + 1, 0x85ebca6b);
    const particles = [];
    for (let ordinal = 1; ordinal <= count; ordinal++) {
      const born = p.single ? 1 : luxEmissionBirthTick(p.rate, ordinal),
        age = (elapsed - born) / 60;
      if (age < 0) continue;
      const chance = (channel: number) =>
        luxHoopChance(seed ^ Math.imul(channel + 1, 0x27d4eb2d), ordinal);
      const birthPhase = p.emitterLife ? born / 60 / p.emitterLife : 0;
      const birth = (v: OracleValue, channel: number) =>
        oracleValue(v, birthPhase, chance(channel));
      const life = birth(p.life, 0)[0];
      if (
        life <= 0 ||
        age >= life ||
        (window.stopTick !== null && tick >= window.stopTick + p.linger * 60)
      )
        continue;
      const phase = age / life,
        velocity = new Vector3().fromArray(birth(p.velocity, 1)),
        spawn = new Vector3().fromArray(birth(p.offset, 2));
      p.spawnAngles.forEach((angle, axis) => {
        const direction = new Vector3().fromArray(p.spawnAxes[axis]).normalize();
        const radians = (birth(angle, 20 + axis)[0] * Math.PI) / 180;
        velocity.applyAxisAngle(direction, radians);
        spawn.applyAxisAngle(direction, radians);
      });
      const motion = particleTravel(
        velocity.toArray(),
        birth(p.acceleration, 3),
        birth(p.drag, 4),
        age
      );
      const offset = new Vector3().fromArray(motion.position).add(spawn);
      const orbital = birth(p.orbital, 5);
      offset.applyEuler(new Euler(orbital[0] * age, orbital[1] * age, orbital[2] * age, 'YXZ'));
      const origin = birth(p.position, 6);
      offset.add(new Vector3().fromArray(origin));
      const size = birth(p.size, 7),
        scale = size.map((v, i) => v * oracleValue(p.scale, phase, chance(8))[i]);
      if (p.uniform) scale.fill(scale[0]);
      const rotation = birth(p.rotation, 9),
        angular = birth(p.angularVelocity, 10);
      const birthColor = birth(p.birthColor, 11),
        color = oracleValue(p.color, phase, chance(12)).map((v, i) => v * birthColor[i]);
      const columns = Math.max(1, Math.trunc(p.atlas.grid[0])),
        rows = Math.max(1, Math.trunc(p.atlas.grid[1]));
      const frame =
        (p.atlas.start +
          (p.atlas.random ? Math.floor(chance(13) * p.atlas.frames) : 0) +
          Math.floor(p.atlas.fps * age)) %
        (columns * rows);
      const scroll = birth(p.scroll, 14),
        uv = birth(p.uvOffset, 15);
      particles.push({
        profileIndex,
        ordinal,
        startTick: window.startTick,
        bornTick: window.startTick + delay + born,
        age,
        life,
        phase,
        offset: offset.toArray(),
        travel: motion.travel,
        scale,
        rotation: rotation.map((v, i) => v + angular[i] * age),
        color,
        bind: birth(p.bind, 16)[0],
        scroll: scroll.map((v, i) => v * age + uv[i]),
        frame,
        lookup: particleColorLookup(p, phase, chance(17), motion.travel),
        uvScale: p.atlas.grid.map((v) => 1 / v),
        uvOffset: [
          (frame % columns) / p.atlas.grid[0],
          Math.floor(frame / columns) / p.atlas.grid[1],
        ],
      });
    }
    return particles;
  });
}
