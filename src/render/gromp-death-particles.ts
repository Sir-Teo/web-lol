import source from '../content/gromp-death.json';
import { TICK_RATE } from '../content/rules';
import { isGrompLegacyBillboard } from './gromp-billboard-color';
import { isGrompLegacyPlane } from './gromp-plane-color';
import { Vector3 } from 'three';
import { prepareLegacyParticleColor, sampleLegacyParticleColor } from './legacy-particle-color';
import {
  sampleParticleCurve,
  accumulateParticleCurve,
  type ParticleCurve,
} from './particle-curves';
import { luxHoopChance } from './lux-hoop-particles';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { particleTravel as grompDeathTravel } from './particle-motion';
export { particleTravel as grompDeathTravel } from './particle-motion';

function compile(keys: { time: number; value: number[] }[]): ParticleCurve {
  return { times: keys.map((key) => key.time), values: keys.map((key) => key.value) };
}

// Source profiles are static. Share their curve views across every particle,
// corpse and seek instead of rebuilding two arrays for each sampled channel.
const curves = source.profiles.map((profile, profileIndex) => ({
  scale: compile(profile.scaleCurve),
  color: compile(profile.colorCurve),
  rawColor:
    profile.kind === 'ray' ||
    isGrompLegacyBillboard(profileIndex) ||
    isGrompLegacyPlane(profileIndex)
      ? prepareLegacyParticleColor(profile.color, profile.colorCurve)
      : null,
  rotation: compile(profile.rotationCurve),
}));

function sample(curve: ParticleCurve, phase: number, axis: number) {
  return curve.times.length ? sampleParticleCurve(curve, phase, axis) : 1;
}

/** All single emitters burst on death+1. Indexed chance/roll reproduce every
 * source multiplier and atlas choice without consuming the simulation RNG. */
export function grompDeathParticles(deathTick: number, tick: number, id = 0) {
  if (!Number.isFinite(deathTick) || !Number.isFinite(tick)) return [];
  const age = (tick - deathTick - 1) / TICK_RATE;
  if (age < 0) return [];
  return source.profiles.flatMap((p, profileIndex) => {
    const curve = curves[profileIndex],
      seed = id ^ Math.imul(deathTick, 0x9e3779b9) ^ Math.imul(p.sourceIndex + 1, 0x85ebca6b);
    return Array.from({ length: p.count }, (_, index) => {
      const ordinal = index + 1,
        chance = luxHoopChance(seed, ordinal),
        roll = luxHoopChance(seed ^ 0x27d4eb2d, ordinal);
      const birth = (
        value: number[],
        probabilities: Parameters<typeof luxBeamBirthOffset>[0]['probabilities']
      ) => luxBeamBirthOffset({ value, probabilities }, chance);
      const life = birth([p.life], [p.probabilities.life])[0];
      if (age >= life) return [];
      const phase = age / life,
        velocity = new Vector3(...birth(p.velocity, p.probabilities.velocity)),
        origin = new Vector3(...birth(p.offset, p.probabilities.offset));
      for (const shape of p.shape) {
        const angle = (birth([shape.value], [shape.probability])[0] * Math.PI) / 180,
          axis = new Vector3(...shape.axis).normalize();
        velocity.applyAxisAngle(axis, angle);
        origin.applyAxisAngle(axis, angle);
      }
      const motion = grompDeathTravel(velocity.toArray(), p.acceleration, p.drag, age),
        scale = birth(p.size, p.probabilities.size).map(
          (v, axis) => v * sample(curve.scale, phase, axis)
        ),
        rotation = birth(p.rotation, p.probabilities.rotation);
      if (p.uniform) scale.fill(scale[0]);
      if (p.rotationCurve.length)
        for (let axis = 0; axis < 3; axis++)
          rotation[axis] +=
            p.rotationRate[axis] *
            TICK_RATE *
            accumulateParticleCurve(curve.rotation, age, life, axis);
      const frame =
        (p.atlas.start +
          (p.atlas.random ? Math.floor(roll * p.atlas.frames) : 0) +
          Math.floor(p.atlas.fps * age)) %
        (p.atlas.grid[0] * p.atlas.grid[1]);
      return [
        {
          profileIndex,
          ordinal,
          age,
          life,
          phase,
          scale,
          rotation,
          frame,
          color: curve.rawColor
            ? sampleLegacyParticleColor(curve.rawColor, phase)
            : p.color.map((v, axis) => v * sample(curve.color, phase, axis)),
          offset: origin.toArray().map((v, axis) => v + p.postOffset[axis] + motion.position[axis]),
          scroll: birth(p.uvOffset, p.probabilities.uvOffset).map(
            (v, axis) => v + p.scroll[axis] * age
          ),
        },
      ];
    }).flat();
  });
}
