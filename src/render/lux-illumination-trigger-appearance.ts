import { particleColorLookup } from './particle-color-lookup';
import { LUX_ILLUMINATION_TRIGGER_VFX } from '../content/lux-illumination-trigger-vfx';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import type { luxIlluminationTriggerBirths } from './lux-illumination-trigger-births';
import { sampleParticleCurve } from './particle-curves';

type TriggerParticle = ReturnType<typeof luxIlluminationTriggerBirths>[number];

/** Lifetime appearance, independent of motion and target attachment. Source RGBA
 * and palette remapping are still shader operations; returned tint is unpremultiplied.
 * Directional stretching requires actual particle travel and is not applied here. */
export function luxIlluminationTriggerAppearance(particle: TriggerParticle) {
  const profile = LUX_ILLUMINATION_TRIGGER_VFX[particle.profileIndex];
  if (!profile) throw new RangeError('Unknown Illumination trigger emitter');
  if (!Number.isFinite(particle.age) || particle.age < 0 || particle.age >= particle.life)
    return null;
  const phase = particle.age / particle.life;
  const size = particle.size.map(
    (value, axis) => value * sampleParticleCurve(profile.scale, phase, axis)
  );
  if (profile.uniform) size.fill(size[0]);
  const color = particle.color.map(
    (value, axis) => value * sampleParticleCurve(profile.color, phase, axis)
  );
  // This pinned set uses only constant/lifetime lookup; velocity-driven lookup
  // must receive final particle travel from the motion/attachment stage.
  if (profile.lookupTypes.some((type) => type !== 0 && type !== 1))
    throw new RangeError('Unsupported Illumination trigger lookup selector');
  const lookup = particleColorLookup(profile, phase, particle.chance);
  const palette = profile.palette
    ? {
        texture: profile.palette.texture,
        row: (luxBeamBirthOffset(profile.palette.selector, 0)[0] + 0.5) / profile.palette.count,
        mix: luxBeamBirthOffset(profile.palette.mix, 0),
      }
    : null;
  // All five source emitters have zero frame rate and no random start. The outer
  // ring consequently stays on frame 4; numFrames=6 does not imply life animation.
  if (profile.atlas.rate !== 0) throw new RangeError('Animated trigger atlas requires playback');
  return {
    phase,
    size,
    color,
    rotation: [...particle.rotation],
    lookup,
    palette,
    atlas: {
      columns: profile.atlas.grid[0],
      rows: profile.atlas.grid[1],
      frame: profile.atlas.start,
    },
  };
}
