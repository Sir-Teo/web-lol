/** Selected curves from the pinned external wwiser interpolation routine.
 * These operate on amplitude endpoints; native dispatch/mix remain separate. */
export function wwise145Fade(curve: 2 | 4 | 6, ratio: number, initial: number, target: number) {
  if (![ratio, initial, target].every(Number.isFinite))
    throw new RangeError('Fade inputs must be finite');
  const t = Math.max(0, Math.min(1, ratio));
  if (curve === 2) return (t - 3) * t * 0.5 * (initial - target) + initial;
  if (curve === 4) return (target - initial) * t + initial;
  if (curve === 6) return (t + 1) * t * 0.5 * (target - initial) + initial;
  throw new RangeError('Unsupported fade curve');
}
