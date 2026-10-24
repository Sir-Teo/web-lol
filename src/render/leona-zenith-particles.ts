import { Quaternion, Vector3 } from 'three';
import data from '../content/leona-e-particles.json';
import { luxEmissionBirthTick, luxEmissionCount } from '../content/lux-emission';
import { luxHoopChance } from './lux-hoop-particles';
import { particleTravel } from './particle-motion';
import { particleColorLookup } from './particle-color-lookup';
import { eclipseValue, eclipsePeak, eclipseUv } from './leona-eclipse-values';

export type ZenithRole = 'weapon' | 'dash' | 'arrival' | 'contact' | 'sound';
export const ZENITH_PROFILES = data.profiles;

/** Seekable source-space births. All twenty enabled families participate; disabled
 * declarations remain in the generated table. Cosmetic hashes consume no World
 * RNG/IDs. First updates, random routing, sphere distribution, period gates and stop caps
 * are explicit local reconstruction policies, not native CPU certification. */
export function zenithParticles(
  role: ZenithRole,
  seed: number,
  time: number,
  stopSeconds = Infinity,
  radius = 35
) {
  if (
    !Number.isFinite(time) ||
    time < 0 ||
    Number.isNaN(stopSeconds) ||
    stopSeconds < 0 ||
    !Number.isFinite(radius) ||
    radius <= 0
  )
    return [];
  return data.profiles.flatMap((p, profileIndex) => {
    if (p.role !== role) return [];
    const delay = Math.max(1, Math.ceil(p.delay * 60 - 1e-5)),
      rate = p.rate.values[0][0],
      now = time * 60 - delay + 1,
      stop = stopSeconds * 60 - delay + 1;
    const activePeriod =
      p.period === null || p.activePeriod === null || p.delay % p.period < p.activePeriod;
    const count = !activePeriod
      ? 0
      : p.single
        ? now >= 1 && stop > 1
          ? Math.max(1, Math.trunc(rate))
          : 0
        : luxEmissionCount(rate, now, p.emitterLife ?? Infinity, stop);
    const settledAt = Math.max(
      Math.ceil(stopSeconds * 60),
      Math.floor(Math.min((p.emitterLife ?? Infinity) + 10, p.emitterLinger) * 60 + 1e-5) + 1
    );
    const settled = Math.floor(time * 60 + 1e-5) >= settledAt;
    const cap = Math.min(p.life.constant[0] + 10, Math.max(p.linger, 0));
    const peak = eclipsePeak(p.life);
    // Only births that could remain live are visited; long seeks do not scan an
    // unbounded emission history. Every enabled E life is finite and positive.
    const first = p.single ? 1 : Math.max(1, Math.floor((time - peak - delay / 60) * rate) - 2);
    const out = [];
    for (let ordinal = first; ordinal <= count; ordinal++) {
      const bornTick = delay + (p.single ? 0 : luxEmissionBirthTick(rate, ordinal) - 1),
        age = time - bornTick / 60;
      const phaseAtBirth =
        p.emitterLife && p.emitterLife > 0 ? Math.min(1, bornTick / 60 / p.emitterLife) : 0;
      const chance = luxHoopChance(seed ^ Math.imul(profileIndex + 1, 0x85ebca6b), ordinal),
        roll = luxHoopChance(seed ^ Math.imul(profileIndex + 1, 0x85ebca6b) ^ 0x27d4eb2d, ordinal),
        sample = (v: Parameters<typeof eclipseValue>[0]) => eclipseValue(v, phaseAtBirth, chance);
      const authoredLife = sample(p.life)[0],
        naturalLife = authoredLife;
      if (authoredLife <= 0) throw Error('Unsupported non-positive Zenith particle lifetime');
      const life = settled ? Math.min(naturalLife, cap) : naturalLife;
      if (age < -1e-8 || age >= life) continue;
      const phase = Number.isFinite(life) && life > 0 ? Math.max(0, Math.min(1, age / life)) : 0;
      const spawn = new Vector3(...sample(p.shape.offset)),
        turn = new Quaternion();
      if (p.shape.kind === 'box')
        for (let axis = 0; axis < 3; axis++)
          spawn.setComponent(
            axis,
            (2 * luxHoopChance(seed ^ Math.imul(profileIndex + 11 + axis, 0x9e3779b9), ordinal) -
              1) *
              p.shape.boxSize[axis]
          );
      p.shape.angles.forEach((angle, i) => {
        const axis = new Vector3(...p.shape.axes[i]);
        if (axis.lengthSq() > 0)
          turn.multiply(
            new Quaternion().setFromAxisAngle(axis.normalize(), (sample(angle)[0] * Math.PI) / 180)
          );
      });
      if (p.shape.kind === 'sphere') {
        // The pinned reader uses a naive radius and two full-angle turns; do not
        // replace it with a uniform-volume/surface distribution.
        spawn.set(luxHoopChance(seed ^ (profileIndex + 19), ordinal) * p.shape.sphereRadius, 0, 0);
        turn.multiply(
          new Quaternion().setFromAxisAngle(
            new Vector3(0, 1, 0),
            luxHoopChance(seed ^ (profileIndex + 23), ordinal) * 2 * Math.PI
          )
        );
        turn.multiply(
          new Quaternion().setFromAxisAngle(
            new Vector3(0, 0, 1),
            luxHoopChance(seed ^ (profileIndex + 29), ordinal) * 2 * Math.PI
          )
        );
      }
      spawn.applyQuaternion(turn);
      if (p.boundOffset !== null) spawn.multiplyScalar(radius * 2 * p.boundOffset);
      const velocity = new Vector3(...sample(p.velocity)).applyQuaternion(turn),
        motion = particleTravel(
          velocity.toArray(),
          sample(p.birthAcceleration),
          sample(p.drag),
          Math.max(0, age)
        ),
        emitterPhase = p.emitterLife && p.emitterLife > 0 ? Math.min(1, time / p.emitterLife) : 0,
        acceleration = eclipseValue(p.acceleration, emitterPhase),
        position = sample(p.position);
      const accelerationReach = Number.isFinite(life) ? phase * life * life : 0;
      const offset = position.map(
        (v, i) =>
          v + spawn.getComponent(i) + motion.position[i] + acceleration[i] * accelerationReach
      );
      // The pinned reconstruction adds this direction term alongside its
      // age01*lifetime^2 displacement. It is not a second force integration.
      const travel = motion.travel.map((v, i) => v + acceleration[i] * life);
      const size = sample(p.size).map((v, i) => v * eclipseValue(p.scale, phase)[i]);
      if (p.uniform) size.fill(size[0]);
      if (p.boundScale !== null)
        for (let i = 0; i < size.length; i++) size[i] *= radius * 2 * p.boundScale;
      const color = sample(p.birthColor).map((v, i) => v * eclipseValue(p.color, phase)[i]);
      const spin = sample(p.spin),
        rotation = sample(p.rotation).map((v, i) => v + spin[i] * Math.max(0, age));
      const uvLife = Number.isFinite(life) ? life : 1;
      out.push({
        profileIndex,
        ordinal,
        bornTick,
        age: Math.max(0, age),
        naturalLife,
        life,
        phase,
        offset,
        size,
        color,
        rotation,
        spawnTurn: turn.toArray(),
        travel,
        stretch: p.directionOriented
          ? Math.max(1, Math.hypot(...travel) * p.directionVelocityScale)
          : 1,
        bind: eclipseValue(p.bind, emitterPhase)[0],
        lookup: particleColorLookup(p, phase, roll, travel),
        uv: eclipseUv(p.uv, Math.max(0, age), uvLife, phaseAtBirth, phase, chance, roll),
        multUv: p.multiplier
          ? eclipseUv(p.multiplier.uv, Math.max(0, age), uvLife, phaseAtBirth, phase, chance, roll)
          : null,
        erosion: p.erosion ? eclipseValue(p.erosion.drive, phase)[0] : 0,
        palette: p.palette
          ? {
              mix: eclipseValue(p.palette.mix, phase),
              selector: eclipseValue(p.palette.selector, phase),
              count: p.palette.count,
            }
          : null,
        tiling: p.trail ? sample(p.trail.tiling) : null,
      });
    }
    return out;
  });
}
