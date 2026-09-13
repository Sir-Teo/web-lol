import type { Ability } from '../simulation/types';
import { SUMMONER_HEAL } from './summoner-heal';
import { ASHE_Q } from './ashe-q';
import { ASHE_E } from './ashe-e';
import { ASHE_R } from './ashe-r';
import { ASHE_SPELL_RANKS } from './ashe-spell-ranks';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const RECALL_DURATION_TICKS = 8 * TICK_RATE;
export const RULESET = 'practice-0.1';
export const ABILITIES: Record<
  Ability,
  {
    name: string;
    description: string;
    cooldown: number;
    cost: number;
    range: number;
    icon: string;
    canCastWhileDisabled?: boolean;
    preservesRecall?: boolean;
    minimapTargeting?: boolean;
  }
> = {
  q: {
    name: 'Ranger’s Focus',
    description: `Build 4 Focus with attacks. Consume Focus to gain ${ASHE_Q.bonusAttackSpeedByRank[0] * 100}% attack speed for ${ASHE_Q.durationSeconds} seconds and empower attacks to deal ${Math.round(ASHE_Q.damageMultiplierByRank[0] * 100)}% damage. Activating resets your attack timer.`,
    cooldown: ASHE_SPELL_RANKS.q.cooldownSecondsByRank[0],
    cost: ASHE_SPELL_RANKS.q.manaByRank[0],
    range: 600,
    icon: 'AsheQ',
  },
  w: {
    name: 'Volley',
    description:
      'Fire a cone of frost arrows. Each enemy takes damage from one arrow and is slowed.',
    cooldown: ASHE_SPELL_RANKS.w.cooldownSecondsByRank[0],
    cost: ASHE_SPELL_RANKS.w.manaByRank[0],
    range: 1200,
    icon: 'Volley',
  },
  e: {
    minimapTargeting: ASHE_E.minimapTargeting,
    name: 'Hawkshot',
    description: `Send a hawk that reveals its route, then grants destination vision for ${ASHE_E.visionSeconds} seconds. Stores ${ASHE_E.maximumCharges} charges, restoring one every ${ASHE_E.rechargeSecondsByRank[0]} seconds.`,
    cooldown: ASHE_SPELL_RANKS.e.cooldownSecondsByRank[0],
    cost: ASHE_SPELL_RANKS.e.manaByRank[0],
    range: ASHE_E.range,
    icon: 'AsheSpiritOfTheHawk',
  },
  r: {
    minimapTargeting: ASHE_R.minimapTargeting,
    name: 'Enchanted Crystal Arrow',
    description:
      'Launch an arrow that passes through minions and stuns the first enemy champion hit.',
    cooldown: ASHE_SPELL_RANKS.r.cooldownSecondsByRank[0],
    cost: ASHE_SPELL_RANKS.r.manaByRank[0],
    range: ASHE_R.range,
    icon: 'EnchantedCrystalArrow',
  },
  d: {
    name: 'Flash',
    description: 'Blink a short distance toward the cursor.',
    cooldown: 300,
    cost: 0,
    range: 400,
    icon: 'SummonerFlash',
  },
  f: {
    name: 'Heal',
    description: `Restore ${SUMMONER_HEAL.minimumHeal}–${SUMMONER_HEAL.maximumHeal} health, based on your level, to yourself and one nearby allied champion. Both gain ${SUMMONER_HEAL.speedBonus * 100}% movement speed for ${SUMMONER_HEAL.speedDurationSeconds} second. Healing is reduced by ${100 - SUMMONER_HEAL.repeatHealMultiplier * 100}% on targets recently affected by Summoner Heal.`,
    cooldown: SUMMONER_HEAL.cooldownSeconds,
    canCastWhileDisabled: SUMMONER_HEAL.canCastWhileDisabled,
    preservesRecall: SUMMONER_HEAL.preservesRecall,
    cost: 0,
    range: 0,
    icon: 'SummonerHeal',
  },
};
export const ITEMS = [
  {
    id: 'blade',
    name: 'Doran’s Blade',
    price: 450,
    sell: 180,
    description: '+10 Attack Damage · +80 Health · 2.5% Omnivamp',
    icon: '1055',
    magicResist: 0,
    damage: 10,
    armor: 0,
    hp: 80,
    speed: 0,
  },
  {
    id: 'boots',
    name: 'Boots',
    price: 300,
    sell: 210,
    description: '+25 Move Speed',
    icon: '1001',
    magicResist: 0,
    damage: 0,
    armor: 0,
    hp: 0,
    speed: 25,
  },
  {
    id: 'sword',
    name: 'Long Sword',
    price: 350,
    sell: 245,
    description: '+10 Attack Damage',
    icon: '1036',
    magicResist: 0,
    damage: 10,
    armor: 0,
    hp: 0,
    speed: 0,
  },
  {
    id: 'pickaxe',
    name: 'Pickaxe',
    price: 875,
    sell: 613,
    description: '+25 Attack Damage',
    icon: '1037',
    magicResist: 0,
    damage: 25,
    armor: 0,
    hp: 0,
    speed: 0,
  },
  {
    id: 'ruby',
    name: 'Ruby Crystal',
    price: 400,
    sell: 280,
    description: '+150 Health',
    icon: '1028',
    magicResist: 0,
    damage: 0,
    armor: 0,
    hp: 150,
    speed: 0,
  },
  {
    id: 'belt',
    name: 'Giant’s Belt',
    price: 900,
    sell: 630,
    description: '+350 Health · Builds from Ruby Crystal',
    icon: '1011',
    magicResist: 0,
    damage: 0,
    armor: 0,
    hp: 350,
    speed: 0,
  },
  {
    id: 'cloth',
    name: 'Cloth Armor',
    price: 300,
    sell: 210,
    description: '+15 Armor',
    icon: '1029',
    magicResist: 0,
    damage: 0,
    hp: 0,
    speed: 0,
    armor: 15,
  },
  {
    id: 'vest',
    name: 'Chain Vest',
    price: 800,
    sell: 560,
    description: '+40 Armor · Builds from Cloth Armor',
    icon: '1031',
    magicResist: 0,
    damage: 0,
    hp: 0,
    speed: 0,
    armor: 40,
  },
  {
    id: 'mantle',
    name: 'Null-Magic Mantle',
    price: 400,
    sell: 280,
    description: '+20 Magic Resist',
    icon: '1033',
    damage: 0,
    armor: 0,
    magicResist: 20,
    hp: 0,
    speed: 0,
  },
  {
    id: 'cloak',
    name: 'Negatron Cloak',
    price: 850,
    sell: 595,
    description: '+45 Magic Resist · Builds from Null-Magic Mantle',
    icon: '1057',
    damage: 0,
    armor: 0,
    magicResist: 45,
    hp: 0,
    speed: 0,
  },
] as const;
export const ITEM_RECIPES: Readonly<Record<string, readonly string[]>> = {
  belt: ['ruby'],
  vest: ['cloth'],
  cloak: ['mantle'],
};
