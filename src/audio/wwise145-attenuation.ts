/** Source-distance evaluation matching pinned wwiser's bank-145 interpretation.
 * Caller supplies a verified, ordered eScaling=2 curve. Listener coordinates
 * and native scaling still need calibration.
 */
export function wwise145Attenuation(
  points: readonly { distance: number; storedValue: number; interpolation: number }[],
  distance: number
): { db: number; amplitude: number } {
  if (!Number.isFinite(distance) || distance < 0)
    throw new RangeError('Attenuation distance must be finite and nonnegative');
  let value: number = points[points.length - 1].storedValue;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    if (distance <= a.distance) {
      value = a.storedValue;
      break;
    }
    const b = points[i + 1];
    if (!b || distance >= b.distance) continue;
    const t = (distance - a.distance) / (b.distance - a.distance);
    switch (a.interpolation) {
      case 9:
        value = a.storedValue;
        break;
      case 4:
        value = a.storedValue + (b.storedValue - a.storedValue) * t;
        break;
      case 2:
        value = (t - 3) * t * 0.5 * (a.storedValue - b.storedValue) + a.storedValue;
        break;
      default:
        throw new Error('Unsupported attenuation interpolation');
    }
    break;
  }
  // eScaling=2 stores normalized values, not literal dB. Preserve the pinned
  // parser's explicit endpoint floor; do not invent clamping near the endpoint.
  const normalized = Math.max(-1, Math.min(1, value));
  const db = normalized === -1 ? -96.3 : 20 * Math.log10(normalized + 1);
  return { db, amplitude: 10 ** (db / 20) };
}
