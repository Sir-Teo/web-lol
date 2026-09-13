/** Shared by damage resolution and local combat estimates. */
export function damageAfterResistance(raw: number, resistance: number): number {
  const multiplier = resistance >= 0 ? 100 / (100 + resistance) : 2 - 100 / (100 - resistance);
  return raw * multiplier;
}
