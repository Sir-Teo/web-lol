import { LUX_ILLUMINATION_VFX } from '../content/lux-illumination-vfx';
import { luxEmissionBirthTick, luxEmissionCount } from '../content/lux-emission';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';
import { sampleParticleCurve } from './particle-curves';

/** Seekable source-space mark particles. Emission uses the existing 60 Hz Lux
 * reconstruction and indexed random stream, not a claim of native PRNG parity.
 * stopSeconds stops new births; existing particles retain their authored lives.
 * The gameplay adapter owns buff removal, refresh and attachment behavior.
 */
export function luxIlluminationParticles(
  seed: number,
  time: number,
  stopSeconds = Infinity,
  keywords: readonly string[] = []
) {
  if (!Number.isFinite(time) || time < 0 || Number.isNaN(stopSeconds)) return [];
  return LUX_ILLUMINATION_VFX.flatMap((profile) => {
    if (profile.excludedKeywords.some((keyword) => keywords.includes(keyword))) return [];
    const count = profile.single
      ? Number(time >= 1 / 60 && stopSeconds > 1 / 60)
      : luxEmissionCount(profile.rate, time * 60, profile.emitterLife, stopSeconds * 60);
    const emitterSeed = seed ^ Math.imul(profile.index, 0x85ebca6b);
    return Array.from({ length: count }, (_, index) => {
      const ordinal = index + 1;
      const birthTime = luxEmissionBirthTick(profile.rate, ordinal) / 60;
      const age = time - birthTime;
      const chance = luxHoopChance(emitterSeed, ordinal);
      const life = luxBeamBirthOffset(profile.life, chance)[0];
      if (age < 0 || age >= life) return null;
      const phase = age / life;
      const birthSize = luxBeamBirthOffset(profile.size, chance);
      const size = birthSize.map(
        (value, axis) => value * sampleParticleCurve(profile.scale, phase, axis)
      );
      if (profile.uniform) size.fill(size[0]);
      const birthRotation = luxBeamBirthOffset(profile.rotation, chance);
      const spin = luxBeamBirthOffset(profile.spin, chance);
      const rotation = birthRotation.map((value, axis) => value + spin[axis] * age);
      const birthColor = luxBeamBirthOffset(profile.birthColor, chance);
      const color = birthColor.map(
        (value, axis) => value * sampleParticleCurve(profile.color, phase, axis)
      );
      const multOffset = luxBeamBirthOffset(profile.multBirth, chance).map(
        (value, axis) => value + profile.multScroll[axis] * age
      );
      return {
        name: profile.name,
        profileIndex: profile.index,
        ordinal,
        birthTime,
        age,
        life,
        phase,
        primitive: profile.primitive,
        size,
        rotation,
        color,
        multOffset,
        lookup: [phase, 1] as const,
      };
    }).filter((particle) => particle !== null);
  });
}
