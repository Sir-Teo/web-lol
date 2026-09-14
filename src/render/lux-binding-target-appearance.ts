import { LUX_BINDING_TARGET_APPEARANCE } from '../content/lux-binding-target-appearance';
import { LUX_BINDING_TARGET_LOOKUPS } from '../content/lux-binding-target-lookups';
import { sampleParticleCurve } from './particle-curves';
import { particleColorLookup } from './particle-color-lookup';
import type { luxBindingTargetBirths } from './lux-binding-target-births';

type TargetParticle = ReturnType<typeof luxBindingTargetBirths>[number];
/** Lifetime values in source units, before geometry orientation or shader sampling.
 * Tint remains unpremultiplied. Uniform size follows the evaluated X component. */
export function luxBindingTargetAppearance(particle: TargetParticle, travel?: readonly number[]) {
  const profile = LUX_BINDING_TARGET_APPEARANCE[particle.profileIndex];
  const lookup = LUX_BINDING_TARGET_LOOKUPS[particle.profileIndex];
  if (!profile || !lookup) throw new RangeError('Unknown Light Binding target emitter');
  if (!Number.isFinite(particle.age) || particle.age < 0 || particle.age >= particle.life)
    return null;
  if (lookup.lookupTypes.some((type: number) => type === 2) && !travel)
    throw new RangeError('Velocity lookup requires measured particle travel');
  const phase = particle.age / particle.life;
  const size = particle.size.map(
    (value, axis) => value * sampleParticleCurve(profile.scale, phase, axis)
  );
  if (profile.uniform) size.fill(size[0]);
  return {
    phase,
    size,
    color: particle.color.map(
      (value, axis) => value * sampleParticleCurve(profile.color, phase, axis)
    ),
    rotation: particle.rotation.map((value, axis) => value + particle.spin[axis] * particle.age),
    lookup: particleColorLookup(lookup, phase, particle.birthRandom, travel),
  };
}
