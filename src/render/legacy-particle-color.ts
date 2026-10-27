/** Checked legacy raw-key color component. Callers select this local policy;
 * native draw selection, clocks and external color modifiers are separate. */
type ColorKey = { readonly time: number; readonly value: readonly number[] };
export type LegacyParticleColorCurve = readonly ColorKey[];

export function prepareLegacyParticleColor(
  base: readonly number[],
  keys: readonly ColorKey[]
): LegacyParticleColorCurve {
  if (base.length !== 4 || base.some((v) => !Number.isFinite(Math.fround(v))) || !keys.length)
    throw new RangeError('Legacy color preparation requires a finite RGBA base and keys');
  let previous = -Infinity;
  return keys.map((key) => {
    const time = Math.fround(key.time);
    if (
      !Number.isFinite(time) ||
      time <= previous ||
      key.value.length !== 4 ||
      key.value.some((v) => !Number.isFinite(Math.fround(v)))
    )
      throw new RangeError('Legacy color keys require increasing float32 times and finite RGBA');
    previous = time;
    const value = key.value.map((v, axis) => Math.fround(Math.fround(v) * Math.fround(base[axis])));
    if (value.some((v) => !Number.isFinite(v)))
      throw new RangeError('Legacy prepared color exceeds finite float32 storage');
    return { time, value };
  });
}

export function sampleLegacyParticleColor(
  curve: LegacyParticleColorCurve,
  input: number
): number[] {
  if (!Number.isFinite(input) || input < 0 || input > 1)
    throw new RangeError('Legacy color sampling requires a normalized finite phase');
  const phase = Math.fround(input);
  if (curve.length === 1 || phase <= curve[0].time) return [...curve[0].value];
  for (let k = 1; k < curve.length; k++) {
    if (phase >= curve[k].time) continue;
    const previous = curve[k - 1],
      next = curve[k],
      numerator = Math.fround(phase - previous.time),
      denominator = Math.fround(next.time - previous.time),
      ratio = Math.fround(numerator / denominator);
    return previous.value.map((v, axis) =>
      Math.fround(Math.fround(Math.fround(next.value[axis] - v) * ratio) + v)
    );
  }
  return [...curve[curve.length - 1].value];
}
