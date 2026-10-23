import profiles from '../content/lux-e-particles.json';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';
import { accumulateParticleCurve, sampleParticleCurve } from './particle-curves';

export type LuxERole = 'flight' | 'ally' | 'enemy' | 'burst';
/** Static source bursts begin on their phase's first update. Stateless seeks never
 * consume simulation randomness or restart a particle after save/fog recovery. */
export function luxEParticles(role: LuxERole, seed: number, seconds: number) {
  const age = seconds;
  if (!Number.isFinite(age) || age < 0) return [];
  return profiles.flatMap((p, profileIndex) => {
    if (p.role !== role || age >= p.life) return [];
    const phase = age / p.life;
    return Array.from({ length: p.count }, (_, ordinal) => {
      const chance = (channel: number) =>
        luxHoopChance(
          seed ^ Math.imul(profileIndex + 1, 0x85ebca6b) ^ Math.imul(channel, 0x27d4eb2d),
          ordinal + 1
        );
      const size = luxBeamBirthOffset(p.size, chance(1));
      const scale = size.map((v, axis) => v * sampleParticleCurve(p.scale, phase, axis));
      if (p.uniform) scale.fill(scale[0]);
      const rotation = luxBeamBirthOffset(p.rotation, chance(2));
      const angular = luxBeamBirthOffset(p.angular, chance(3));
      const birthColor = luxBeamBirthOffset(p.birthColor, chance(4));
      const multOffset = luxBeamBirthOffset(p.multOffset, chance(5));
      return {
        profileIndex,
        ordinal,
        age,
        phase,
        scale,
        rotation: rotation.map((v, axis) => v + angular[axis] * age),
        color: birthColor.map((v, axis) => v * sampleParticleCurve(p.color, phase, axis)),
        uvOffset: luxBeamBirthOffset(p.uvOffset, chance(6)),
        multOffset: multOffset.map(
          (v, axis) => v + accumulateParticleCurve(p.multScroll, age, p.life, axis)
        ),
        multScale: [0, 1].map((axis) => sampleParticleCurve(p.multScale, phase, axis)),
        lookup: [phase, chance(7)],
        erosion: p.erosion ? sampleParticleCurve(p.erosion.drive, phase, 0) : 0,
      };
    });
  });
}
