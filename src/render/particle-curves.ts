export type ParticleCurve = {
  times: readonly number[];
  values: readonly (readonly number[])[];
};
export function sampleParticleCurve(curve: ParticleCurve, time: number, axis: number): number {
  if (time <= curve.times[0]) return curve.values[0][axis];
  for (let i = 1; i < curve.times.length; i++)
    if (time <= curve.times[i])
      return (
        curve.values[i - 1][axis] +
        ((curve.values[i][axis] - curve.values[i - 1][axis]) * (time - curve.times[i - 1])) /
          (curve.times[i] - curve.times[i - 1])
      );
  return curve.values.at(-1)![axis];
}
/** Right-endpoint source rates on the local 60 Hz reconstruction grid, with
 * interpolation of the next step. Native update cadence is not claimed identical. */
export function accumulateParticleCurve(
  curve: ParticleCurve,
  age: number,
  life: number,
  axis: number
): number {
  const ticks = age * 60,
    whole = Math.floor(ticks);
  let value = 0;
  for (let tick = 1; tick <= whole; tick++)
    value += sampleParticleCurve(curve, tick / 60 / life, axis) / 60;
  return value + ((ticks - whole) * sampleParticleCurve(curve, (whole + 1) / 60 / life, axis)) / 60;
}
