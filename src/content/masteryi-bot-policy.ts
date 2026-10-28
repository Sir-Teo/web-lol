/** Local development choices, not recovered native AI or a recommended build. */
export const MASTER_YI_BOT_POLICY = {
  early: ['q', 'e', 'w', 'q', 'q', 'r'],
  priority: ['r', 'q', 'e', 'w'],
  highlanderRange: 900,
  sustainHealthFraction: 0.55,
  sustainStopHealthFraction: 0.85,
  sustainThreatRange: 1150,
} as const;
