import profile from '../content/lux-impact-sparks.json';
import { luxHoopChance } from './lux-hoop-particles';

function sample(times: readonly number[], values: readonly number[], t: number) {
  if (t <= times[0]) return values[0];
  for (let i = 1; i < times.length; i++)
    if (t <= times[i])
      return (
        values[i - 1] +
        ((values[i] - values[i - 1]) * (t - times[i - 1])) / (times[i] - times[i - 1])
      );
  return values.at(-1)!;
}
function probability(table: { keyTimes?: number[]; keyValues?: number[] }, chance: number) {
  return table.keyTimes?.length ? sample(table.keyTimes, table.keyValues!, chance) : 0;
}
export function luxImpactSparkBirth(chance: number) {
  if (!Number.isFinite(chance) || chance < 0 || chance > 1)
    throw new RangeError('Invalid birth chance');
  return {
    life: profile.life.value * probability(profile.life.probabilities[0], chance),
    velocity: profile.velocity.value.map(
      (v, i) => v * probability(profile.velocity.probabilities[i], chance)
    ),
    scale: profile.scale.value.map(
      (v, i) => v * probability(profile.scale.probabilities[i], chance)
    ),
  };
}
/** Five particles born together. Age is since birth, not emitter creation.
 * Static source frame: target-follow binding is not applied here. The indexed
 * visual hash and fixed 60 Hz drag are reconstruction choices, not native parity.
 */
export function luxImpactSparks(seed: number, age: number) {
  if (!Number.isFinite(age) || age < 0) return [];
  const ticks = age * 60,
    whole = Math.floor(ticks),
    fraction = ticks - whole;
  return Array.from({ length: profile.count }, (_, i) => {
    const chance = luxHoopChance(seed, i + 1),
      birth = luxImpactSparkBirth(chance);
    const phase = age / birth.life;
    const position = birth.velocity.map((v, axis) => {
      const decay = 1 - profile.drag[axis] / 60,
        power = decay ** whole;
      return (v / 60) * ((decay * (1 - power)) / (1 - decay) + fraction * power * decay);
    });
    // Derivative of the interpolated position segment, in source units/second.
    const velocity = birth.velocity.map((v, i) => v * (1 - profile.drag[i] / 60) ** (whole + 1));
    return {
      ordinal: i + 1,
      chance,
      life: birth.life,
      position,
      velocity,
      scale: birth.scale.map(
        (v, i) =>
          v *
          sample(
            profile.relativeScale.times,
            profile.relativeScale.values.map((s) => s[i]),
            phase
          )
      ),
      color: [0, 1, 2, 3].map((i) =>
        sample(
          profile.color.times,
          profile.color.values.map((c) => c[i]),
          phase
        )
      ),
      stretch: Math.max(profile.directionMin, Math.hypot(...velocity) * profile.directionScale),
    };
  }).filter((p) => age < p.life);
}
