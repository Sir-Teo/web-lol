import { LUX_GROUND_CHARGE } from '../content/lux-ground-charge';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';
import { sampleParticleCurve, accumulateParticleCurve } from './particle-curves';

/** Source-space ground charge particles. Cast seed is caster ID XOR original
 * cast tick hash; emitter identity is mixed here so source streams stay stable.
 * The renderer owns terrain projection, visibility and display-list membership. */
export function luxGroundChargeParticles(castSeed: number, age: number) {
  if (!Number.isFinite(age) || age < 0) return [];
  return LUX_GROUND_CHARGE.flatMap((profile) => {
    if (age >= profile.life) return [];
    const phase = age / profile.life,
      geometry = profile.geometry;
    const scale = geometry.birthSize.map(
      (v, axis) =>
        v *
        (geometry.scale.dynamics
          ? sampleParticleCurve(geometry.scale.dynamics, phase, axis)
          : geometry.scale.constantValue![axis])
    );
    const halfSize = geometry.uniformScale ? [scale[0], scale[0], scale[0]] : scale;
    const color = profile.birthColor.map(
      (v, axis) =>
        v *
        (profile.color.dynamics
          ? sampleParticleCurve(profile.color.dynamics, phase, axis)
          : profile.color.constantValue![axis])
    );
    const scroll = [0, 1].map(
      (axis) =>
        profile.multScroll[axis] * age +
        (profile.multScrollCurve.dynamics
          ? accumulateParticleCurve(profile.multScrollCurve.dynamics, age, profile.life, axis)
          : 0)
    );
    const offset = geometry.offset.map((v, axis) => v + geometry.velocity[axis] * age);
    const seed = castSeed ^ Math.imul(profile.emitterIndex, 0x85ebca6b);
    return Array.from({ length: profile.count }, (_, index) => {
      const chance = luxHoopChance(seed, index + 1);
      const birth = luxBeamBirthOffset(profile.multBirth, chance);
      return {
        name: profile.name,
        emitterIndex: profile.emitterIndex,
        ordinal: index + 1,
        chance,
        life: profile.life,
        offset,
        halfSize,
        rotation: geometry.rotation,
        color,
        multOffset: birth.map((v, axis) => v + scroll[axis]),
      };
    });
  });
}
