/** See docs/CREST-OF-INSIGHT.md for source evidence and provisional policies. */
export const CREST_OF_INSIGHT = {
  durationSeconds: 120,
  hasteTiers: [
    { level: 1, haste: 10 },
    { level: 6, haste: 15 },
    { level: 11, haste: 20 },
  ],
  // The frozen tooltip exposes @f2@ and @f3@, not their numeric bindings.
  // These values and the half-second cadence remain provisional local policy.
  flatManaPerFiveSeconds: 25,
  maxManaFractionPerFiveSeconds: 0.05,
  regenerationIntervalSeconds: 0.5,
} as const;
