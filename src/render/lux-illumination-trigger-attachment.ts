import { Euler, Vector3 } from 'three';
import { LUX_ILLUMINATION_TRIGGER_VFX } from '../content/lux-illumination-trigger-vfx';
import type { luxIlluminationTriggerBirths } from './lux-illumination-trigger-births';
import { sampleParticleCurve } from './particle-curves';

type TriggerParticle = ReturnType<typeof luxIlluminationTriggerBirths>[number];

/** Translation corrections for the static motion sampler. point(seconds) returns
 * the system origin in the same identity-frame source units as static motion.
 * It must support endpoint sampling on the 60 Hz grid, including the next endpoint
 * for fractional-step interpolation. The gameplay adapter chooses the origin/bone.
 * No callback-owned vectors are mutated. */
export function luxIlluminationTriggerAttachment(
  particle: TriggerParticle,
  point: (seconds: number) => Vector3
) {
  const profile = LUX_ILLUMINATION_TRIGGER_VFX[particle.profileIndex];
  if (!profile) throw new RangeError('Unknown Illumination trigger emitter');
  const age = particle.age;
  if (!Number.isFinite(age) || age < 0 || age >= particle.life) return null;
  const birthTick = Math.round(particle.birthTime * 60);
  const elapsedTicks = age * 60,
    whole = Math.floor(elapsedTicks),
    fraction = elapsedTicks - whole;
  const anchor = point(birthTick / 60).clone();
  const weightAt = (tick: number) =>
    sampleParticleCurve(profile.bind, tick / 60 / profile.emitterLife, 0);
  for (let step = 1; step <= whole + Number(fraction > 0); step++) {
    const tick = birthTick + step;
    const delta = point(tick / 60)
      .clone()
      .sub(point((tick - 1) / 60));
    anchor.addScaledVector(delta, weightAt(tick) * (step > whole ? fraction : 1));
  }
  // Derivative of the same interpolation segment used by static drag motion.
  const nextTick = birthTick + whole + 1;
  const travel = point(nextTick / 60)
    .clone()
    .sub(point((nextTick - 1) / 60))
    .multiplyScalar(60 * weightAt(nextTick));
  const now = point(particle.birthTime + age);
  const orbit = particle.orbitalVelocity.map((v) => v * age);
  // Static motion already orbits its displacement about zero. Add this correction
  // to orbit the bound birth origin about the system's current moving origin.
  const position = anchor;
  if (orbit.some((v) => v !== 0))
    position
      .sub(now)
      .applyEuler(new Euler(orbit[0], orbit[1], orbit[2], 'YXZ'))
      .add(now);
  return { position, travel };
}
