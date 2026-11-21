import {
  CARRY_QUEST_COMPLETION_GOLD,
  MID_QUEST_BONUS_SPEED,
  SUPPORT_QUEST_POLICY,
  createRoleQuestState,
  isRoleQuestComplete,
  type RoleQuestState,
} from '../content/role-quests';
import { companionStage, COMPANION_SOURCE } from '../content/companion-policy';
import { distance } from './math';
import { statPrecision } from './progression';
import { ownedCompanion } from './owned-companions';
import type { ChampionState, Unit } from './types';
import type { World } from './world';

export function initChampionRoleQuest(w: World, state: ChampionState): void {
  if (!w.battlefield.publicRift || !state.role) return;
  state.roleQuest = createRoleQuestState(state.role, w.tick);
}

function awardQuestProgress(w: World, u: Unit, state: ChampionState, delta: number): void {
  const q = state.roleQuest;
  if (!q || q.completedTick !== null || delta <= 0 || w.winner) return;
  q.progress = Math.min(q.target, statPrecision(q.progress + delta));
  if (q.progress >= q.target) completeRoleQuest(w, u, state, q);
}

function completeRoleQuest(w: World, u: Unit, state: ChampionState, q: RoleQuestState): void {
  if (q.completedTick !== null) return;
  q.completedTick = w.tick;
  q.progress = q.target;
  if (q.role === 'carry') {
    state.gold = statPrecision(state.gold + CARRY_QUEST_COMPLETION_GOLD);
    w.emit('gold', u, {
      unit: u.id,
      team: u.team,
      value: CARRY_QUEST_COMPLETION_GOLD,
    });
  } else if (q.role === 'mid') {
    u.speed = statPrecision(u.speed + MID_QUEST_BONUS_SPEED);
  } else if (q.role === 'support') {
    u.maxHp = statPrecision(u.maxHp + SUPPORT_QUEST_POLICY.completionBonusHp);
    if (w.alive(u)) {
      u.hp = Math.min(u.maxHp, statPrecision(u.hp + SUPPORT_QUEST_POLICY.completionBonusHp));
    }
  }
  w.emit('message', u, {
    text: `Role quest complete: ${
      q.role === 'top'
        ? 'Lv. 20 cap unlocked!'
        : q.role === 'carry'
          ? '7th item slot unlocked!'
          : q.role === 'mid'
            ? 'Empowered Recall & Stride unlocked!'
            : q.role === 'support'
              ? 'Vigilant Wardstone unlocked!'
              : 'Primal Companion evolved!'
    }`,
    unit: u.id,
    team: u.team,
  });
}

export function advanceRoleQuests(w: World): void {
  if (!w.battlefield.publicRift || w.winner) return;
  for (const u of w.units) {
    if (u.kind !== 'champion') continue;
    const state = w.championState(u.id);
    const q = state?.roleQuest;
    if (!state || !q) continue;

    if (q.role === 'jungle') {
      const pet = ownedCompanion(w, u.id);
      if (pet) {
        const fed = Math.min(q.target, pet.fed);
        q.progress = fed;
        if (
          q.completedTick === null &&
          companionStage(pet.fed) >= 2 &&
          pet.fed >= COMPANION_SOURCE.fullGrowthFeeds
        ) {
          completeRoleQuest(w, u, state, q);
        }
      }
      continue;
    }

    if (q.completedTick !== null) continue;

    if (q.role === 'support') {
      if (q.charges < SUPPORT_QUEST_POLICY.maxCharges && w.tick >= q.nextChargeTick) {
        q.charges++;
        q.nextChargeTick = w.tick + SUPPORT_QUEST_POLICY.chargeIntervalTicks;
      }
      if (w.tick > 0 && w.tick % SUPPORT_QUEST_POLICY.passiveGoldPerTickInterval === 0) {
        state.gold = statPrecision(state.gold + 3);
        awardQuestProgress(w, u, state, SUPPORT_QUEST_POLICY.passiveProgressPerInterval);
      }
    } else if (w.tick > 0 && w.tick % 60 === 0 && w.alive(u)) {
      // Steady baseline progress in active matches alongside CS/combat milestones
      awardQuestProgress(w, u, state, 2);
    }
  }
}

export function recordRoleQuestMinionKill(w: World, killer: Unit, victim: Unit): void {
  if (killer.kind !== 'champion') return;
  const state = w.championState(killer.id);
  const q = state?.roleQuest;
  if (!state || !q || isRoleQuestComplete(q)) return;
  if (q.role === 'top' || q.role === 'mid') {
    awardQuestProgress(
      w,
      killer,
      state,
      victim.kind === 'siege' || victim.kind === 'super' ? 36 : 18
    );
  } else if (q.role === 'carry') {
    awardQuestProgress(
      w,
      killer,
      state,
      victim.kind === 'siege' || victim.kind === 'super' ? 40 : 20
    );
  } else if (q.role === 'support' && q.charges > 0) {
    const allyNearby = w.units.some(
      (other) =>
        other.kind === 'champion' &&
        other.team === killer.team &&
        other.id !== killer.id &&
        w.alive(other) &&
        distance(other, killer) <= SUPPORT_QUEST_POLICY.allyRadius
    );
    if (allyNearby) {
      q.charges--;
      if (q.charges === SUPPORT_QUEST_POLICY.maxCharges - 1) {
        q.nextChargeTick = w.tick + SUPPORT_QUEST_POLICY.chargeIntervalTicks;
      }
      state.gold = statPrecision(state.gold + SUPPORT_QUEST_POLICY.tributeGold);
      awardQuestProgress(w, killer, state, SUPPORT_QUEST_POLICY.tributeProgress);
    }
  }
}

export function recordRoleQuestCombatHit(
  w: World,
  attacker: Unit,
  target: Unit,
  isAbility: boolean
): void {
  if (attacker.kind !== 'champion' || attacker.team === target.team) return;
  const state = w.championState(attacker.id);
  const q = state?.roleQuest;
  if (!state || !q || isRoleQuestComplete(q)) return;

  const isStructure =
    target.kind === 'turret' || target.kind === 'inhibitor' || target.kind === 'nexus';
  if (isStructure) {
    if (q.role === 'top' || q.role === 'mid') awardQuestProgress(w, attacker, state, 45);
    else if (q.role === 'carry') awardQuestProgress(w, attacker, state, 35);
  } else if (target.kind === 'champion' && isAbility && q.role === 'mid') {
    awardQuestProgress(w, attacker, state, 25);
  }

  if (q.role === 'support' && q.charges > 0 && (target.kind === 'champion' || isStructure)) {
    const allyNearby = w.units.some(
      (other) =>
        other.kind === 'champion' &&
        other.team === attacker.team &&
        other.id !== attacker.id &&
        w.alive(other) &&
        distance(other, attacker) <= SUPPORT_QUEST_POLICY.allyRadius
    );
    if (allyNearby) {
      q.charges--;
      if (q.charges === SUPPORT_QUEST_POLICY.maxCharges - 1) {
        q.nextChargeTick = w.tick + SUPPORT_QUEST_POLICY.chargeIntervalTicks;
      }
      state.gold = statPrecision(state.gold + SUPPORT_QUEST_POLICY.tributeGold);
      awardQuestProgress(w, attacker, state, SUPPORT_QUEST_POLICY.tributeProgress);
    }
  }
}

export function recordRoleQuestTakedown(w: World, participantId: number): void {
  const u = w.unit(participantId);
  const state = w.championState(participantId);
  const q = state?.roleQuest;
  if (!u || !state || !q || isRoleQuestComplete(q)) return;
  if (q.role === 'carry') awardQuestProgress(w, u, state, 140);
  else if (q.role === 'top' || q.role === 'mid') awardQuestProgress(w, u, state, 120);
  else if (q.role === 'support') awardQuestProgress(w, u, state, 90);
}
