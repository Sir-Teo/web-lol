import { ABILITIES } from './rules';
import { SUMMONER_SMITE } from './summoner-smite';
export type SummonerSpell = 'flash' | 'heal' | 'smite';
export type SummonerSlot = 'd' | 'f';
export type SummonerLoadout = Record<SummonerSlot, SummonerSpell>;
export const DEFAULT_SUMMONERS: SummonerLoadout = { d: 'flash', f: 'heal' };
export const SUMMONERS = {
  flash: ABILITIES.d,
  heal: ABILITIES.f,
  smite: {
    name: 'Smite',
    icon: 'SummonerSmite',
    description: `Deal ${SUMMONER_SMITE.baseDamage} true damage to a large or medium monster, or an enemy lane minion. Stores two charges. Small monsters and champions cannot be targeted by base Smite.`,
    cooldown: SUMMONER_SMITE.cooldownSeconds,
    range: SUMMONER_SMITE.range,
    cost: 0,
    canCastWhileDisabled: SUMMONER_SMITE.canCastWhileDisabled,
    canCastWhileSilenced: true,
    preservesRecall: SUMMONER_SMITE.preservesRecall,
  },
} satisfies Record<SummonerSpell, typeof ABILITIES.d>;
export const isSummonerSlot = (ability: string): ability is SummonerSlot =>
  ability === 'd' || ability === 'f';
