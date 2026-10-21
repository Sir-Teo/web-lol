import { GAREN_R } from '../content/garen-r';

export function garenRDamage(rank: number, hp: number, maxHp: number): number {
  return (
    GAREN_R.baseDamageByRank[rank - 1] +
    GAREN_R.missingHealthRatioByRank[rank - 1] * Math.max(0, maxHp - hp)
  );
}
