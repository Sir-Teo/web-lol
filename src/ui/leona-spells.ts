import { LEONA_SPELLS, LEONA_SUNLIGHT } from '../content/leona-spells';
import { LEONA_COMBAT_POLICY } from '../content/leona-combat-policy';
import {
  leonaDaybreakValues,
  leonaEclipseValues,
  leonaSolarFlareValues,
  leonaSpellResources,
  leonaSunlightDamage,
  leonaZenithValues,
} from '../simulation/leona-spell-values';
import type { Ability } from '../simulation/types';

export const LEONA_HUD_SPELLS = {
  q: {
    name: 'Shield of Daybreak',
    icon: 'LeonaShieldOfDaybreak',
    cost: LEONA_SPELLS.q.manaByRank[0],
  },
  w: { name: 'Eclipse', icon: 'LeonaSolarBarrier', cost: LEONA_SPELLS.w.manaByRank[0] },
  e: { name: 'Zenith Blade', icon: 'LeonaZenithBlade', cost: LEONA_SPELLS.e.manaByRank[0] },
  r: { name: 'Solar Flare', icon: 'LeonaSolarFlare', cost: LEONA_SPELLS.r.manaByRank[0] },
} as const;
export type LeonaHudSpell = keyof typeof LEONA_HUD_SPELLS;
export function isLeonaSpell(ability: Ability): ability is LeonaHudSpell {
  return ability === 'q' || ability === 'w' || ability === 'e' || ability === 'r';
}
export function leonaPreviewResources(ability: LeonaHudSpell) {
  return leonaSpellResources(ability, 1);
}
export function leonaDescription(
  ability: LeonaHudSpell,
  rank: number,
  ap: number,
  level: number
): string {
  const sunlight = ` Marks surviving enemies with Sunlight for ${LEONA_SUNLIGHT.markSeconds} seconds. Another allied champion's attack or ability consumes the mark for ${leonaSunlightDamage(level)} magic damage before resistance.`;
  if (ability === 'q') {
    const q = leonaDaybreakValues(rank, ap);
    return (
      `Reset your attack timer. Your next attack within ${LEONA_COMBAT_POLICY.attackWindowTicks / 60} seconds gains ${LEONA_COMBAT_POLICY.empoweredRangeBonus} range, deals ${Math.round(q.bonusMagicDamage)} bonus magic damage before resistance and stuns for ${q.stunSeconds} second.` +
      sunlight
    );
  }
  if (ability === 'w') {
    const w = leonaEclipseValues(rank, ap, 0, 0);
    return (
      `Gain ${w.armorBonus} armor plus ${Math.round(LEONA_SPELLS.w.bonusArmorRatio * 100)}% of your bonus armor, and ${w.magicResistBonus} magic resistance plus ${Math.round(LEONA_SPELLS.w.bonusMagicResistRatio * 100)}% of your bonus magic resistance. Reduce incoming physical and magic damage by ${w.flatReduction} per hit, up to ${w.flatReductionMaximumFraction * 100}%. After ${w.resistanceSeconds} seconds, deal ${Math.round(w.magicDamage)} magic damage before resistance to nearby enemies. Hitting an enemy extends your defenses for ${w.resistanceSeconds} more seconds.` +
      sunlight
    );
  }
  if (ability === 'e') {
    const e = leonaZenithValues(rank, ap);
    return (
      `Strike enemies in a line for ${Math.round(e.magicDamage)} magic damage before resistance. At flight completion, root the last champion struck for ${e.rootSeconds} seconds and dash toward them. Cannot cast while rooted.` +
      sunlight
    );
  }
  const r = leonaSolarFlareValues(rank, ap);
  return (
    `Call down a flare at a point within ${LEONA_SPELLS.r.castRange} range. After ${Number((LEONA_COMBAT_POLICY.solarImpactTicks / 60).toFixed(2))} seconds, deal ${Math.round(r.magicDamage)} magic damage before resistance. Stun enemies in the center for ${r.crowdControlSeconds} seconds and slow others in the outer area by ${r.slowFraction * 100}% for the same duration.` +
    sunlight
  );
}
