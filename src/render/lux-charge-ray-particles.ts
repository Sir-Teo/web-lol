import profile from '../content/lux-charge-rays.json';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';

import { sampleParticleCurve as sample, accumulateParticleCurve } from './particle-curves';

export function luxChargeRayBirth(chance: number) {
  return {
    rotation: luxBeamBirthOffset(profile.birthRotation, chance)[0],
    halfSize: luxBeamBirthOffset(profile.birthSize, chance),
    multOffset: luxBeamBirthOffset(profile.multBirth, chance),
  };
}

/** Ten camera quads born together. Source units/degrees; the view adapter owns
 * camera-facing geometry. Indexed randomness and the 60 Hz grid are reconstruction
 * policies, not a claim of native PRNG or frame-rate parity. */
export function luxChargeRayParticles(seed: number, age: number) {
  if (!Number.isFinite(age) || age < 0 || age >= profile.life) return [];
  const phase = age / profile.life;
  const turn =
    profile.birthAngularVelocity[0] * age +
    60 * accumulateParticleCurve(profile.rotationRate, age, profile.life, 0);
  const scroll = [0, 1].map((axis) =>
    accumulateParticleCurve(profile.multScrollRate, age, profile.life, axis)
  );
  return Array.from({ length: profile.count }, (_, index) => {
    const chance = luxHoopChance(seed, index + 1),
      birth = luxChargeRayBirth(chance);
    return {
      ordinal: index + 1,
      rotation: birth.rotation + turn,
      halfSize: birth.halfSize.map((size, axis) => size * sample(profile.scale, phase, axis)),
      color: profile.birthColor.map((color, axis) => color * sample(profile.color, phase, axis)),
      multOffset: birth.multOffset.map((offset, axis) => offset + scroll[axis]),
    };
  });
}
