import { LUX_ILLUMINATION_TRIGGER_VFX } from '../content/lux-illumination-trigger-vfx';
import { luxEmissionBirthTick, luxEmissionCount } from '../content/lux-emission';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';

/** Untransformed source-space birth values. Spawn rotation, orbital motion,
 * attachment travel and lifetime appearance are deliberately separate stages. */
export function luxIlluminationTriggerBirth(profileIndex: number, chance: number) {
  const profile = LUX_ILLUMINATION_TRIGGER_VFX[profileIndex];
  if (!profile) throw new RangeError('Unknown Illumination trigger emitter');
  const draw = (value: Parameters<typeof luxBeamBirthOffset>[0]) =>
    luxBeamBirthOffset(value, chance);
  return {
    life: draw(profile.life)[0],
    size: draw(profile.size),
    rotation: draw(profile.rotation),
    velocity: draw(profile.velocity),
    orbitalVelocity: draw(profile.orbitalVelocity),
    drag: draw(profile.drag),
    emitterPosition: draw(profile.emitterPosition),
    spawnOffset: draw(profile.spawnOffset),
    spawnAngles: profile.spawnAngles.map((angle) => draw(angle)[0]),
    color: draw(profile.birthColor),
  };
}

/** Live birth records at an arbitrary effect age. Uses the established local
 * 60 Hz emission policy and indexed random stream, not native cadence/PRNG parity.
 * A single emitter emits its rate-sized burst together on the first update.
 * Stopping prevents new emission while retaining already-born particles. */
export function luxIlluminationTriggerBirths(seed: number, time: number, stopSeconds = Infinity) {
  if (!Number.isFinite(time) || time < 0 || Number.isNaN(stopSeconds)) return [];
  return LUX_ILLUMINATION_TRIGGER_VFX.flatMap((profile) => {
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
      const birth = luxIlluminationTriggerBirth(profile.index, chance);
      if (age < 0 || age >= birth.life) return null;
      return {
        profileIndex: profile.index,
        name: profile.name,
        ordinal,
        birthTime,
        age,
        chance,
        ...birth,
      };
    }).filter((particle) => particle !== null);
  });
}
