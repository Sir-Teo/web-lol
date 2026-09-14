/** Constant-rate, zero-delay, non-single Lux emitters on the reconstruction's
 * 60 Hz grid. A first update emits at least one particle and charges it against
 * the accumulated rate budget. A stopped update emits nothing.
 */
export function luxEmissionCount(
  rate: number,
  tick: number,
  emitterLife: number,
  stopTick = Infinity
) {
  const end = Math.min(Math.floor(tick), Math.floor(emitterLife * 60), Math.ceil(stopTick) - 1);
  if (!Number.isFinite(end) || end < 1 || rate <= 0) return 0;
  return Math.max(1, Math.floor((end * rate) / 60));
}
export function luxEmissionBirthTick(rate: number, ordinal: number) {
  return ordinal === 1 ? 1 : Math.ceil((ordinal * 60) / rate);
}
