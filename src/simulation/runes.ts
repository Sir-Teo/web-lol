import { isMeleeChampion } from '../content/champion-profiles';
import { DEFAULT_ROLE_RUNES, RUNE_TIMING, type RuneLoadout } from '../content/runes';
import { TICK_RATE } from '../content/rules';
import { distance, type Vec2 } from './math';
import { statPrecision } from './progression';
import type { ChampionState, Team, Unit } from './types';
import type { World } from './world';

export interface ActiveComet {
  id: number;
  sourceId: number;
  team: Team;
  origin: Vec2;
  target: Vec2;
  launchTick: number;
  impactTick: number;
  damage: number;
}

export interface ChampionRuneState {
  loadout: RuneLoadout;
  ptaTargetId: number | null;
  ptaStacks: number;
  ptaLastHitTick: number;
  ptaReadyTick: number;
  conquerorStacks: number;
  conquerorEndTick: number;
  electrocuteTargetId: number | null;
  electrocuteHits: number;
  electrocuteWindowEndTick: number;
  electrocuteReadyTick: number;
  cometReadyTick: number;
  graspCombatSinceTick: number | null;
  graspLastCombatTick: number;
  graspReady: boolean;
  graspPermanentHp: number;
  firstStrikeReadyTick: number;
  firstStrikeActiveUntil: number;
  firstStrikeCombatLockTick: number;
  alacrityStacks: number; // 0..10 (each stack = 1.5% AS on top of 3% base)
  bonePlatingReadyTick: number;
  bonePlatingActiveUntil: number;
  bonePlatingCharges: number;
  appliedScalingHp: number;
}

export function createChampionRuneState(loadout: RuneLoadout): ChampionRuneState {
  return {
    loadout: {
      keystone: loadout.keystone,
      secondary: loadout.secondary,
      shards: { ...loadout.shards },
    },
    ptaTargetId: null,
    ptaStacks: 0,
    ptaLastHitTick: 0,
    ptaReadyTick: 0,
    conquerorStacks: 0,
    conquerorEndTick: 0,
    electrocuteTargetId: null,
    electrocuteHits: 0,
    electrocuteWindowEndTick: 0,
    electrocuteReadyTick: 0,
    cometReadyTick: 0,
    graspCombatSinceTick: null,
    graspLastCombatTick: 0,
    graspReady: false,
    graspPermanentHp: 0,
    firstStrikeReadyTick: 0,
    firstStrikeActiveUntil: 0,
    firstStrikeCombatLockTick: 0,
    alacrityStacks: 0,
    bonePlatingReadyTick: 0,
    bonePlatingActiveUntil: 0,
    bonePlatingCharges: 0,
    appliedScalingHp: 0,
  };
}

export function defaultRuneLoadoutForRole(role: ChampionState['role']): RuneLoadout {
  return DEFAULT_ROLE_RUNES[role ?? 'carry'];
}

export function applyInitialRuneShards(w: World, u: Unit, state: ChampionState): void {
  const rs = state.runeState;
  if (!rs) return;
  if (rs.loadout.shards.defense === 'flat-hp') {
    u.maxHp = statPrecision(u.maxHp + 65);
    u.hp = statPrecision(u.hp + 65);
  }
  if (rs.loadout.shards.flex === 'move-speed') {
    u.speed = statPrecision(u.speed * 1.02);
  }
  syncScalingHpShard(w, u, state);
}

export function syncScalingHpShard(w: World, u: Unit, state: ChampionState): void {
  const rs = state.runeState;
  if (!rs || rs.loadout.shards.flex !== 'scaling-hp') return;
  const targetBonus = Math.round(10 + ((state.level - 1) / 17) * 170);
  const delta = targetBonus - rs.appliedScalingHp;
  if (delta !== 0) {
    rs.appliedScalingHp = targetBonus;
    u.maxHp = statPrecision(u.maxHp + delta);
    if (w.alive(u) && delta > 0) u.hp = Math.min(u.maxHp, statPrecision(u.hp + delta));
  }
}

export function runeAbilityHaste(state: ChampionState): number {
  const rs = state.runeState;
  if (!rs) return 0;
  let haste = rs.loadout.shards.offense === 'haste' ? 8 : 0;
  if (rs.loadout.secondary === 'transcendence') {
    if (state.level >= 5) haste += 5;
    if (state.level >= 8) haste += 5;
  }
  return haste;
}

export function runeSummonerHaste(state: ChampionState): number {
  return state.runeState?.loadout.secondary === 'cosmic-insight' ? 18 : 0;
}

export function runeItemHaste(state: ChampionState): number {
  return state.runeState?.loadout.secondary === 'cosmic-insight' ? 10 : 0;
}

export function runeBonusAttackSpeed(state: ChampionState): number {
  const rs = state.runeState;
  if (!rs) return 0;
  let bonus = rs.loadout.shards.offense === 'attack-speed' ? 0.1 : 0;
  if (rs.loadout.secondary === 'alacrity') {
    bonus += 0.03 + rs.alacrityStacks * 0.015;
  }
  return bonus;
}

export function runeTenacity(state: ChampionState): number {
  return state.runeState?.loadout.shards.defense === 'tenacity' ? 0.1 : 0;
}

/** Adaptive force converts to 0.6 bonus AD or 1.0 AP depending on itemization/champion identity. */
export function runeAdaptiveStats(
  w: World,
  u: Unit,
  state: ChampionState
): { bonusAd: number; bonusAp: number } {
  const rs = state.runeState;
  if (!rs) return { bonusAd: 0, bonusAp: 0 };
  let force = 0;
  if (rs.loadout.shards.offense === 'adaptive') force += 9;
  if (rs.loadout.shards.flex === 'adaptive') force += 9;
  if (
    rs.loadout.keystone === 'conqueror' &&
    rs.conquerorEndTick > w.tick &&
    rs.conquerorStacks > 0
  ) {
    const perStack = 2 + ((state.level - 1) / 17) * 2.5;
    force += rs.conquerorStacks * perStack;
  }
  if (force <= 0) return { bonusAd: 0, bonusAp: 0 };
  const prefersAp = u.champion === 'lux' || u.champion === 'ahri' || u.champion === 'morgana';
  return prefersAp
    ? { bonusAd: 0, bonusAp: statPrecision(force) }
    : { bonusAd: statPrecision(force * 0.6), bonusAp: 0 };
}

export function advanceRunes(w: World): void {
  for (const u of w.units) {
    if (u.kind !== 'champion') continue;
    const state = w.championState(u.id);
    const rs = state?.runeState;
    if (!state || !rs) continue;
    if (rs.conquerorEndTick <= w.tick) rs.conquerorStacks = 0;
    if (rs.ptaStacks > 0 && w.tick - rs.ptaLastHitTick > RUNE_TIMING.ptaStackWindowTicks) {
      rs.ptaStacks = 0;
      rs.ptaTargetId = null;
    }
    if (rs.electrocuteHits > 0 && w.tick > rs.electrocuteWindowEndTick) {
      rs.electrocuteHits = 0;
      rs.electrocuteTargetId = null;
    }
    if (rs.graspCombatSinceTick !== null) {
      if (w.tick - rs.graspLastCombatTick > RUNE_TIMING.graspReadyWindowTicks) {
        rs.graspCombatSinceTick = null;
        rs.graspReady = false;
      } else if (w.tick - rs.graspCombatSinceTick >= RUNE_TIMING.graspCombatPrepTicks) {
        rs.graspReady = true;
      }
    }
    if (rs.bonePlatingActiveUntil <= w.tick) rs.bonePlatingCharges = 0;
  }

  if (w.activeComets?.length) {
    const remaining: ActiveComet[] = [];
    for (const comet of w.activeComets) {
      if (w.tick < comet.impactTick) {
        remaining.push(comet);
        continue;
      }
      const caster = w.unit(comet.sourceId);
      if (caster && !w.winner) {
        for (const victim of w.units) {
          if (
            victim.team !== comet.team &&
            victim.team !== 'neutral' &&
            w.targetable(victim) &&
            !isStructure(victim) &&
            distance(victim, comet.target) <= RUNE_TIMING.cometRadius + victim.radius
          ) {
            w.damage(caster, victim, comet.damage, 'magic', 'rune');
          }
        }
      }
    }
    w.activeComets = remaining;
  }
}

function isStructure(u: Unit): boolean {
  return u.kind === 'turret' || u.kind === 'inhibitor' || u.kind === 'nexus';
}

export function applyBonePlatingReduction(
  w: World,
  attacker: Unit,
  _defender: Unit,
  defenderState: ChampionState | undefined,
  amount: number
): number {
  const rs = defenderState?.runeState;
  if (!rs || rs.loadout.secondary !== 'bone-plating' || attacker.kind !== 'champion' || amount <= 0)
    return amount;
  if (rs.bonePlatingActiveUntil > w.tick && rs.bonePlatingCharges > 0) {
    rs.bonePlatingCharges--;
    const reduction = 30 + ((defenderState!.level - 1) / 17) * 30;
    return Math.max(1, amount - reduction);
  }
  if (w.tick >= rs.bonePlatingReadyTick) {
    rs.bonePlatingActiveUntil = w.tick + RUNE_TIMING.bonePlatingDurationTicks;
    rs.bonePlatingCharges = 3;
    rs.bonePlatingReadyTick = w.tick + RUNE_TIMING.bonePlatingCooldownTicks;
  }
  return amount;
}

export function onRuneCombatDamaged(w: World, attacker: Unit, defender: Unit): void {
  if (attacker.kind !== 'champion' || defender.kind !== 'champion') return;
  const defState = w.championState(defender.id);
  const defRs = defState?.runeState;
  if (defRs) {
    defRs.graspCombatSinceTick ??= w.tick;
    defRs.graspLastCombatTick = w.tick;
    if (
      defRs.loadout.keystone === 'first-strike' &&
      defRs.firstStrikeActiveUntil <= w.tick &&
      w.tick >= defRs.firstStrikeReadyTick
    ) {
      // Taking champion damage first puts First Strike on cooldown unless within 0.25s grace
      if (defRs.firstStrikeCombatLockTick === 0) {
        defRs.firstStrikeCombatLockTick = w.tick + RUNE_TIMING.firstStrikeGraceTicks;
      } else if (w.tick > defRs.firstStrikeCombatLockTick) {
        const cdSec = 25 - ((defState!.level - 1) / 17) * 10;
        defRs.firstStrikeReadyTick = w.tick + Math.round(cdSec * TICK_RATE);
        defRs.firstStrikeCombatLockTick = 0;
      }
    }
  }
}

export function onRuneHitDealt(
  w: World,
  attacker: Unit,
  target: Unit,
  dealtDamage: number,
  isBasicAttack: boolean,
  isAbility: boolean
): void {
  if (attacker.kind !== 'champion' || target.kind !== 'champion' || attacker.team === target.team)
    return;
  const state = w.championState(attacker.id);
  const rs = state?.runeState;
  if (!state || !rs || dealtDamage <= 0) return;

  rs.graspCombatSinceTick ??= w.tick;
  rs.graspLastCombatTick = w.tick;
  const levelFrac = Math.max(0, Math.min(1, (state.level - 1) / 17));
  const melee = isMeleeChampion(attacker.champion);

  // First Strike
  if (rs.loadout.keystone === 'first-strike') {
    if (rs.firstStrikeActiveUntil <= w.tick && w.tick >= rs.firstStrikeReadyTick) {
      rs.firstStrikeActiveUntil = w.tick + RUNE_TIMING.firstStrikeDurationTicks;
      const cdSec = 25 - levelFrac * 10;
      rs.firstStrikeReadyTick = w.tick + Math.round(cdSec * TICK_RATE);
      rs.firstStrikeCombatLockTick = 0;
      state.gold = statPrecision(state.gold + 10);
      w.emit('gold', attacker, { unit: attacker.id, team: attacker.team, value: 10 });
    }
    if (rs.firstStrikeActiveUntil > w.tick) {
      const bonusTrue = statPrecision(dealtDamage * 0.07);
      if (bonusTrue > 0.5) {
        w.damage(attacker, target, bonusTrue, 'true', 'rune');
        const goldGain = Math.max(1, Math.round(bonusTrue * 0.5));
        state.gold = statPrecision(state.gold + goldGain);
      }
    }
  }

  // Press the Attack
  if (rs.loadout.keystone === 'pta' && isBasicAttack && w.tick >= rs.ptaReadyTick) {
    if (rs.ptaTargetId === target.id) rs.ptaStacks++;
    else {
      rs.ptaTargetId = target.id;
      rs.ptaStacks = 1;
    }
    rs.ptaLastHitTick = w.tick;
    if (rs.ptaStacks >= 3) {
      rs.ptaStacks = 0;
      rs.ptaTargetId = null;
      rs.ptaReadyTick = w.tick + RUNE_TIMING.ptaExposeCooldownTicks;
      target.ptaExposedUntil = w.tick + RUNE_TIMING.ptaExposeDurationTicks;
      const burst = 40 + levelFrac * 140;
      const dmgType =
        attacker.champion === 'lux' ||
        attacker.champion === 'ahri' ||
        attacker.champion === 'morgana'
          ? 'magic'
          : 'physical';
      w.damage(attacker, target, burst, dmgType, 'rune');
    }
  }

  // Conqueror
  if (rs.loadout.keystone === 'conqueror' && (isBasicAttack || isAbility)) {
    const add = isAbility || melee ? 2 : 1;
    const wasMax =
      rs.conquerorStacks >= RUNE_TIMING.conquerorMaxStacks && rs.conquerorEndTick > w.tick;
    rs.conquerorStacks = Math.min(RUNE_TIMING.conquerorMaxStacks, rs.conquerorStacks + add);
    rs.conquerorEndTick = w.tick + RUNE_TIMING.conquerorDurationTicks;
    if (wasMax && w.alive(attacker)) {
      const vamp = dealtDamage * (melee ? 0.08 : 0.05);
      w.healUnit(attacker, vamp);
    }
  }

  // Electrocute
  if (
    rs.loadout.keystone === 'electrocute' &&
    (isBasicAttack || isAbility) &&
    w.tick >= rs.electrocuteReadyTick
  ) {
    if (rs.electrocuteTargetId !== target.id || w.tick > rs.electrocuteWindowEndTick) {
      rs.electrocuteTargetId = target.id;
      rs.electrocuteHits = 1;
      rs.electrocuteWindowEndTick = w.tick + RUNE_TIMING.electrocuteWindowTicks;
    } else {
      rs.electrocuteHits++;
      if (rs.electrocuteHits >= 3) {
        rs.electrocuteHits = 0;
        rs.electrocuteTargetId = null;
        const cdSec = 20 - levelFrac * 5;
        rs.electrocuteReadyTick = w.tick + Math.round(cdSec * TICK_RATE);
        const bonusAd = Math.max(0, attacker.damage - 60);
        const burst = 50 + levelFrac * 140 + bonusAd * 0.4 + w.abilityPower(attacker) * 0.25;
        const dmgType = w.abilityPower(attacker) > bonusAd ? 'magic' : 'physical';
        w.damage(attacker, target, burst, dmgType, 'rune');
      }
    }
  }

  // Arcane Comet
  if (rs.loadout.keystone === 'comet' && isAbility) {
    if (w.tick >= rs.cometReadyTick) {
      const cdSec = 20 - levelFrac * 12;
      rs.cometReadyTick = w.tick + Math.round(cdSec * TICK_RATE);
      const bonusAd = Math.max(0, attacker.damage - 60);
      const cometDmg = 30 + levelFrac * 100 + w.abilityPower(attacker) * 0.2 + bonusAd * 0.35;
      w.activeComets ??= [];
      w.activeComets.push({
        id: w.nextId++,
        sourceId: attacker.id,
        team: attacker.team as Team,
        origin: { x: attacker.x, y: attacker.y },
        target: { x: target.x, y: target.y },
        launchTick: w.tick,
        impactTick: w.tick + RUNE_TIMING.cometFlightTicks,
        damage: cometDmg,
      });
    } else {
      const remaining = rs.cometReadyTick - w.tick;
      rs.cometReadyTick = w.tick + Math.floor(remaining * 0.8);
    }
  }

  // Grasp of the Undying
  if (rs.loadout.keystone === 'grasp' && isBasicAttack && rs.graspReady) {
    rs.graspReady = false;
    rs.graspCombatSinceTick = w.tick;
    const scale = melee ? 1.0 : 0.6;
    const bonusDmg = attacker.maxHp * 0.035 * scale;
    const heal = attacker.maxHp * 0.013 * scale;
    const permHp = melee ? 5 : 3;
    rs.graspPermanentHp += permHp;
    attacker.maxHp = statPrecision(attacker.maxHp + permHp);
    w.healUnit(attacker, heal + permHp);
    w.damage(attacker, target, bonusDmg, 'magic', 'rune');
  }
}

export function onRuneTakedown(w: World, participantId: number): void {
  const u = w.unit(participantId);
  const state = w.championState(participantId);
  const rs = state?.runeState;
  if (!u || !state || !rs) return;
  if (rs.loadout.secondary === 'triumph' && w.alive(u)) {
    const missing = Math.max(0, u.maxHp - u.hp);
    w.healUnit(u, missing * 0.05 + u.maxHp * 0.025);
    state.gold = statPrecision(state.gold + 20);
  }
  if (rs.loadout.secondary === 'alacrity') {
    rs.alacrityStacks = Math.min(10, rs.alacrityStacks + 2);
  }
  if (rs.loadout.secondary === 'transcendence' && state.level >= 11) {
    for (const slot of ['q', 'w', 'e'] as const) {
      const rem = state.cooldowns[slot] - w.tick;
      if (rem > 0) state.cooldowns[slot] = w.tick + Math.floor(rem * 0.8);
    }
  }
}

export function onRuneFarmKill(state: ChampionState): void {
  const rs = state.runeState;
  if (rs?.loadout.secondary === 'alacrity' && state.cs % 15 === 0) {
    rs.alacrityStacks = Math.min(10, rs.alacrityStacks + 1);
  }
}
