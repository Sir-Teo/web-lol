import type { MatchRole } from './bot-roles';
import { TICK_RATE } from './rules';

export interface RoleQuestDefinition {
  role: MatchRole;
  id: string;
  name: string;
  rewardName: string;
  targetProgress: number;
  unitLabel: string;
  summary: string;
  rewardSummary: string;
}

export interface RoleQuestState {
  role: MatchRole;
  progress: number;
  target: number;
  completedTick: number | null;
  charges: number;
  nextChargeTick: number;
}

export const ROLE_QUESTS: Readonly<Record<MatchRole, RoleQuestDefinition>> = {
  top: {
    role: 'top',
    id: 'quest-top-titans-resolve',
    name: 'Top Quest: Titan’s Resolve',
    rewardName: 'Ascendant Level Cap (Lv. 20)',
    targetProgress: 1000,
    unitLabel: 'pts',
    summary:
      'Earn progress from lane CS (+18), turret strikes (+45), and champion takedowns (+120).',
    rewardSummary: 'Unlocks levels 19–20 (+2 max level cap) and extends fountain Homeguard speed.',
  },
  jungle: {
    role: 'jungle',
    id: 'quest-jungle-wildhunt',
    name: 'Jungle Quest: Wildhunt',
    rewardName: 'Primal Companion & Unleashed Smite',
    targetProgress: 40,
    unitLabel: 'treats',
    summary: 'Feed your jungle companion treats by clearing large monsters and epic objectives.',
    rewardSummary:
      'Evolves Smite to 1,200 monster damage (can slow champions) and unlocks full companion passive.',
  },
  mid: {
    role: 'mid',
    id: 'quest-mid-arcane-tempo',
    name: 'Mid Quest: Arcane Tempo',
    rewardName: 'Empowered Recall & Tier-3 Stride',
    targetProgress: 1000,
    unitLabel: 'pts',
    summary:
      'Earn progress from lane CS (+18), spell hits on champions (+25), turret damage (+45), and takedowns (+120).',
    rewardSummary:
      'Reduces Recall channel to 4.0s and grants +15 Move Speed and +10 Ability Haste.',
  },
  carry: {
    role: 'carry',
    id: 'quest-carry-arsenal',
    name: 'Bot Quest: Marksman’s Arsenal',
    rewardName: '7th Item Slot & War Chest',
    targetProgress: 1200,
    unitLabel: 'pts',
    summary:
      'Earn progress from minion CS (+20), structure hits (+35), and champion takedowns (+140).',
    rewardSummary: 'Expands item inventory capacity from 6 to 7 slots and grants +300 bonus gold.',
  },
  support: {
    role: 'support',
    id: 'quest-support-world-atlas',
    name: 'Support Quest: World Atlas',
    rewardName: 'Bounty of Worlds & Vigilant Wardstone',
    targetProgress: 800,
    unitLabel: 'gold',
    summary:
      'Consume Atlas charges (every 18s, max 3) by damaging champions/turrets or executing minions near an ally (+25g / +50 progress).',
    rewardSummary:
      'Raises Stealth Ward cap to 4, Control Ward cap to 2, and grants +200 Health & +10 Ability Haste.',
  },
} as const;

export const SUPPORT_QUEST_POLICY = {
  maxCharges: 3,
  chargeIntervalTicks: 18 * TICK_RATE,
  tributeGold: 25,
  tributeProgress: 50,
  allyRadius: 1100,
  passiveGoldPerTickInterval: 5 * TICK_RATE,
  passiveProgressPerInterval: 6,
  completionBonusHp: 200,
  completionBonusHaste: 10,
} as const;

export const CARRY_QUEST_COMPLETION_GOLD = 300;
export const MID_EMPOWERED_RECALL_TICKS = 4 * TICK_RATE;
export const MID_QUEST_BONUS_SPEED = 15;
export const MID_QUEST_BONUS_HASTE = 10;
export const TOP_QUEST_MAX_LEVEL = 20;
export const STANDARD_MAX_LEVEL = 18;
export const STANDARD_INVENTORY_SLOTS = 6;
export const CARRY_QUEST_INVENTORY_SLOTS = 7;

export function createRoleQuestState(role: MatchRole, tick = 0): RoleQuestState {
  const def = ROLE_QUESTS[role];
  return {
    role,
    progress: 0,
    target: def.targetProgress,
    completedTick: null,
    charges: role === 'support' ? 2 : 0,
    nextChargeTick: role === 'support' ? tick + SUPPORT_QUEST_POLICY.chargeIntervalTicks : 0,
  };
}

export function isRoleQuestComplete(quest: RoleQuestState | null | undefined): boolean {
  return !!quest && quest.completedTick !== null;
}

export function maxChampionLevelForQuest(quest: RoleQuestState | null | undefined): number {
  return quest?.role === 'top' && quest.completedTick !== null
    ? TOP_QUEST_MAX_LEVEL
    : STANDARD_MAX_LEVEL;
}

export function maxInventorySlotsForQuest(quest: RoleQuestState | null | undefined): number {
  return quest?.role === 'carry' && quest.completedTick !== null
    ? CARRY_QUEST_INVENTORY_SLOTS
    : STANDARD_INVENTORY_SLOTS;
}

export function maxStealthWardsForQuest(
  quest: RoleQuestState | null | undefined,
  defaultCap = 3
): number {
  return quest?.role === 'support' && quest.completedTick !== null ? 4 : defaultCap;
}

export function maxControlWardsForQuest(quest: RoleQuestState | null | undefined): number {
  return quest?.role === 'support' && quest.completedTick !== null ? 2 : 1;
}
