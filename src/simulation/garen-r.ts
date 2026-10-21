import { GAREN_R } from '../content/garen-r';

export function garenRDamage(rank: number, hp: number, maxHp: number): number {
  return (
    GAREN_R.baseDamageByRank[rank - 1] +
    GAREN_R.missingHealthRatioByRank[rank - 1] * Math.max(0, maxHp - hp)
  );
}

/** Local retention bound: covers the source impact decal's ~2.32 s envelope
 * after release, with room for interpolation. Native system end timing is open. */
export const GAREN_R_VISUAL_TAIL_TICKS = 180;
