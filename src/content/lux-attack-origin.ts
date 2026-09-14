import curve from './lux-attack-origin.json';

/** Model-local R_Hand position for the unblended, pinned attack1 clip.
 * Seconds are animation time, not elapsed attack-cycle time. No world transform,
 * gameplay launch timing or missile target-height policy is inferred here.
 */
export function luxAttackOrigin(seconds: number): [number, number, number] {
  if (!Number.isFinite(seconds)) throw new RangeError('Animation time must be finite');
  const time = Math.max(0, Math.min(curve.duration, seconds));
  let low = 0,
    high = curve.times.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >>> 1;
    if (curve.times[mid] <= time) low = mid;
    else high = mid;
  }
  const fraction = (time - curve.times[low]) / (curve.times[high] - curve.times[low]);
  const a = curve.positions[low],
    b = curve.positions[high];
  return [
    a[0] + (b[0] - a[0]) * fraction,
    a[1] + (b[1] - a[1]) * fraction,
    a[2] + (b[2] - a[2]) * fraction,
  ];
}
