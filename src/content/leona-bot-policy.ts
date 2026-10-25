/** Development bot tuning, not recovered native AI or a recommended item build. */
export const LEONA_BOT_POLICY = {
  early: ['q', 'e', 'w', 'w', 'w', 'r'],
  priority: ['r', 'w', 'e', 'q'],
  purchases: ['ruby', 'boots', 'cloth', 'mantle'],
  upgrades: { ruby: 'belt', cloth: 'vest', mantle: 'cloak' },
  defenseHorizonTicks: 45,
  supportApproachTicks: 45,
  supportStagingDistance: 250,
  zenithIsolationRadius: 1000,
  solarMinimumHeldTargets: 2,
} as const;
