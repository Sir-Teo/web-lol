import { Vector3 } from 'three';
import { LUX_BINDING_TARGET_BIRTHS } from '../content/lux-binding-target-births';
import type { luxBindingTargetBirths } from './lux-binding-target-births';

type TargetParticle = ReturnType<typeof luxBindingTargetBirths>[number];

/** Identity-frame source units. The pinned target has only constant birth velocity:
 * its exporter rejects acceleration, drag, orbit and extra shape translations.
 * This returns neither a moving attachment transform nor scene-unit conversion. */
export function luxBindingTargetStaticMotion(particle: TargetParticle) {
  const profile = LUX_BINDING_TARGET_BIRTHS[particle.profileIndex];
  if (!profile) throw new RangeError('Unknown Light Binding target emitter');
  const age = particle.age;
  if (!Number.isFinite(age) || age < 0 || age >= particle.life) return null;
  const position = new Vector3(...particle.spawnOffset);
  const velocity = new Vector3(...particle.velocity);
  // The current source uses at most one legacy turn. Shape rotation reaches both
  // vectors, while EmitterPosition is added afterwards (pinned emit.ts).
  for (let i = 0; i < particle.spawnAngles.length; i++) {
    const axis = new Vector3(...profile.spawnAxes[i]);
    if (axis.lengthSq() === 0) continue;
    axis.normalize();
    const angle = (particle.spawnAngles[i] * Math.PI) / 180;
    position.applyAxisAngle(axis, angle);
    velocity.applyAxisAngle(axis, angle);
  }
  position.add(new Vector3(...particle.emitterPosition));
  const displacement = velocity.clone().multiplyScalar(age);
  position.add(displacement);
  return {
    position: position.toArray(),
    velocity: velocity.toArray(),
    displacement: displacement.toArray(),
  };
}
