/** Local development bot progression, not recovered native AI or a recommended build. */
export const AHRI_BOT_POLICY = {
  early: ['q', 'e', 'w', 'q', 'q', 'r'],
  priority: ['r', 'q', 'w', 'e'],
  purchases: ['tome', 'boots'],
  peelRange: 700,
  escapeMinimumTravel: 200,
  escapeClearanceGain: 150,
  waveClear: {
    minimumTargets: 3,
    maximumCandidates: 24,
    aimMargin: 8,
    manaReserveFraction: 0.3,
    valueMultiplier: 1.5,
  },
} as const;
