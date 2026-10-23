import { LEONA } from '../content/leona-progression';
import { LEONA_SPELLS } from '../content/leona-spells';
import { ASHE } from '../content/ashe-progression';
import { statPrecision } from './progression';
import type { ChampionState, Unit } from './types';

// Mirror gainExperience's per-level rounding rather than subtracting an
// unrounded aggregate, which can invent tiny bonus resistances at high levels.
const baseResistances = ASHE.growthFactors.map((_, i) => {
  let armor: number = LEONA.armor,
    magicResist: number = LEONA.magicResist;
  for (let level = 1; level <= i; level++) {
    armor = statPrecision(armor + LEONA.armorGrowth * ASHE.growthFactors[level]);
    magicResist = statPrecision(magicResist + LEONA.magicResistGrowth * ASHE.growthFactors[level]);
  }
  return { armor, magicResist };
});

/** Stored unit resistances exclude Eclipse. Recompute from other bonuses at use,
 * so growth, purchases and sales cannot recursively compound or leave residue. */
export function eclipseResistances(unit: Unit, state: ChampionState, tick: number) {
  const eclipse = state.leonaW;
  if (!eclipse || tick >= eclipse.endTick) return { armor: 0, magicResist: 0 };
  const base = baseResistances[state.level - 1],
    spec = LEONA_SPELLS.w;
  return {
    armor: statPrecision(
      spec.baseArmorByRank[eclipse.rank - 1] +
        spec.bonusArmorRatio * Math.max(0, unit.armor - base.armor)
    ),
    magicResist: statPrecision(
      spec.baseMagicResistByRank[eclipse.rank - 1] +
        spec.bonusMagicResistRatio * Math.max(0, unit.magicResist - base.magicResist)
    ),
  };
}

/** Explicit local ordering: amplified raw damage, capped flat reduction, then
 * resistances/percentage reduction, then shields. True damage bypasses it. */
export function eclipseReducedRaw(raw: number, state: ChampionState, tick: number): number {
  const eclipse = state.leonaW;
  if (!eclipse || tick >= eclipse.endTick || raw <= 0) return raw;
  const spec = LEONA_SPELLS.w;
  return (
    raw -
    Math.min(spec.flatReductionByRank[eclipse.rank - 1], raw * spec.flatReductionMaximumFraction)
  );
}
