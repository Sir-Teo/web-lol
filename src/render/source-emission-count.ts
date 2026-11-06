/** Count arithmetic only. Caller resolves rate/probability/quality, start/end,
 * active periods and stopped ownership before invoking this kernel. */
export interface SourceEmissionCountInput {
  rate: number;
  age: number;
  lastSpawn: number;
  emitted: boolean;
  singleParticle: boolean;
  variableStart: boolean;
  periodLength: number | null;
  maxPerFrame: number;
  segmentLimit: number | null;
  spawned: number;
}
export function sourceEmissionCount(input: SourceEmissionCountInput): number {
  const {
    rate,
    age,
    lastSpawn,
    emitted,
    singleParticle,
    variableStart,
    periodLength,
    maxPerFrame,
    segmentLimit,
    spawned,
  } = input;
  if (
    ![rate, age, lastSpawn].every((v) => Number.isFinite(v) && v >= 0) ||
    lastSpawn > age ||
    ![emitted, singleParticle, variableStart].every((v) => typeof v === 'boolean') ||
    (periodLength !== null && (!Number.isFinite(periodLength) || periodLength <= 0)) ||
    ![maxPerFrame, spawned, ...(segmentLimit === null ? [] : [segmentLimit])].every(
      (v) => Number.isSafeInteger(v) && v >= 0
    )
  )
    throw RangeError('Invalid resolved source emission count input');
  const cycleStart = periodLength === null ? 0 : Math.trunc(age / periodLength) * periodLength;
  const since = Math.max(cycleStart, lastSpawn);
  const cap = (Math.trunc(rate * 0.33) + 1) & 0xffff;
  let count = Math.min(Math.trunc((age - since) * rate) & 0xffff, cap);
  if (!emitted) {
    if (count === 0 && !variableStart) count = 1;
    if (singleParticle) count = Math.max(Math.trunc(rate) & 0xffff, 1);
  }
  count = Math.min(maxPerFrame > 0 && count >= maxPerFrame ? maxPerFrame : count, 1000);
  return segmentLimit !== null && segmentLimit > 0
    ? Math.min(count, Math.max(segmentLimit - spawned, 0))
    : count;
}
