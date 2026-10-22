/** See docs/CREST-OF-CINDERS.md: published values and provisional timing policies. */
export const CREST_OF_CINDERS = {
  durationSeconds: 120,
  slowTiers: [
    { level: 1, melee: 0.1, ranged: 0.05 },
    { level: 6, melee: 0.15, ranged: 0.075 },
    { level: 11, melee: 0.2, ranged: 0.1 },
  ],
  healTiers: [
    { level: 1, fractionPerFiveSeconds: 0.005 },
    { level: 4, fractionPerFiveSeconds: 0.01 },
    { level: 6, fractionPerFiveSeconds: 0.015 },
    { level: 11, fractionPerFiveSeconds: 0.03 },
  ],
  // Published endpoints; interpolation and all timings below are local policies.
  minimumBurnDamage: 15,
  maximumBurnDamage: 54,
  burnDurationSeconds: 2,
  burnIntervalSeconds: 1,
  slowDurationSeconds: 3,
  healingLockoutSeconds: 5,
  regenerationIntervalSeconds: 0.5,
} as const;
