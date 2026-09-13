// Standard-mode values pinned in docs/reference/lux-illumination.json.
// ByCharLevel values use champion level as index (index zero is 20).
export const LUX_ILLUMINATION = {
  durationSeconds: 6,
  baseDamageByLevel: [
    30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200,
  ],
  abilityPowerRatio: 0.35,
} as const;
