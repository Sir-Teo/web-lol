/** Lux_Base_BA_mis hoop, pinned in docs/reference/lux-basic-attack.json.
 * Absent X/Y types use schema defaults 1 (lifetime) / 0 (constant).
 * The two named fields retain their original hash keys in the source record.
 */
export const LUX_BASIC_HOOP_APPEARANCE = {
  lookupX: { type: 1, scale: 1, offset: 0 },
  lookupY: { type: 0, scale: 0.5, offset: 0 },
  nominalLifetime: 0.15000000596046448,
  birthColor: [1, 1, 1, 0.6500037908554077],
  scaleTimes: [0, 1],
  relativeScale: [1, 0.5],
} as const;
