import { GAREN_R } from './garen-r';
import { GAREN_R_WINDUP_TICKS } from './garen-r-policy';

/** Authored caster event; source-verified independently of the damage marker. */
export const GAREN_R_CAST_PARTICLE_FRAME = 10;
export const GAREN_R_CAST_PARTICLE_BONE = 'C_Buffbone_GLB_Layout_Loc';
/** The caster event follows the existing locally warped cast pose. Starting the
 * target sword on that same marker is an explicit local dispatch policy. */
export const GAREN_R_PARTICLE_START_TICKS =
  (GAREN_R_WINDUP_TICKS * GAREN_R_CAST_PARTICLE_FRAME) / GAREN_R.animationCastFrame;
