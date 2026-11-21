import type { ChampionIdentity } from '../simulation/types';
import type { MatchRole } from './bot-roles';

/** Local human-position policy, shared by match creation and its chooser. */
export const PLAYER_CHAMPION_ROLES = {
  ashe: 'carry',
  lux: 'mid',
  garen: 'top',
  masteryi: 'jungle',
  leona: 'support',
  ahri: 'mid',
  darius: 'top',
  vi: 'jungle',
  ezreal: 'carry',
  morgana: 'support',
} as const satisfies Record<ChampionIdentity, MatchRole>;

/** Distinct two-champion pools per position for zero-mirror 10-champion 5v5 matches. */
export const ROLE_CHAMPION_POOLS: Readonly<
  Record<MatchRole, readonly [ChampionIdentity, ChampionIdentity]>
> = {
  top: ['garen', 'darius'],
  jungle: ['masteryi', 'vi'],
  mid: ['ahri', 'lux'],
  carry: ['ashe', 'ezreal'],
  support: ['leona', 'morgana'],
} as const;
