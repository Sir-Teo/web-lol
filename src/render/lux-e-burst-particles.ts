import { Euler, Vector3 } from 'three';
import profiles from '../content/lux-e-burst.json';
import { luxEmissionBirthTick, luxEmissionCount } from '../content/lux-emission';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';
import { sampleParticleCurve } from './particle-curves';
import { particleColorLookup } from './particle-color-lookup';

/** Closed form of the existing local 60 Hz acceleration/linear-drag step.
 * Fractional seeks interpolate the next displacement; no native integrator claim. */
export function luxEBurstTravel(
  velocity: readonly number[],
  acceleration: readonly number[],
  drag: readonly number[],
  age: number
) {
  const whole = Math.floor(age * 60),
    fraction = age * 60 - whole;
  const travel: number[] = [];
  const position = velocity.map((v, axis) => {
    const q = Math.max(0, 1 - drag[axis] / 60),
      a = acceleration[axis] / 60;
    if (q === 1) {
      const at = v + whole * a,
        next = at + a;
      travel.push(fraction > 0 ? next : at);
      return (whole * v + (a * whole * (whole + 1)) / 2 + fraction * next) / 60;
    }
    const power = q ** whole,
      geometric = (q * (1 - power)) / (1 - q),
      terminal = (q * a) / (1 - q);
    const at = v * power + terminal * (1 - power),
      next = q * (at + a);
    travel.push(fraction > 0 ? next : at);
    return (v * geometric + terminal * (whole - geometric) + fraction * next) / 60;
  });
  return { position, travel };
}

/** Birth/appearance reconstruction at the fixed detonation point. Shared indexed
 * birth chance follows the other local Lux adapters; cylinder flag1 is retained
 * but not interpreted. Its point distribution uses the existing uniform-disk policy. */
export function luxEBurstParticles(seed: number, seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return [];
  return profiles.flatMap((p, profileIndex) => {
    const count = p.single
      ? Math.max(1, Math.trunc(p.rate))
      : luxEmissionCount(p.rate, seconds * 60, p.emitterLife);
    const particles = [];
    for (let ordinal = 1; ordinal <= count; ordinal++) {
      const emitterSeed = seed ^ Math.imul(p.index + 1, 0x85ebca6b),
        chance = luxHoopChance(emitterSeed, ordinal);
      const sample = (v: Parameters<typeof luxBeamBirthOffset>[0]) => luxBeamBirthOffset(v, chance);
      const born = p.single ? 0 : luxEmissionBirthTick(p.rate, ordinal) / 60,
        age = seconds - born,
        life = sample(p.life)[0];
      if (age < 0 || age >= life) continue;
      const phase = age / life,
        velocity = new Vector3(...sample(p.velocity)),
        offset = new Vector3(...sample(p.offset));
      if (p.cylinderRadius) {
        const radius =
          p.cylinderRadius * Math.sqrt(luxHoopChance(emitterSeed ^ 0x51ed270b, ordinal));
        const angle = 2 * Math.PI * luxHoopChance(emitterSeed ^ 0x27d4eb2d, ordinal);
        offset.x += radius * Math.cos(angle);
        offset.z += radius * Math.sin(angle);
      }
      for (let i = 0; i < p.shapeAngles.length; i++) {
        const axis = new Vector3(...p.shapeAxes[i]).normalize(),
          angle = (sample(p.shapeAngles[i])[0] * Math.PI) / 180;
        velocity.applyAxisAngle(axis, angle);
        offset.applyAxisAngle(axis, angle);
      }
      const motion = luxEBurstTravel(velocity.toArray(), p.acceleration, sample(p.drag), age);
      const orbit = sample(p.orbit).map((v) => v * age),
        rotation = new Euler(orbit[0], orbit[1], orbit[2], 'YXZ');
      const position = offset
        .add(new Vector3(...sample(p.position)))
        .add(new Vector3(...motion.position))
        .applyEuler(rotation);
      const travel = new Vector3(...motion.travel).applyEuler(rotation).toArray();
      const scale = sample(p.size).map((v, axis) => v * sampleParticleCurve(p.scale, phase, axis));
      if (p.uniform) scale.fill(scale[0]);
      const birthColor = sample(p.birthColor);
      const color = birthColor.map((v, axis) => v * sampleParticleCurve(p.color, phase, axis));
      const frame = p.atlas.random
        ? Math.floor(luxHoopChance(emitterSeed ^ 0x7f4a7c15, ordinal) * p.atlas.frames)
        : 0;
      particles.push({
        profileIndex,
        ordinal,
        birthSeconds: born,
        age,
        life,
        chance,
        position: position.toArray(),
        travel,
        scale,
        color,
        frame,
        stretch: p.direction
          ? Math.max(p.directionMin, Math.hypot(...travel) * p.directionScale)
          : 1,
        lookup: particleColorLookup(p, phase, chance, travel),
      });
    }
    return particles;
  });
}
