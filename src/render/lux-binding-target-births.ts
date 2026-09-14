import { LUX_BINDING_TARGET_BIRTHS } from '../content/lux-binding-target-births';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';
import { luxEmissionCount, luxEmissionBirthTick } from '../content/lux-emission';

/** Source birth parameters, before lifetime curves, spawn rotation and attachment. */
export function luxBindingTargetBirth(profileIndex: number, chance: number) {
  const profile = LUX_BINDING_TARGET_BIRTHS[profileIndex];
  if (!profile) throw new RangeError('Unknown Light Binding target emitter');
  const sample = (value: Parameters<typeof luxBeamBirthOffset>[0]) =>
    luxBeamBirthOffset(value, chance);
  return {
    life: sample(profile.life)[0],
    size: sample(profile.size),
    rotation: sample(profile.rotation),
    spin: sample(profile.spin),
    velocity: sample(profile.velocity),
    color: sample(profile.color),
    emitterPosition: sample(profile.emitterPosition),
    spawnOffset: sample(profile.spawnOffset),
    spawnAngles: profile.spawnAngles.map((angle) => sample(angle)[0]),
  };
}

/** Seekable 60 Hz birth history. Indexed cosmetic randomness follows the existing
 * local Lux reconstruction; native random streams/correlations remain unverified.
 * A stop prevents new births but does not truncate already-born particles. */
export function luxBindingTargetBirths(seed: number, time: number, stopSeconds = Infinity) {
  if (!Number.isFinite(time) || time < 0 || Number.isNaN(stopSeconds)) return [];
  return LUX_BINDING_TARGET_BIRTHS.flatMap((profile) => {
    const count = profile.single
      ? time >= 1 / 60 && stopSeconds > 1 / 60
        ? Math.max(Math.trunc(profile.rate) & 0xffff, 1)
        : 0
      : luxEmissionCount(profile.rate, time * 60, profile.emitterLife, stopSeconds * 60);
    const emitterSeed = seed ^ Math.imul(profile.index, 0x85ebca6b);
    return Array.from({ length: count }, (_, index) => {
      const ordinal = index + 1;
      const birthTime = (profile.single ? 1 : luxEmissionBirthTick(profile.rate, ordinal)) / 60;
      const age = time - birthTime;
      const chance = luxHoopChance(emitterSeed, ordinal);
      const birth = luxBindingTargetBirth(profile.index, chance);
      if (age < 0 || age >= birth.life) return null;
      return {
        profileIndex: profile.index,
        name: profile.name,
        ordinal,
        birthTime,
        age,
        chance,
        birthRandom: Math.fround(chance),
        ...birth,
      };
    }).filter((p) => p !== null);
  });
}
