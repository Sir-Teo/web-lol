import profiles from '../content/lux-impact-rings.json';

function sample(times: readonly number[], values: readonly number[], t: number) {
  if (t <= times[0]) return values[0];
  for (let i = 1; i < times.length; i++) {
    if (t > times[i]) continue;
    const fraction = (t - times[i - 1]) / (times[i] - times[i - 1]);
    return values[i - 1] + (values[i] - values[i - 1]) * fraction;
  }
  return values.at(-1)!;
}
/** One birth of each active ring/flash, in source units. The caller supplies age
 * since particle birth and a shared chance in [0,1]; emitter clock, attachment,
 * flex shape and native random sequence are deliberately outside this sampler.
 */
export function luxImpactRings(age: number, critical: boolean, chance: number) {
  if (!Number.isFinite(chance) || chance < 0 || chance > 1)
    throw new RangeError('Invalid birth chance');
  if (!Number.isFinite(age) || age < 0) return [];
  return profiles
    .filter((p) => (critical || !p.criticalOnly) && age < p.life)
    .map((p) => {
      const phase = age / p.life;
      return {
        name: p.name,
        size: p.scale * sample(p.scaleTimes, p.scales, phase),
        rotation: p.randomRotation ? p.rotation * 360 * chance : p.rotation,
        color: [0, 1, 2, 3].map((i) =>
          sample(
            p.colorTimes,
            p.colors.map((c) => c[i]),
            phase
          )
        ),
        lookup: p.lookupTypes.map(
          (type, i) =>
            p.lookupScale[i] * (type === 0 ? 1 : phase) + (type === 0 ? 0 : p.lookupOffset[i])
        ),
      };
    });
}
