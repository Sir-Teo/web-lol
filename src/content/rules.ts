import type { Ability } from '../simulation/types';
import { SUMMONER_HEAL } from './summoner-heal';
import { ASHE_Q } from './ashe-q';
import { ASHE_R } from './ashe-r';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
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
    name: 'Hawkshot',
    description: 'Reveal a distant area of the battlefield for 5 seconds.',
    cooldown: 45,
    cost: 0,
    range: 8000,
    icon: 'AsheSpiritOfTheHawk',
  },
  r: {
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
    description: '+10 Attack Damage · +80 Health',
    icon: '1055',
    damage: 10,
    hp: 80,
    speed: 0,
  },
  {
    id: 'boots',
    name: 'Boots',
    price: 300,
    description: '+25 Move Speed',
    icon: '1001',
    damage: 0,
    hp: 0,
    speed: 25,
  },
  {
    id: 'sword',
    name: 'Long Sword',
    price: 350,
    description: '+10 Attack Damage',
    icon: '1036',
    damage: 10,
    hp: 0,
    speed: 0,
  },
  {
    id: 'pickaxe',
    name: 'Pickaxe',
    price: 875,
    description: '+25 Attack Damage',
    icon: '1037',
    damage: 25,
    hp: 0,
    speed: 0,
  },
] as const;
