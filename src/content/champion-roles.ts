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
} as const satisfies Record<ChampionIdentity, MatchRole>;
