import type { MatchRole } from './bot-roles';
import { TICK_RATE } from './rules';

export const KEYSTONE_IDS = [
  'pta',
  'conqueror',
  'electrocute',
  'comet',
  'grasp',
  'first-strike',
] as const;
export type KeystoneId = (typeof KEYSTONE_IDS)[number];

export const SECONDARY_RUNE_IDS = [
  'triumph',
  'alacrity',
  'transcendence',
  'bone-plating',
  'cosmic-insight',
] as const;
export type SecondaryRuneId = (typeof SECONDARY_RUNE_IDS)[number];

export const OFFENSE_SHARD_IDS = ['adaptive', 'attack-speed', 'haste'] as const;
export type OffenseShardId = (typeof OFFENSE_SHARD_IDS)[number];

export const FLEX_SHARD_IDS = ['adaptive', 'move-speed', 'scaling-hp'] as const;
export type FlexShardId = (typeof FLEX_SHARD_IDS)[number];

export const DEFENSE_SHARD_IDS = ['flat-hp', 'tenacity'] as const;
export type DefenseShardId = (typeof DEFENSE_SHARD_IDS)[number];

export interface RuneLoadout {
  keystone: KeystoneId;
  secondary: SecondaryRuneId;
  shards: {
    offense: OffenseShardId;
    flex: FlexShardId;
    defense: DefenseShardId;
  };
}

export interface KeystoneDefinition {
  id: KeystoneId;
  path: 'Precision' | 'Domination' | 'Sorcery' | 'Resolve' | 'Inspiration';
  name: string;
  icon: string;
  description: string;
}

export const KEYSTONES: Readonly<Record<KeystoneId, KeystoneDefinition>> = {
  pta: {
    id: 'pta',
    path: 'Precision',
    name: 'Press the Attack',
    icon: 'RunePTA',
    description:
      'Hitting an enemy champion with 3 consecutive basic attacks deals 40–180 adaptive damage and exposes them to 8% increased damage for 6s.',
  },
  conqueror: {
    id: 'conqueror',
    path: 'Precision',
    name: 'Conqueror',
    icon: 'RuneConqueror',
    description:
      'Attacks and abilities against champions grant stacks (2 melee / 1 ranged, max 12) of Adaptive Force for 5s. At 12 stacks, heal for 8% melee / 5% ranged post-mitigation champion damage.',
  },
  electrocute: {
    id: 'electrocute',
    path: 'Domination',
    name: 'Electrocute',
    icon: 'RuneElectrocute',
    description:
      'Hitting a champion with 3 separate attacks or abilities within 3s strikes them for 50–190 (+40% bonus AD, +25% AP) adaptive lightning damage (20s–15s cooldown).',
  },
  comet: {
    id: 'comet',
    path: 'Sorcery',
    name: 'Arcane Comet',
    icon: 'RuneComet',
    description:
      'Damaging a champion with an ability hurls a comet at their location dealing 30–130 (+20% AP, +35% bonus AD) magic damage (20s–8s cooldown; spell hits refund 20% remaining cooldown).',
  },
  grasp: {
    id: 'grasp',
    path: 'Resolve',
    name: 'Grasp of the Undying',
    icon: 'RuneGrasp',
    description:
      'Every 4s in champion combat, your next basic attack on a champion deals 3.5% max HP magic damage, heals 1.3% max HP, and permanently grants +5 Health (60% effect for ranged).',
  },
  'first-strike': {
    id: 'first-strike',
    path: 'Inspiration',
    name: 'First Strike',
    icon: 'RuneFirstStrike',
    description:
      'Damaging an enemy champion within 0.25s of entering champion combat grants +10 gold and First Strike for 3s, dealing 7% bonus true damage and granting 50% of that bonus as gold (25s–15s cooldown).',
  },
} as const;

export const SECONDARY_RUNES: Readonly<
  Record<SecondaryRuneId, { id: SecondaryRuneId; name: string; description: string }>
> = {
  triumph: {
    id: 'triumph',
    name: 'Triumph',
    description:
      'Champion takedowns restore 5% missing Health + 2.5% max Health and grant +20 bonus gold.',
  },
  alacrity: {
    id: 'alacrity',
    name: 'Legend: Alacrity',
    description:
      'Gain 3% Attack Speed plus up to 15% bonus Attack Speed from champion takedowns and farm.',
  },
  transcendence: {
    id: 'transcendence',
    name: 'Transcendence',
    description:
      '+5 Ability Haste at Lv. 5, +5 at Lv. 8, and 20% basic-cooldown refund on takedown at Lv. 11+.',
  },
  'bone-plating': {
    id: 'bone-plating',
    name: 'Bone Plating',
    description:
      'After taking champion damage, the next 3 enemy attacks or spells within 1.5s deal 30–60 less damage (55s cooldown).',
  },
  'cosmic-insight': {
    id: 'cosmic-insight',
    name: 'Cosmic Insight',
    description: '+18 Summoner Spell Haste and +10 Item Haste.',
  },
} as const;

export const STAT_SHARD_LABELS = {
  offense: {
    adaptive: '+9 Adaptive Force',
    'attack-speed': '+10% Attack Speed',
    haste: '+8 Ability Haste',
  },
  flex: {
    adaptive: '+9 Adaptive Force',
    'move-speed': '+2% Move Speed',
    'scaling-hp': '+10–180 Scaling Health',
  },
  defense: {
    'flat-hp': '+65 Base Health',
    tenacity: '+10% Tenacity & Slow Resist',
  },
} as const;

export const DEFAULT_ROLE_RUNES: Readonly<Record<MatchRole, RuneLoadout>> = {
  top: {
    keystone: 'conqueror',
    secondary: 'triumph',
    shards: { offense: 'adaptive', flex: 'scaling-hp', defense: 'flat-hp' },
  },
  jungle: {
    keystone: 'conqueror',
    secondary: 'alacrity',
    shards: { offense: 'attack-speed', flex: 'adaptive', defense: 'flat-hp' },
  },
  mid: {
    keystone: 'comet',
    secondary: 'transcendence',
    shards: { offense: 'adaptive', flex: 'adaptive', defense: 'flat-hp' },
  },
  carry: {
    keystone: 'pta',
    secondary: 'alacrity',
    shards: { offense: 'attack-speed', flex: 'adaptive', defense: 'flat-hp' },
  },
  support: {
    keystone: 'grasp',
    secondary: 'bone-plating',
    shards: { offense: 'haste', flex: 'move-speed', defense: 'tenacity' },
  },
} as const;

export const RUNE_TIMING = {
  ptaStackWindowTicks: 4 * TICK_RATE,
  ptaExposeDurationTicks: 6 * TICK_RATE,
  ptaExposeCooldownTicks: 6 * TICK_RATE,
  ptaExposeMultiplier: 1.08,
  conquerorDurationTicks: 5 * TICK_RATE,
  conquerorMaxStacks: 12,
  electrocuteWindowTicks: 3 * TICK_RATE,
  cometFlightTicks: Math.round(0.45 * TICK_RATE),
  cometRadius: 190,
  graspCombatPrepTicks: 4 * TICK_RATE,
  graspReadyWindowTicks: 4 * TICK_RATE,
  firstStrikeGraceTicks: Math.round(0.25 * TICK_RATE),
  firstStrikeDurationTicks: 3 * TICK_RATE,
  bonePlatingDurationTicks: Math.round(1.5 * TICK_RATE),
  bonePlatingCooldownTicks: 55 * TICK_RATE,
} as const;
