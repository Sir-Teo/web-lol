/** Local role/route tuning, not recovered native bot AI or a complete role quest. */
export const MATCH_ROLES = ['top', 'jungle', 'mid', 'carry', 'support'] as const;
export type MatchRole = (typeof MATCH_ROLES)[number];
export const ROLE_LABELS: Record<MatchRole, string> = {
  top: 'Top',
  jungle: 'Jungle',
  mid: 'Mid',
  carry: 'Bottom',
  support: 'Support',
};
export const JUNGLE_BOT_POLICY = {
  route: ['blue', 'gromp', 'wolves', 'raptors', 'red', 'krugs'],
  approachRadius: 300,
  quietTicks: 120,
  scoutRetryTicks: 1800,
  supportFarmRadius: 1400,
} as const;
