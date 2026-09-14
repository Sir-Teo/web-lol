import profile from '../content/lux-r-streaks.json';
import { luxBeamBirthOffset } from './lux-beam-birth-offset';
import { luxHoopChance } from './lux-hoop-particles';

function sample(times: readonly number[], values: readonly number[], age: number) {
  if (age <= times[0]) return values[0];
  for (let i = 1; i < times.length; i++)
    if (age <= times[i])
      return (
        values[i - 1] +
        ((values[i] - values[i - 1]) * (age - times[i - 1])) / (times[i] - times[i - 1])
      );
  return values.at(-1)!;
}

/** A shared source birth chance drives each particle's correlated distributions. */
export function luxRStreakBirth(chance: number) {
  return {
    life: luxBeamBirthOffset(profile.life, chance)[0],
    velocity: luxBeamBirthOffset(profile.velocity, chance),
    offset: luxBeamBirthOffset(profile.offset, chance),
    halfSize: luxBeamBirthOffset(profile.halfSize, chance),
    multOffset: luxBeamBirthOffset(profile.multOffset, chance),
  };
}

/** Source-space burst at rest. Age starts at particle birth. Fixed 60 Hz drag and
 * indexed visual randomness reproduce saves, without claiming the native clock/PRNG.
 * Cast-frame attachment and rendering are deliberately outside this sampler. */
export function luxRStreakParticles(seed: number, age: number) {
  if (!Number.isFinite(age) || age < 0) return [];
  const ticks = age * 60,
    whole = Math.floor(ticks),
    fraction = ticks - whole;
  return Array.from({ length: profile.count }, (_, index) => {
    const chance = luxHoopChance(seed, index + 1),
      birth = luxRStreakBirth(chance);
    if (age >= birth.life) return null;
    const phase = age / birth.life;
    return {
      ordinal: index + 1,
      chance,
      life: birth.life,
      position: birth.velocity.map((velocity, axis) => {
        const decay = Math.max(0, 1 - profile.drag[axis] / 60);
        const distance =
          decay === 1
            ? velocity * age
            : (velocity / 60) *
              ((decay * (1 - decay ** whole)) / (1 - decay) + fraction * decay ** (whole + 1));
        return profile.emitterPosition[axis] + birth.offset[axis] + distance;
      }),
      halfSize: birth.halfSize.map(
        (v, axis) =>
          v *
          sample(
            profile.scale.times,
            profile.scale.values.map((s) => s[axis]),
            phase
          )
      ),
      color: [0, 1, 2, 3].map((axis) =>
        sample(
          profile.color.times,
          profile.color.values.map((c) => c[axis]),
          phase
        )
      ),
      rotation: profile.rotation,
      multOffset: birth.multOffset.map((v, axis) => v + profile.multScroll[axis] * age),
    };
  }).filter((p) => p !== null);
}
