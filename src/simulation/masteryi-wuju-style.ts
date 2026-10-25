import { MASTER_YI_E } from '../content/masteryi-e';
import { MASTER_YI } from '../content/masteryi-progression';
import { TICK_RATE } from '../content/rules';
import { growthAtLevel, statPrecision } from './progression';
import type { ChampionState, Unit, Team } from './types';

export interface WujuStyleState {
  startTick: number;
  endTick: number;
  rank: number;
}

export const WUJU_STYLE_TICKS = MASTER_YI_E.durationSeconds * TICK_RATE;

/** Local policy: instant self empowerment, public zero mana, live bonus AD at
 * contact and full on-hit true damage on Double Strike's separate contact.
 * The retained generic cast time is not a native activation callback. */
export function wujuStyleDamage(unit: Unit, owner: ChampionState, tick: number): number {
  const buff = owner.wujuStyle;
  if (unit.champion !== 'masteryi' || !buff || tick < buff.startTick || tick >= buff.endTick)
    return 0;
  const baseAD = statPrecision(
    MASTER_YI.damage + MASTER_YI.damageGrowth * growthAtLevel(owner.level)
  );
  const bonusAD = Math.max(0, statPrecision(unit.damage - baseAD));
  return MASTER_YI_E.baseDamageByRank[buff.rank - 1] + MASTER_YI_E.bonusAttackDamageRatio * bonusAD;
}

export function validateWujuStyles(
  owners: readonly Pick<ChampionState, 'id' | 'spellRanks' | 'wujuStyle'>[],
  units: readonly Unit[],
  tick: number,
  winner: Team | null
): void {
  for (const owner of owners) {
    const buff = owner.wujuStyle;
    if (!buff) continue;
    const unit = units.find((u) => u.id === owner.id);
    if (
      !unit ||
      unit.champion !== 'masteryi' ||
      unit.hp <= 0 ||
      winner !== null ||
      buff.rank > owner.spellRanks.e ||
      buff.startTick > tick ||
      buff.endTick <= tick ||
      buff.endTick !== buff.startTick + WUJU_STYLE_TICKS
    )
      throw new Error('Saved match contains invalid Wuju Style empowerment.');
  }
}
