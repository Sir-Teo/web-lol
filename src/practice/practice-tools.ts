import { ASHE_E } from '../content/ashe-e';
import { ASHE_Q } from '../content/ashe-q';
import { TICK_RATE } from '../content/rules';
import { SUMMONER_SMITE } from '../content/summoner-smite';
import { maxChampionLevelForQuest } from '../content/role-quests';
import { experienceToNextLevel } from '../simulation/progression';
import type { Ability } from '../simulation/types';
import { resetTrinket } from '../simulation/wards';
import type { World } from '../simulation/world';

export const IMMEDIATE_PRACTICE_ACTIONS = [
  'restore',
  'cooldowns',
  'gold',
  'dummy',
  'level-up',
  'max-level',
  'reset-enemy',
] as const;

export type ImmediatePracticeAction = (typeof IMMEDIATE_PRACTICE_ACTIONS)[number];
export type PracticeToolAction = ImmediatePracticeAction | 'fast-forward-30s';

export function isImmediatePracticeAction(value: unknown): value is ImmediatePracticeAction {
  return (
    typeof value === 'string' && (IMMEDIATE_PRACTICE_ACTIONS as readonly string[]).includes(value)
  );
}

/** Deterministic immediate practice-tool mutations shared by live play and replay logs. */
export function applyImmediatePracticeTool(world: World, action: ImmediatePracticeAction): string {
  if (action === 'restore') {
    const hero = world.hero;
    if (hero.hp > 0) {
      hero.hp = hero.maxHp;
      hero.mana = hero.maxMana;
    }
    return 'Health and mana restored';
  }
  if (action === 'cooldowns') {
    for (const ability of Object.keys(world.player.cooldowns) as Ability[])
      world.player.cooldowns[ability] = 0;
    const state = world.player;
    state.qStacks = world.hero.champion === 'ashe' && state.spellRanks.q > 0 ? ASHE_Q.maxStacks : 0;
    state.qStackExpiry = state.qStacks ? world.tick + ASHE_Q.stackSeconds * TICK_RATE : 0;
    state.eCharges =
      world.hero.champion === 'ashe' && state.spellRanks.e > 0 ? ASHE_E.maximumCharges : 0;
    state.eRechargeTick = null;
    if (world.hero.champion === 'garen' && world.hero.deadAt === null)
      state.garenPassiveReadyTick = 0;
    resetTrinket(state.trinket);
    if (state.smite) {
      state.smite.charges = SUMMONER_SMITE.maxCharges;
      state.smite.rechargeTick = null;
    }
    return 'Learned abilities are ready';
  }
  if (action === 'gold') {
    world.player.gold += 1000;
    return 'Added 1,000 gold';
  }
  if (action === 'dummy') {
    for (const unit of world.units)
      if (unit.kind === 'dummy') {
        unit.hp = unit.maxHp;
        unit.deadAt = null;
        unit.respawnTick = null;
      }
    return 'Target dummy restored';
  }
  if (action === 'level-up') {
    const cap = maxChampionLevelForQuest(world.player.roleQuest);
    if (world.player.level >= cap) return 'Already at maximum level';
    world.gainExperience(experienceToNextLevel(world.player.level) - world.player.xp);
    return `Reached level ${world.player.level}`;
  }
  if (action === 'max-level') {
    const cap = maxChampionLevelForQuest(world.player.roleQuest);
    if (world.player.level >= cap) return 'Already at maximum level';
    while (world.player.level < cap)
      world.gainExperience(experienceToNextLevel(world.player.level) - world.player.xp);
    return `Reached level ${cap}`;
  }
  for (const unit of world.units)
    if (unit.kind === 'champion' && unit.team !== world.hero.team && unit.hp > 0) {
      unit.hp = unit.maxHp;
      unit.mana = unit.maxMana;
    }
  return 'Opponent health and mana restored';
}
