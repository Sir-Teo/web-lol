// Local bot policy, not a recovered native AI or recommended build.
export const LUX_BOT_POLICY = {
  early: ['e', 'q', 'w', 'e', 'e', 'r'],
  priority: ['r', 'e', 'q', 'w'],
  purchases: ['tome', 'boots'],
  shieldHealthFraction: 0.55,
  waveClear: {
    minimumTargets: 3,
    maximumCandidates: 24,
    aimMargin: 8,
    manaReserveFraction: 0.3,
    baseThreatRadius: 1200,
    emergencyTargets: 2,
    valueMultiplier: 1.25,
    emergencyValueMultiplier: 0.5,
    recastValueMultiplier: 0.25,
  },
} as const;
