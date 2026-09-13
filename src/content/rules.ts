import type { Ability } from '../simulation/types';
import { SUMMONER_HEAL } from './summoner-heal';
import { ASHE_Q } from './ashe-q';
import { ASHE_E } from './ashe-e';
import { ASHE_R } from './ashe-r';

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
    description: `Build 4 Focus with attacks. Consume Focus to gain attack speed for ${ASHE_Q.durationSeconds} seconds.`,
    cooldown: 0,
    cost: 30,
    range: 600,
    icon: 'AsheQ',
  },
  w: {
    name: 'Volley',
    description:
      'Fire a cone of frost arrows. Each enemy takes damage from one arrow and is slowed.',
    cooldown: 18,
    cost: 75,
    range: 1200,
    icon: 'Volley',
  },
  e: {
    minimapTargeting: ASHE_E.minimapTargeting,
    name: 'Hawkshot',
    description: `Send a hawk that reveals its route, then grants destination vision for ${ASHE_E.visionSeconds} seconds. Stores ${ASHE_E.maximumCharges} charges, restoring one every ${ASHE_E.rechargeSecondsByRank[0]} seconds.`,
    cooldown: ASHE_E.castCooldownSeconds,
    cost: 0,
    range: ASHE_E.range,
    icon: 'AsheSpiritOfTheHawk',
  },
  r: {
    minimapTargeting: ASHE_R.minimapTargeting,
    name: 'Enchanted Crystal Arrow',
    description:
      'Launch an arrow that passes through minions and stuns the first enemy champion hit.',
    cooldown: 100,
    cost: 100,
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
    description: 'Restore health and gain a brief burst of movement speed.',
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
    damage: 0,
    hp: 0,
    speed: 0,
    armor: 40,
  },
] as const;
export const ITEM_RECIPES: Readonly<Record<string, readonly string[]>> = {
  belt: ['ruby'],
  vest: ['cloth'],
};
