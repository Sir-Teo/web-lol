import { Euler, Vector3 } from 'three';
import { LUX_ILLUMINATION_TRIGGER_VFX } from '../content/lux-illumination-trigger-vfx';
import type { luxIlluminationTriggerBirths } from './lux-illumination-trigger-births';
import { sampleParticleCurve } from './particle-curves';

type TriggerParticle = ReturnType<typeof luxIlluminationTriggerBirths>[number];

/** Static, identity-frame source-space motion. This does not incorporate a moving
 * attachment or reflect/convert coordinates into the game scene. Stepped drag uses
 * the established local 60 Hz reconstruction, with interpolation between steps.
 * Orbit and worldAcceleration follow the pinned renderer's draw-time transforms. */
export function luxIlluminationTriggerStaticMotion(particle: TriggerParticle) {
  const profile = LUX_ILLUMINATION_TRIGGER_VFX[particle.profileIndex];
  if (!profile) throw new RangeError('Unknown Illumination trigger emitter');
  const age = particle.age;
  if (!Number.isFinite(age) || age < 0 || age >= particle.life) return null;
  const velocity = new Vector3(...particle.velocity);
  const offset = new Vector3(...particle.spawnOffset);
  for (let i = 0; i < particle.spawnAngles.length; i++) {
    const axis = new Vector3(...profile.spawnAxes[i]).normalize();
    const angle = (particle.spawnAngles[i] * Math.PI) / 180;
    velocity.applyAxisAngle(axis, angle);
    offset.applyAxisAngle(axis, angle);
  }
  offset.add(new Vector3(...particle.emitterPosition));
  const ticks = age * 60,
    whole = Math.floor(ticks),
    fraction = ticks - whole;
  const travel: number[] = [];
  const position = velocity.toArray().map((v, axis) => {
    const decay = Math.max(0, 1 - particle.drag[axis] / 60);
    const power = decay ** whole;
    const displacement =
      decay === 1
        ? v * age
        : (v / 60) * ((decay * (1 - power)) / (1 - decay) + fraction * power * decay);
    // Velocity of the interpolated segment, before orbit and draw-time offset.
    travel.push(v * power * decay);
    return offset.getComponent(axis) + displacement;
  });
  const orbitRadians = particle.orbitalVelocity.map((v) => v * age);
  const drawn = new Vector3(...position).applyEuler(
    new Euler(orbitRadians[0], orbitRadians[1], orbitRadians[2], 'YXZ')
  );
  const emitterPhase = Math.min(1, (particle.birthTime + age) / profile.emitterLife);
  for (let axis = 0; axis < 3; axis++) {
    const acceleration = sampleParticleCurve(profile.worldAcceleration, emitterPhase, axis);
    drawn.setComponent(axis, drawn.getComponent(axis) + acceleration * age * particle.life);
  }
  const speed = Math.hypot(...travel);
  const stretch =
    profile.directionOriented && speed > 0
      ? Math.max(profile.directionMin, speed * profile.directionScale)
      : 1;
  return { position: drawn.toArray(), travel, orbitRadians, stretch };
}
