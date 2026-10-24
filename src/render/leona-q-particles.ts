import { Quaternion, Vector3 } from 'three';
import profiles from '../content/leona-q-particles.json';
import { luxEmissionBirthTick, luxEmissionCount } from '../content/lux-emission';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';
import { sampleParticleCurve } from './particle-curves';
import { particleColorLookup } from './particle-color-lookup';
import { particleTravel } from './particle-motion';

/** Seekable source-space particles. Timing, correlated cosmetic draws and stepped
 * drag follow the existing local adapter, not native CPU/PRNG certification. */
export function daybreakParticles(
  role: 'cast' | 'hit',
  seed: number,
  time: number,
  stopSeconds = Infinity,
  radius = 35,
  keywords: readonly string[] = []
) {
  if (
    !Number.isFinite(time) ||
    time < 0 ||
    Number.isNaN(stopSeconds) ||
    radius <= 0 ||
    !Number.isFinite(radius)
  )
    return [];
  return profiles.flatMap((p, profileIndex) => {
    if (p.role !== role || p.disabled || p.keywords.some((k) => keywords.includes(k))) return [];
    const delay = Math.max(1, Math.ceil(p.delay * 60 - 1e-5)),
      now = time * 60 - delay + 1,
      stop = stopSeconds * 60 - delay + 1;
    const count = p.single
      ? now >= 1 && stop > 1
        ? Math.max(1, Math.trunc(p.rate))
        : 0
      : luxEmissionCount(p.rate, now, p.emitterLife ?? Infinity, stop);
    const finished =
      Math.floor(time * 60) >=
      Math.max(
        stopSeconds * 60,
        Math.floor(Math.min((p.emitterLife ?? Infinity) + 10, p.emitterLinger) * 60 + 1e-5) + 1
      );
    const particles = [];
    for (let ordinal = 1; ordinal <= count; ordinal++) {
      const born = delay + (p.single ? 0 : luxEmissionBirthTick(p.rate, ordinal) - 1),
        age = time - born / 60;
      const chance = luxHoopChance(seed ^ Math.imul(profileIndex + 1, 0x85ebca6b), ordinal),
        roll = luxHoopChance(seed ^ Math.imul(profileIndex + 1, 0x85ebca6b) ^ 0x27d4eb2d, ordinal);
      const sample = (v: Parameters<typeof luxBeamBirthOffset>[0]) => luxBeamBirthOffset(v, chance);
      const naturalLife = sample(p.life)[0],
        life = finished ? Math.min(naturalLife, p.linger) : naturalLife;
      if (age < 0 || age >= life) continue;
      const phase = age / life,
        velocity = new Vector3(...sample(p.velocity)),
        spawn = new Vector3(...sample(p.spawn));
      const rotation = new Quaternion(),
        turn = new Quaternion();
      p.angles.forEach((a, i) => {
        rotation.setFromAxisAngle(
          new Vector3(...p.axes[i]).normalize(),
          (sample(a)[0] * Math.PI) / 180
        );
        turn.multiply(rotation);
      });
      velocity.applyQuaternion(turn);
      spawn.applyQuaternion(turn);
      const motion = particleTravel(velocity.toArray(), [0, 0, 0], sample(p.drag), age),
        acceleration = sample(p.acceleration),
        position = sample(p.position);
      const offset = position.map(
        (v, i) => v + spawn.getComponent(i) + motion.position[i] + acceleration[i] * age * life
      );
      const size = sample(p.size).map((v, i) => v * sampleParticleCurve(p.scale, phase, i));
      if (p.uniform) size.fill(size[0]);
      if (p.boundScale !== null) size.forEach((v, i) => (size[i] = v * radius * 2 * p.boundScale!));
      const spin = sample(p.spin),
        angles = sample(p.rotation).map((v, i) => v + spin[i] * age);
      const color = sample(p.birthColor).map((v, i) => v * sampleParticleCurve(p.color, phase, i));
      particles.push({
        profileIndex,
        ordinal,
        bornTick: born,
        age,
        life,
        naturalLife,
        phase,
        offset,
        size,
        rotation: angles,
        color,
        lookup: particleColorLookup(p, phase, roll, motion.travel),
        bind: p.bind,
      });
    }
    return particles;
  });
}
