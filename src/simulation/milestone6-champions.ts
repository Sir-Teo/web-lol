import { DARIUS_KIT, EZREAL_KIT, MORGANA_KIT, VI_KIT } from '../content/milestone6-champions';
import { ABILITIES, TICK_RATE } from '../content/rules';
import { hastedCooldownTicks, totalAbilityHaste } from './ability-haste';
import { championBaseAd, championItemBonusAd } from './champion-stats';
import { consumeItemOnHitDamage, primeSpellbladeOnCast } from './item-effects';
import { direction, distance, segmentDistance, type Vec2 } from './math';
import { statPrecision } from './progression';
import { runeAdaptiveStats } from './runes';
import type { ChampionIdentity, ChampionState, Team, Unit } from './types';
import type { World } from './world';

export type Milestone6Champion = 'darius' | 'vi' | 'ezreal' | 'morgana';

export function isMilestone6Champion(
  champion: ChampionIdentity | undefined
): champion is Milestone6Champion {
  return (
    champion === 'darius' || champion === 'vi' || champion === 'ezreal' || champion === 'morgana'
  );
}

export interface DariusState {
  noxianMightUntil: number;
  qWindupEndTick: number | null;
  qRank: number;
  wEmpoweredUntil: number;
  wRank: number;
  rResetUntil: number;
}

export interface ViState {
  blastShieldReadyTick: number;
  qDash: {
    origin: Vec2;
    destination: Vec2;
    speed: number;
    rank: number;
    hitIds: number[];
  } | null;
  dentingTargetId: number | null;
  dentingStacks: number;
  dentingAsUntil: number;
  eEmpoweredUntil: number;
  eRank: number;
  rDash: {
    targetId: number;
    rank: number;
    speed: number;
    knockasideIds?: number[];
  } | null;
}

export interface EzrealState {
  risingStacks: number;
  risingUntil: number;
  rChannel: {
    endTick: number;
    direction: Vec2;
    rank: number;
  } | null;
}

export interface MorganaState {
  shackles: {
    endTick: number;
    rank: number;
    targetIds: number[];
  } | null;
}

export interface Milestone6Missile extends Vec2 {
  id: number;
  kind: 'ezreal-q' | 'ezreal-w' | 'ezreal-r' | 'morgana-q';
  sourceId: number;
  team: Team;
  previous: Vec2;
  direction: Vec2;
  speed: number;
  radius: number;
  remaining: number;
  rank: number;
  damage: number;
  hitIds: number[];
}

export interface MorganaPool extends Vec2 {
  id: number;
  sourceId: number;
  team: Team;
  radius: number;
  rank: number;
  startTick: number;
  endTick: number;
  nextTick: number;
}

export function initMilestone6ChampionState(
  champion: ChampionIdentity,
  state: ChampionState
): void {
  if (champion === 'darius') {
    state.darius = {
      noxianMightUntil: 0,
      qWindupEndTick: null,
      qRank: 1,
      wEmpoweredUntil: 0,
      wRank: 1,
      rResetUntil: 0,
    };
  } else if (champion === 'vi') {
    state.vi = {
      blastShieldReadyTick: 0,
      qDash: null,
      dentingTargetId: null,
      dentingStacks: 0,
      dentingAsUntil: 0,
      eEmpoweredUntil: 0,
      eRank: 1,
      rDash: null,
    };
  } else if (champion === 'ezreal') {
    state.ezreal = {
      risingStacks: 0,
      risingUntil: 0,
      rChannel: null,
    };
  } else if (champion === 'morgana') {
    state.morgana = {
      shackles: null,
    };
  }
}

const brokenBlackShieldAtTick = new WeakMap<Unit, number>();

export function markBlackShieldBrokenOnTick(unit: Unit, tick: number): void {
  brokenBlackShieldAtTick.set(unit, tick);
}

export function hasBlackShield(unit: Unit, tick: number): boolean {
  return (
    unit.shields.some((s) => s.blackShield && s.endTick > tick && s.amount > 0) ||
    brokenBlackShieldAtTick.get(unit) === tick
  );
}

export function isViUnstoppable(state: ChampionState | undefined): boolean {
  return !!state?.vi?.rDash;
}

export function milestone6AbilitySpec(
  w: World,
  champion: Milestone6Champion,
  ability: 'q' | 'w' | 'e' | 'r',
  championId: number
): typeof ABILITIES.d {
  const state = w.championState(championId);
  const rank = Math.max(1, state?.spellRanks[ability] ?? 1);
  if (champion === 'darius') {
    if (ability === 'q') {
      return {
        name: DARIUS_KIT.q.name,
        icon: DARIUS_KIT.q.icon,
        cost: DARIUS_KIT.q.manaByRank[rank - 1],
        cooldown: DARIUS_KIT.q.cooldownSecondsByRank[rank - 1],
        range: DARIUS_KIT.q.outerRadius,
        description: `Swing axe after 0.75s: outer blade (${DARIUS_KIT.q.innerRadius}–${DARIUS_KIT.q.outerRadius}) deals physical damage, applies Hemorrhage, and heals 15% missing HP per champion hit.`,
      };
    }
    if (ability === 'w') {
      return {
        name: DARIUS_KIT.w.name,
        icon: DARIUS_KIT.w.icon,
        cost: DARIUS_KIT.w.manaByRank[rank - 1],
        cooldown: DARIUS_KIT.w.cooldownSecondsByRank[rank - 1],
        range: 0,
        description: `Empower next basic attack to deal ${Math.round(DARIUS_KIT.w.totalAdMultiplierByRank[rank - 1] * 100)}% AD physical damage and slow by 90% for 1s. Refunds 50% CD & mana on kill.`,
      };
    }
    if (ability === 'e') {
      return {
        name: DARIUS_KIT.e.name,
        icon: DARIUS_KIT.e.icon,
        cost: DARIUS_KIT.e.manaByRank[rank - 1],
        cooldown: DARIUS_KIT.e.cooldownSecondsByRank[rank - 1],
        range: DARIUS_KIT.e.range,
        description: `Passive: +${Math.round(DARIUS_KIT.e.passiveArmorPenByRank[rank - 1] * 100)}% Armor Pen. Active: pull enemies in a ${DARIUS_KIT.e.range} cone and briefly stun/slow them.`,
      };
    }
    return {
      name: DARIUS_KIT.r.name,
      icon: DARIUS_KIT.r.icon,
      cost: (state?.darius?.rResetUntil ?? 0) > w.tick ? 0 : DARIUS_KIT.r.manaByRank[rank - 1],
      cooldown: DARIUS_KIT.r.cooldownSecondsByRank[rank - 1],
      range: DARIUS_KIT.r.range,
      cantCastWhileRooted: true,
      description: `Leap to an enemy champion to deal ${DARIUS_KIT.r.baseTrueDamageByRank[rank - 1]} (+75% bonus AD) true damage, increased by 20% per Hemorrhage stack. Resets on kill.`,
    };
  }

  if (champion === 'vi') {
    if (ability === 'q') {
      return {
        name: VI_KIT.q.name,
        icon: VI_KIT.q.icon,
        cost: VI_KIT.q.manaByRank[rank - 1],
        cooldown: VI_KIT.q.cooldownSecondsByRank[rank - 1],
        range: VI_KIT.q.dashRange,
        cantCastWhileRooted: true,
        description: `Dash up to ${VI_KIT.q.dashRange} units, dealing ${VI_KIT.q.baseDamageByRank[rank - 1]} (+140% bonus AD) physical damage, knocking back the first champion hit, and applying Denting Blows.`,
      };
    }
    if (ability === 'w') {
      return {
        name: VI_KIT.w.name,
        icon: VI_KIT.w.icon,
        cost: 0,
        cooldown: 0,
        range: 0,
        description: `Passive: Every 3rd hit on the same target deals ${Math.round(VI_KIT.w.maxHpDamageByRank[rank - 1] * 100)}% max HP physical damage, shreds 20% Armor, and grants +${Math.round(VI_KIT.w.bonusAttackSpeedByRank[rank - 1] * 100)}% Attack Speed.`,
      };
    }
    if (ability === 'e') {
      return {
        name: VI_KIT.e.name,
        icon: VI_KIT.e.icon,
        cost: VI_KIT.e.manaByRank[rank - 1],
        cooldown: VI_KIT.e.cooldownSecondsByRank[rank - 1],
        range: 0,
        description: `Empower next basic attack (+50 range, resets swing) to blast a ${VI_KIT.e.coneLength}-unit shockwave cone behind the target.`,
      };
    }
    return {
      name: VI_KIT.r.name,
      icon: VI_KIT.r.icon,
      cost: VI_KIT.r.manaByRank[rank - 1],
      cooldown: VI_KIT.r.cooldownSecondsByRank[rank - 1],
      range: VI_KIT.r.range,
      cantCastWhileRooted: true,
      description: `Unstoppable charge onto an enemy champion, knocking up/stunning for 1.3s and dealing ${VI_KIT.r.baseDamageByRank[rank - 1]} (+90% bonus AD) physical damage.`,
    };
  }

  if (champion === 'ezreal') {
    if (ability === 'q') {
      return {
        name: EZREAL_KIT.q.name,
        icon: EZREAL_KIT.q.icon,
        cost: EZREAL_KIT.q.manaByRank[rank - 1],
        cooldown: EZREAL_KIT.q.cooldownSecondsByRank[rank - 1],
        range: EZREAL_KIT.q.range,
        description: `Fire an energy bolt (${EZREAL_KIT.q.range} range) dealing ${EZREAL_KIT.q.baseDamageByRank[rank - 1]} (+130% AD, +15% AP) physical damage, applying on-hits, and refunding 1.5s off all cooldowns.`,
      };
    }
    if (ability === 'w') {
      return {
        name: EZREAL_KIT.w.name,
        icon: EZREAL_KIT.w.icon,
        cost: EZREAL_KIT.w.manaByRank[rank - 1],
        cooldown: EZREAL_KIT.w.cooldownSecondsByRank[rank - 1],
        range: EZREAL_KIT.w.range,
        description: `Fire a ring that marks the first enemy champion, epic monster, or structure for 4s. Next attack or spell detonates it for ${EZREAL_KIT.w.baseDamageByRank[rank - 1]} (+60% bonus AD, +75% AP) magic damage + mana refund.`,
      };
    }
    if (ability === 'e') {
      return {
        name: EZREAL_KIT.e.name,
        icon: EZREAL_KIT.e.icon,
        cost: EZREAL_KIT.e.manaByRank[rank - 1],
        cooldown: EZREAL_KIT.e.cooldownSecondsByRank[rank - 1],
        range: EZREAL_KIT.e.blinkRange,
        cantCastWhileRooted: true,
        description: `Blink up to ${EZREAL_KIT.e.blinkRange} units and fire a homing bolt (${EZREAL_KIT.e.baseDamageByRank[rank - 1]} +50% bonus AD +75% AP magic damage) prioritizing Essence Flux targets.`,
      };
    }
    return {
      name: EZREAL_KIT.r.name,
      icon: EZREAL_KIT.r.icon,
      cost: EZREAL_KIT.r.manaByRank[rank - 1],
      cooldown: EZREAL_KIT.r.cooldownSecondsByRank[rank - 1],
      range: EZREAL_KIT.r.range,
      minimapTargeting: true,
      description: `Channel 1.0s to fire a global energy barrage across the Rift dealing ${EZREAL_KIT.r.baseDamageByRank[rank - 1]} (+100% bonus AD, +90% AP) magic damage (50% to minions/non-epic monsters).`,
    };
  }

  // Morgana
  if (ability === 'q') {
    return {
      name: MORGANA_KIT.q.name,
      icon: MORGANA_KIT.q.icon,
      cost: MORGANA_KIT.q.manaByRank[rank - 1],
      cooldown: MORGANA_KIT.q.cooldownSecondsByRank[rank - 1],
      range: MORGANA_KIT.q.range,
      description: `Launch dark energy (${MORGANA_KIT.q.range} range) rooting the first enemy hit for ${MORGANA_KIT.q.rootSecondsByRank[rank - 1]}s and dealing ${MORGANA_KIT.q.baseDamageByRank[rank - 1]} (+90% AP) magic damage.`,
    };
  }
  if (ability === 'w') {
    return {
      name: MORGANA_KIT.w.name,
      icon: MORGANA_KIT.w.icon,
      cost: MORGANA_KIT.w.manaByRank[rank - 1],
      cooldown: MORGANA_KIT.w.cooldownSecondsByRank[rank - 1],
      range: MORGANA_KIT.w.range,
      description: `Curse a ${MORGANA_KIT.w.radius}-radius area for 5s, dealing ${MORGANA_KIT.w.dpsByRank[rank - 1]} (+17% AP)/s magic damage increased up to +170% based on missing HP. Soul Siphon refunds 5% CD.`,
    };
  }
  if (ability === 'e') {
    return {
      name: MORGANA_KIT.e.name,
      icon: MORGANA_KIT.e.icon,
      cost: MORGANA_KIT.e.manaByRank[rank - 1],
      cooldown: MORGANA_KIT.e.cooldownSecondsByRank[rank - 1],
      range: MORGANA_KIT.e.range,
      description: `Shield yourself or an allied champion for ${MORGANA_KIT.e.baseShieldByRank[rank - 1]} (+70% AP) magic damage for 5s, blocking all disabling Crowd Control while active.`,
    };
  }
  return {
    name: MORGANA_KIT.r.name,
    icon: MORGANA_KIT.r.icon,
    cost: MORGANA_KIT.r.manaByRank[rank - 1],
    cooldown: MORGANA_KIT.r.cooldownSecondsByRank[rank - 1],
    range: MORGANA_KIT.r.tetherRadius,
    description: `Chain nearby enemy champions (${MORGANA_KIT.r.tetherRadius} radius), dealing ${MORGANA_KIT.r.baseDamageByRank[rank - 1]} (+80% AP) magic damage, slowing by 20%, and stunning for 1.5s after 3s.`,
  };
}

export function milestone6BaseResources(
  w: World,
  champion: Milestone6Champion,
  ability: 'q' | 'w' | 'e' | 'r',
  championId: number
): { mana: number; cooldownSeconds: number } {
  const rank = w.abilityRank(ability, championId);
  if (!rank) {
    const spec = milestone6AbilitySpec(w, champion, ability, championId);
    return { mana: spec.cost, cooldownSeconds: spec.cooldown };
  }
  const spec = milestone6AbilitySpec(w, champion, ability, championId);
  return { mana: spec.cost, cooldownSeconds: spec.cooldown };
}

function m6BonusAd(w: World, u: Unit, state: ChampionState): number {
  return championItemBonusAd(u, state) + runeAdaptiveStats(w, u, state).bonusAd;
}

function dariusBonusAd(w: World, u: Unit, state: ChampionState): number {
  return m6BonusAd(w, u, state) + dariusNoxianMightBonusAd(w, state);
}

export function dariusNoxianMightBonusAd(w: World, state: ChampionState): number {
  if (!state.darius || state.darius.noxianMightUntil <= w.tick) return 0;
  return (
    DARIUS_KIT.passive.noxianMightBonusAdBase +
    (state.level - 1) * DARIUS_KIT.passive.noxianMightBonusAdPerLevel
  );
}

export function dariusPassiveArmorPen(state: ChampionState): number {
  const r = state.spellRanks.e;
  return r > 0 ? DARIUS_KIT.e.passiveArmorPenByRank[r - 1] : 0;
}

export function milestone6BonusAttackSpeed(w: World, state: ChampionState): number {
  let bonus = 0;
  if (state.vi && state.vi.dentingAsUntil > w.tick && state.spellRanks.w > 0) {
    bonus += VI_KIT.w.bonusAttackSpeedByRank[state.spellRanks.w - 1];
  }
  if (state.ezreal && state.ezreal.risingUntil > w.tick && state.ezreal.risingStacks > 0) {
    bonus += state.ezreal.risingStacks * EZREAL_KIT.passive.attackSpeedPerStack;
  }
  return bonus;
}

function grantEzrealRisingStack(w: World, state: ChampionState, count = 1): void {
  if (!state.ezreal) return;
  if (state.ezreal.risingUntil <= w.tick) state.ezreal.risingStacks = 0;
  state.ezreal.risingStacks = Math.min(
    EZREAL_KIT.passive.maxStacks,
    state.ezreal.risingStacks + count
  );
  state.ezreal.risingUntil = w.tick + EZREAL_KIT.passive.durationTicks;
}

function triggerViBlastShield(w: World, u: Unit, state: ChampionState): void {
  const vs = state.vi;
  if (!vs || w.tick < vs.blastShieldReadyTick || !w.alive(u)) return;
  const cdTicks = hastedCooldownTicks(
    VI_KIT.passive.baseCooldownSeconds,
    totalAbilityHaste(state, w.tick)
  );
  vs.blastShieldReadyTick = w.tick + cdTicks;
  u.shields.push({
    sourceId: u.id,
    amount: Math.round(u.maxHp * VI_KIT.passive.maxHpShieldFraction),
    endTick: w.tick + VI_KIT.passive.durationTicks,
  });
}

export function applyDariusHemorrhage(
  w: World,
  darius: Unit,
  dariusState: ChampionState,
  target: Unit,
  stacksToAdd = 1
): void {
  if (
    !w.alive(target) ||
    target.kind === 'ward' ||
    target.kind === 'turret' ||
    target.kind === 'inhibitor' ||
    target.kind === 'nexus'
  )
    return;
  const mightActive = (dariusState.darius?.noxianMightUntil ?? 0) > w.tick;
  const prev =
    target.hemorrhage &&
    target.hemorrhage.endTick > w.tick &&
    target.hemorrhage.sourceId === darius.id
      ? target.hemorrhage.stacks
      : 0;
  const nextStacks = mightActive
    ? DARIUS_KIT.passive.maxStacks
    : Math.min(DARIUS_KIT.passive.maxStacks, prev + stacksToAdd);
  target.hemorrhage = {
    sourceId: darius.id,
    stacks: nextStacks,
    endTick: w.tick + DARIUS_KIT.passive.durationTicks,
    nextTick:
      target.hemorrhage && target.hemorrhage.endTick > w.tick
        ? target.hemorrhage.nextTick
        : w.tick + TICK_RATE,
  };
  if (
    nextStacks >= DARIUS_KIT.passive.maxStacks &&
    target.kind === 'champion' &&
    dariusState.darius
  ) {
    dariusState.darius.noxianMightUntil = w.tick + DARIUS_KIT.passive.durationTicks;
    w.emit('message', darius, { text: 'Noxian Might!', unit: darius.id, team: darius.team });
  }
}

export function applyViDentingHit(w: World, vi: Unit, viState: ChampionState, target: Unit): void {
  const vs = viState.vi;
  const rank = viState.spellRanks.w;
  if (
    !vs ||
    rank <= 0 ||
    !w.alive(target) ||
    target.kind === 'ward' ||
    target.kind === 'turret' ||
    target.kind === 'inhibitor' ||
    target.kind === 'nexus'
  )
    return;
  if (vs.dentingTargetId === target.id) vs.dentingStacks++;
  else {
    vs.dentingTargetId = target.id;
    vs.dentingStacks = 1;
  }
  if (vs.dentingStacks >= 3) {
    vs.dentingStacks = 0;
    vs.dentingAsUntil = w.tick + VI_KIT.w.shredDurationTicks;
    if (vs.blastShieldReadyTick > w.tick) {
      vs.blastShieldReadyTick = Math.max(
        w.tick,
        vs.blastShieldReadyTick - VI_KIT.passive.dentingRefundTicks
      );
    }
    target.viArmorShredUntil = w.tick + VI_KIT.w.shredDurationTicks;
    const bonusAd = m6BonusAd(w, vi, viState);
    const pct =
      VI_KIT.w.maxHpDamageByRank[rank - 1] + (bonusAd / 100) * VI_KIT.w.bonusAdMaxHpPer100;
    const raw = target.maxHp * pct;
    const dmg = target.kind === 'monster' ? Math.min(VI_KIT.w.monsterDamageCap, raw) : raw;
    w.damage(vi, target, dmg, 'physical', 'ability');
  }
}

export function detonateEzrealFlux(
  w: World,
  ezreal: Unit,
  ezState: ChampionState,
  target: Unit
): void {
  const flux = target.essenceFlux;
  if (!flux || flux.sourceId !== ezreal.id || flux.endTick <= w.tick) return;
  target.essenceFlux = undefined;
  const rank = Math.max(1, flux.rank);
  const bonusAd = m6BonusAd(w, ezreal, ezState);
  const dmg =
    EZREAL_KIT.w.baseDamageByRank[rank - 1] +
    bonusAd * EZREAL_KIT.w.bonusAdRatio +
    w.abilityPower(ezreal) * EZREAL_KIT.w.apRatio;
  const refund = EZREAL_KIT.w.manaByRank[rank - 1] + EZREAL_KIT.w.manaRefundBonus;
  ezreal.mana = Math.min(ezreal.maxMana, statPrecision(ezreal.mana + refund));
  grantEzrealRisingStack(w, ezState, 1);
  w.damage(ezreal, target, dmg, 'magic', 'ability');
}

export function applyMorganaSoulSiphon(
  w: World,
  morgana: Unit,
  morgState: ChampionState,
  target: Unit,
  dealt: number
): void {
  if (dealt <= 0 || !w.alive(morgana)) return;
  const eligible =
    target.kind === 'champion' ||
    target.kind === 'siege' ||
    target.kind === 'super' ||
    (target.kind === 'monster' &&
      target.monster.species !== 'raptor-mini' &&
      target.monster.species !== 'wolf-mini' &&
      target.monster.species !== 'krug-mini');
  if (!eligible) return;
  w.healUnit(morgana, dealt * MORGANA_KIT.passive.spellVampFraction);
  if (morgState.cooldowns.w > w.tick) {
    const baseCd = hastedCooldownTicks(
      MORGANA_KIT.w.cooldownSecondsByRank[Math.max(0, morgState.spellRanks.w - 1)],
      totalAbilityHaste(morgState, w.tick)
    );
    morgState.cooldowns.w = Math.max(
      w.tick,
      morgState.cooldowns.w - Math.round(baseCd * MORGANA_KIT.w.siphonCooldownRefundFraction)
    );
  }
}

export function onMilestone6BasicAttackLanded(
  w: World,
  attacker: Unit,
  state: ChampionState,
  target: Unit
): number {
  let extraPhysical = 0;
  if (attacker.champion === 'darius') {
    applyDariusHemorrhage(w, attacker, state, target, 1);
    if (state.darius && state.darius.wEmpoweredUntil > w.tick) {
      const rank = state.darius.wRank;
      state.darius.wEmpoweredUntil = 0;
      const totalAd = attacker.damage + dariusNoxianMightBonusAd(w, state);
      extraPhysical += totalAd * (DARIUS_KIT.w.totalAdMultiplierByRank[rank - 1] - 1);
      w.applyExtraSlow(attacker, target, 'crippling-strike');
      // Check post-hit refund if target is low enough to die from this strike
      target.dariusWRefundPending = { casterId: attacker.id, tick: w.tick, rank };
    }
  } else if (attacker.champion === 'vi') {
    applyViDentingHit(w, attacker, state, target);
    if (state.vi && state.vi.eEmpoweredUntil > w.tick) {
      const rank = state.vi.eRank;
      state.vi.eEmpoweredUntil = 0;
      triggerViBlastShield(w, attacker, state);
      const coneDmg =
        VI_KIT.e.baseDamageByRank[rank - 1] +
        attacker.damage * (VI_KIT.e.totalAdRatio - 1) +
        w.abilityPower(attacker) * VI_KIT.e.apRatio;
      extraPhysical += coneDmg;
      const dir = direction(attacker, target);
      for (const foe of w.units) {
        if (
          foe.id === target.id ||
          foe.team === attacker.team ||
          foe.kind === 'ward' ||
          !w.targetable(foe) ||
          foe.kind === 'turret' ||
          foe.kind === 'inhibitor' ||
          foe.kind === 'nexus'
        )
          continue;
        const d = distance(attacker, foe);
        if (d > VI_KIT.e.coneLength + foe.radius) continue;
        const toFoe = direction(attacker, foe);
        const cos = dir.x * toFoe.x + dir.y * toFoe.y;
        if (cos >= Math.cos(VI_KIT.e.coneHalfRadians)) {
          w.damage(
            attacker,
            foe,
            VI_KIT.e.baseDamageByRank[rank - 1] +
              attacker.damage * VI_KIT.e.totalAdRatio +
              w.abilityPower(attacker) * VI_KIT.e.apRatio,
            'physical',
            'ability'
          );
        }
      }
    }
  } else if (attacker.champion === 'ezreal') {
    detonateEzrealFlux(w, attacker, state, target);
  }
  return extraPhysical;
}

export function castMilestone6Ability(
  w: World,
  u: Unit,
  state: ChampionState,
  ability: 'q' | 'w' | 'e' | 'r',
  point: Vec2,
  targetId?: number
): boolean {
  const champ = u.champion;
  if (!isMilestone6Champion(champ)) return false;
  const rank = state.spellRanks[ability];
  if (rank < 1) {
    w.emit('message', u, { text: 'Learn this spell before casting', unit: u.id, team: u.team });
    return true;
  }
  if (champ === 'vi' && ability === 'w') {
    w.emit('message', u, { text: 'Denting Blows is a passive ability', unit: u.id, team: u.team });
    return true;
  }
  const spec = milestone6AbilitySpec(w, champ, ability, u.id);
  if (spec.cantCastWhileRooted && u.rootUntil > w.tick) {
    w.emit('message', u, { text: 'Cannot cast while rooted', unit: u.id, team: u.team });
    return true;
  }
  if (u.silenceUntil > w.tick) return true;
  if (state.cooldowns[ability] > w.tick) return true;
  if (u.mana < spec.cost) return true;

  const haste = totalAbilityHaste(state, w.tick);
  const startCd = (seconds: number) => {
    state.cooldowns[ability] = w.tick + hastedCooldownTicks(seconds, haste);
  };
  const spendMana = () => {
    u.mana = Math.max(0, statPrecision(u.mana - spec.cost));
  };

  // --- DARIUS ---
  if (champ === 'darius') {
    const ds = state.darius!;
    if (ability === 'q') {
      if (ds.qWindupEndTick !== null && ds.qWindupEndTick > w.tick) return true;
      spendMana();
      startCd(spec.cooldown);
      ds.qWindupEndTick = w.tick + DARIUS_KIT.q.windupTicks;
      ds.qRank = rank;
      primeSpellbladeOnCast(w, state);
      w.startCastAnimation(state, 'q');
      w.emit('cast', u, { unit: u.id, team: u.team, champion: 'darius', text: 'q' });
      return true;
    }
    if (ability === 'w') {
      spendMana();
      startCd(spec.cooldown);
      ds.wEmpoweredUntil = w.tick + DARIUS_KIT.w.buffDurationTicks;
      ds.wRank = rank;
      u.releaseTick = null;
      u.attackCycle = null;
      u.nextAttackTick = w.tick;
      primeSpellbladeOnCast(w, state);
      w.emit('cast', u, { unit: u.id, team: u.team, champion: 'darius', text: 'w' });
      return true;
    }
    if (ability === 'e') {
      spendMana();
      startCd(spec.cooldown);
      const aimDir =
        distance(u, point) > 1
          ? direction(u, point)
          : { x: Math.sin(u.facing), y: Math.cos(u.facing) };
      u.facing = Math.atan2(aimDir.x, aimDir.y);
      for (const foe of w.units) {
        if (
          foe.team === u.team ||
          foe.kind === 'ward' ||
          !w.targetable(foe) ||
          foe.kind === 'turret' ||
          foe.kind === 'inhibitor' ||
          foe.kind === 'nexus'
        )
          continue;
        const dist = distance(u, foe);
        if (dist > DARIUS_KIT.e.range + foe.radius) continue;
        const toFoe = direction(u, foe);
        if (aimDir.x * toFoe.x + aimDir.y * toFoe.y < Math.cos(DARIUS_KIT.e.coneHalfRadians))
          continue;
        if (
          !hasBlackShield(foe, w.tick) &&
          foe.monster?.species !== 'baron' &&
          !isViUnstoppable(w.championState(foe.id))
        ) {
          const pullPos = w.battlefield.reachable(
            {
              x: u.x + aimDir.x * DARIUS_KIT.e.pullDistanceToCaster,
              y: u.y + aimDir.y * DARIUS_KIT.e.pullDistanceToCaster,
            },
            foe.radius,
            foe.team === 'neutral' ? undefined : foe.team
          );
          foe.x = pullPos.x;
          foe.y = pullPos.y;
          w.invalidateSpatialGrid();
          foe.stunUntil = Math.max(foe.stunUntil, w.tick + DARIUS_KIT.e.stunTicks);
          w.applyExtraSlow(u, foe, 'apprehend');
        }
      }
      primeSpellbladeOnCast(w, state);
      w.startCastAnimation(state, 'e');
      w.emit('cast', u, { unit: u.id, team: u.team, champion: 'darius', text: 'e' });
      return true;
    }
    if (ability === 'r') {
      const target = findEnemyChampionTarget(w, u, point, targetId, DARIUS_KIT.r.range);
      if (!target) {
        w.emit('message', u, {
          text: 'Choose an enemy champion in range',
          unit: u.id,
          team: u.team,
        });
        return true;
      }
      spendMana();
      startCd(spec.cooldown);
      ds.rResetUntil = 0;
      const land = w.battlefield.reachable(
        {
          x: target.x - direction(u, target).x * 110,
          y: target.y - direction(u, target).y * 110,
        },
        u.radius,
        u.team as Team
      );
      u.x = land.x;
      u.y = land.y;
      u.facing = Math.atan2(target.x - u.x, target.y - u.y);
      const stacks =
        target.hemorrhage && target.hemorrhage.endTick > w.tick ? target.hemorrhage.stacks : 0;
      const baseTrue =
        DARIUS_KIT.r.baseTrueDamageByRank[rank - 1] +
        dariusBonusAd(w, u, state) * DARIUS_KIT.r.bonusAdRatio;
      const totalTrue = baseTrue * (1 + stacks * DARIUS_KIT.r.perStackMultiplier);
      primeSpellbladeOnCast(w, state);
      w.startCastAnimation(state, 'r');
      w.emit('cast', u, { unit: u.id, team: u.team, champion: 'darius', text: 'r' });
      w.onChampionUltimateCast(u);
      w.damage(u, target, totalTrue, 'true', 'ability');
      if (!w.alive(target)) {
        ds.noxianMightUntil = w.tick + DARIUS_KIT.passive.durationTicks;
        if (rank >= 3) {
          state.cooldowns.r = w.tick;
        } else {
          state.cooldowns.r = w.tick;
          ds.rResetUntil = w.tick + DARIUS_KIT.r.resetWindowTicks;
        }
        w.emit('message', u, { text: 'Noxian Guillotine reset!', unit: u.id, team: u.team });
      }
      return true;
    }
  }

  // --- VI ---
  if (champ === 'vi') {
    const vs = state.vi!;
    if (ability === 'q') {
      spendMana();
      startCd(spec.cooldown);
      const dir =
        distance(u, point) > 1
          ? direction(u, point)
          : { x: Math.sin(u.facing), y: Math.cos(u.facing) };
      const dist = Math.min(VI_KIT.q.dashRange, Math.max(120, distance(u, point)));
      const dest = w.battlefield.reachable(
        { x: u.x + dir.x * dist, y: u.y + dir.y * dist },
        u.radius,
        u.team as Team
      );
      u.facing = Math.atan2(dir.x, dir.y);
      vs.qDash = {
        origin: { x: u.x, y: u.y },
        destination: dest,
        speed: VI_KIT.q.dashSpeed,
        rank,
        hitIds: [],
      };
      primeSpellbladeOnCast(w, state);
      w.startCastAnimation(state, 'q');
      w.emit('cast', u, { unit: u.id, team: u.team, champion: 'vi', text: 'q' });
      return true;
    }
    if (ability === 'e') {
      spendMana();
      startCd(spec.cooldown);
      vs.eEmpoweredUntil = w.tick + VI_KIT.e.buffDurationTicks;
      vs.eRank = rank;
      u.releaseTick = null;
      u.attackCycle = null;
      u.nextAttackTick = w.tick;
      primeSpellbladeOnCast(w, state);
      w.emit('cast', u, { unit: u.id, team: u.team, champion: 'vi', text: 'e' });
      return true;
    }
    if (ability === 'r') {
      const target = findEnemyChampionTarget(w, u, point, targetId, VI_KIT.r.range);
      if (!target) {
        w.emit('message', u, {
          text: 'Choose an enemy champion in range',
          unit: u.id,
          team: u.team,
        });
        return true;
      }
      spendMana();
      startCd(spec.cooldown);
      vs.rDash = {
        targetId: target.id,
        rank,
        speed: VI_KIT.r.dashSpeed,
        knockasideIds: [],
      };
      primeSpellbladeOnCast(w, state);
      w.startCastAnimation(state, 'r');
      w.emit('cast', u, { unit: u.id, team: u.team, champion: 'vi', text: 'r' });
      w.onChampionUltimateCast(u);
      return true;
    }
  }

  // --- EZREAL ---
  if (champ === 'ezreal') {
    const ez = state.ezreal!;
    const dir =
      distance(u, point) > 1
        ? direction(u, point)
        : { x: Math.sin(u.facing), y: Math.cos(u.facing) };
    u.facing = Math.atan2(dir.x, dir.y);
    if (ability === 'q') {
      spendMana();
      startCd(spec.cooldown);
      primeSpellbladeOnCast(w, state);
      const dmg =
        EZREAL_KIT.q.baseDamageByRank[rank - 1] +
        u.damage * EZREAL_KIT.q.totalAdRatio +
        w.abilityPower(u) * EZREAL_KIT.q.apRatio;
      w.m6Missiles ??= [];
      w.m6Missiles.push({
        id: w.nextId++,
        kind: 'ezreal-q',
        sourceId: u.id,
        team: u.team as Team,
        x: u.x,
        y: u.y,
        previous: { x: u.x, y: u.y },
        direction: dir,
        speed: EZREAL_KIT.q.speed,
        radius: EZREAL_KIT.q.radius,
        remaining: EZREAL_KIT.q.range,
        rank,
        damage: dmg,
        hitIds: [],
      });
      w.startCastAnimation(state, 'q');
      w.emit('cast', u, { unit: u.id, team: u.team, champion: 'ezreal', text: 'q' });
      return true;
    }
    if (ability === 'w') {
      spendMana();
      startCd(spec.cooldown);
      primeSpellbladeOnCast(w, state);
      w.m6Missiles ??= [];
      w.m6Missiles.push({
        id: w.nextId++,
        kind: 'ezreal-w',
        sourceId: u.id,
        team: u.team as Team,
        x: u.x,
        y: u.y,
        previous: { x: u.x, y: u.y },
        direction: dir,
        speed: EZREAL_KIT.w.speed,
        radius: EZREAL_KIT.w.radius,
        remaining: EZREAL_KIT.w.range,
        rank,
        damage: 0,
        hitIds: [],
      });
      w.startCastAnimation(state, 'w');
      w.emit('cast', u, { unit: u.id, team: u.team, champion: 'ezreal', text: 'w' });
      return true;
    }
    if (ability === 'e') {
      spendMana();
      startCd(spec.cooldown);
      const blinkDist = Math.min(EZREAL_KIT.e.blinkRange, distance(u, point));
      const dest = w.battlefield.reachable(
        { x: u.x + dir.x * blinkDist, y: u.y + dir.y * blinkDist },
        u.radius,
        u.team as Team
      );
      u.x = dest.x;
      u.y = dest.y;
      u.previous = { x: dest.x, y: dest.y };
      w.setOrder(u, { type: 'idle' });
      primeSpellbladeOnCast(w, state);
      // Homing bolt to nearest visible enemy within 750 (prioritize Essence Flux!)
      const candidates = w.units.filter(
        (foe) =>
          foe.team !== u.team &&
          foe.kind !== 'ward' &&
          w.targetable(foe) &&
          !(foe.kind === 'turret' || foe.kind === 'inhibitor' || foe.kind === 'nexus') &&
          w.visible(foe, u.team) &&
          distance(u, foe) <= EZREAL_KIT.e.boltRange
      );
      candidates.sort((a, b) => {
        const aFlux =
          a.essenceFlux && a.essenceFlux.sourceId === u.id && a.essenceFlux.endTick > w.tick
            ? 0
            : 1;
        const bFlux =
          b.essenceFlux && b.essenceFlux.sourceId === u.id && b.essenceFlux.endTick > w.tick
            ? 0
            : 1;
        if (aFlux !== bFlux) return aFlux - bFlux;
        return distance(u, a) - distance(u, b);
      });
      if (candidates[0]) {
        const hitTarget = candidates[0];
        const bonusAd = m6BonusAd(w, u, state);
        const boltDmg =
          EZREAL_KIT.e.baseDamageByRank[rank - 1] +
          bonusAd * EZREAL_KIT.e.bonusAdRatio +
          w.abilityPower(u) * EZREAL_KIT.e.apRatio;
        grantEzrealRisingStack(w, state, 1);
        detonateEzrealFlux(w, u, state, hitTarget);
        w.damage(u, hitTarget, boltDmg, 'magic', 'ability');
      }
      w.startCastAnimation(state, 'e');
      w.emit('cast', u, { unit: u.id, team: u.team, champion: 'ezreal', text: 'e' });
      return true;
    }
    if (ability === 'r') {
      spendMana();
      startCd(spec.cooldown);
      w.setOrder(u, { type: 'idle' });
      ez.rChannel = {
        endTick: w.tick + EZREAL_KIT.r.windupTicks,
        direction: dir,
        rank,
      };
      primeSpellbladeOnCast(w, state);
      w.startCastAnimation(state, 'r');
      w.emit('cast', u, { unit: u.id, team: u.team, champion: 'ezreal', text: 'r' });
      w.onChampionUltimateCast(u);
      return true;
    }
  }

  // --- MORGANA ---
  if (champ === 'morgana') {
    const ms = state.morgana!;
    if (ability === 'q') {
      spendMana();
      startCd(spec.cooldown);
      const dir =
        distance(u, point) > 1
          ? direction(u, point)
          : { x: Math.sin(u.facing), y: Math.cos(u.facing) };
      u.facing = Math.atan2(dir.x, dir.y);
      const dmg =
        MORGANA_KIT.q.baseDamageByRank[rank - 1] + w.abilityPower(u) * MORGANA_KIT.q.apRatio;
      w.m6Missiles ??= [];
      w.m6Missiles.push({
        id: w.nextId++,
        kind: 'morgana-q',
        sourceId: u.id,
        team: u.team as Team,
        x: u.x,
        y: u.y,
        previous: { x: u.x, y: u.y },
        direction: dir,
        speed: MORGANA_KIT.q.speed,
        radius: MORGANA_KIT.q.radius,
        remaining: MORGANA_KIT.q.range,
        rank,
        damage: dmg,
        hitIds: [],
      });
      primeSpellbladeOnCast(w, state);
      w.startCastAnimation(state, 'q');
      w.emit('cast', u, { unit: u.id, team: u.team, champion: 'morgana', text: 'q' });
      return true;
    }
    if (ability === 'w') {
      spendMana();
      startCd(spec.cooldown);
      const dist = Math.min(MORGANA_KIT.w.range, distance(u, point));
      const dir =
        distance(u, point) > 1
          ? direction(u, point)
          : { x: Math.sin(u.facing), y: Math.cos(u.facing) };
      const center = { x: u.x + dir.x * dist, y: u.y + dir.y * dist };
      w.morganaPools ??= [];
      w.morganaPools.push({
        id: w.nextId++,
        sourceId: u.id,
        team: u.team as Team,
        x: center.x,
        y: center.y,
        radius: MORGANA_KIT.w.radius,
        rank,
        startTick: w.tick,
        endTick: w.tick + MORGANA_KIT.w.durationTicks,
        nextTick: w.tick + 1,
      });
      primeSpellbladeOnCast(w, state);
      w.startCastAnimation(state, 'w');
      w.emit('cast', u, { unit: u.id, team: u.team, champion: 'morgana', text: 'w' });
      return true;
    }
    if (ability === 'e') {
      const ally = findFriendlyChampionTarget(w, u, point, targetId, MORGANA_KIT.e.range);
      spendMana();
      startCd(spec.cooldown);
      const shieldAmount = Math.round(
        MORGANA_KIT.e.baseShieldByRank[rank - 1] + w.abilityPower(u) * MORGANA_KIT.e.apRatio
      );
      ally.shields.push({
        sourceId: u.id,
        amount: shieldAmount,
        endTick: w.tick + MORGANA_KIT.e.durationTicks,
        blackShield: true,
      });
      primeSpellbladeOnCast(w, state);
      w.startCastAnimation(state, 'e');
      w.emit('cast', u, { unit: u.id, team: u.team, champion: 'morgana', text: 'e' });
      return true;
    }
    if (ability === 'r') {
      const targets = w.units.filter(
        (foe) =>
          foe.kind === 'champion' &&
          foe.team !== u.team &&
          w.targetable(foe) &&
          w.visible(foe, u.team) &&
          distance(u, foe) <= MORGANA_KIT.r.tetherRadius
      );
      if (!targets.length) {
        w.emit('message', u, {
          text: 'No enemy champions nearby to tether',
          unit: u.id,
          team: u.team,
        });
        return true;
      }
      spendMana();
      startCd(spec.cooldown);
      const initDmg =
        MORGANA_KIT.r.baseDamageByRank[rank - 1] + w.abilityPower(u) * MORGANA_KIT.r.apRatio;
      const tetheredIds: number[] = [];
      for (const foe of targets) {
        tetheredIds.push(foe.id);
        const beforeHp = foe.hp;
        w.damage(u, foe, initDmg, 'magic', 'ability');
        applyMorganaSoulSiphon(w, u, state, foe, Math.max(0, beforeHp - foe.hp));
        w.applyExtraSlow(u, foe, 'soul-shackles');
      }
      ms.shackles = {
        endTick: w.tick + MORGANA_KIT.r.durationTicks,
        rank,
        targetIds: tetheredIds,
      };
      primeSpellbladeOnCast(w, state);
      w.startCastAnimation(state, 'r');
      w.emit('cast', u, { unit: u.id, team: u.team, champion: 'morgana', text: 'r' });
      w.onChampionUltimateCast(u);
      return true;
    }
  }

  return true;
}

function findEnemyChampionTarget(
  w: World,
  caster: Unit,
  point: Vec2,
  targetId: number | undefined,
  maxRange: number
): Unit | null {
  if (targetId !== undefined) {
    const t = w.unit(targetId);
    if (
      t &&
      t.kind === 'champion' &&
      t.team !== caster.team &&
      w.targetable(t) &&
      w.visible(t, caster.team) &&
      distance(caster, t) <= maxRange + t.radius
    )
      return t;
  }
  const candidates = w.units.filter(
    (t) =>
      t.kind === 'champion' &&
      t.team !== caster.team &&
      w.targetable(t) &&
      w.visible(t, caster.team) &&
      distance(caster, t) <= maxRange + t.radius &&
      distance(point, t) <= 220
  );
  candidates.sort((a, b) => distance(point, a) - distance(point, b) || a.id - b.id);
  return candidates[0] ?? null;
}

function findFriendlyChampionTarget(
  w: World,
  caster: Unit,
  point: Vec2,
  targetId: number | undefined,
  maxRange: number
): Unit {
  if (targetId !== undefined) {
    const t = w.unit(targetId);
    if (
      t &&
      t.kind === 'champion' &&
      t.team === caster.team &&
      w.alive(t) &&
      distance(caster, t) <= maxRange + t.radius
    )
      return t;
  }
  const allies = w.units.filter(
    (t) =>
      t.kind === 'champion' &&
      t.team === caster.team &&
      w.alive(t) &&
      distance(caster, t) <= maxRange + t.radius &&
      distance(point, t) <= 200
  );
  allies.sort((a, b) => distance(point, a) - distance(point, b) || a.id - b.id);
  return allies[0] ?? caster;
}

export function advanceMilestone6Champions(w: World): void {
  // 1. Hemorrhage bleed & Darius W kill-refund cleanup
  for (const u of w.units) {
    if (u.dariusWRefundPending && u.dariusWRefundPending.tick < w.tick) {
      u.dariusWRefundPending = undefined;
    }
    if (u.hemorrhage) {
      if (!w.alive(u) || w.winner || u.hemorrhage.endTick < w.tick) {
        u.hemorrhage = undefined;
      } else if (w.tick >= u.hemorrhage.nextTick) {
        u.hemorrhage.nextTick += TICK_RATE;
        const owner = w.unit(u.hemorrhage.sourceId);
        const st = owner ? w.championState(owner.id) : undefined;
        if (owner && st) {
          const per5 =
            DARIUS_KIT.passive.bleedBasePer5s +
            (st.level - 1) * DARIUS_KIT.passive.bleedPerLevelPer5s +
            dariusBonusAd(w, owner, st) * DARIUS_KIT.passive.bleedBonusAdRatio;
          const dps = (per5 / 5) * u.hemorrhage.stacks;
          const mult = u.kind === 'monster' ? 2.5 : 1;
          w.damage(owner, u, dps * mult, 'physical', 'ability');
        }
      }
    }

    if (u.kind !== 'champion') continue;
    const state = w.championState(u.id);
    if (!state) continue;

    // Darius R rank 1-2 20s recast reset window expiration
    if (state.darius && state.darius.rResetUntil > 0 && w.tick >= state.darius.rResetUntil) {
      state.darius.rResetUntil = 0;
      const rRank = state.spellRanks.r;
      if (rRank > 0 && rRank < 3 && state.cooldowns.r <= w.tick) {
        const baseCd = DARIUS_KIT.r.cooldownSecondsByRank[rRank - 1];
        state.cooldowns.r =
          w.tick + hastedCooldownTicks(baseCd, totalAbilityHaste(state, w.tick));
      }
    }

    // Darius Q windup completion
    if (state.darius?.qWindupEndTick !== null && state.darius?.qWindupEndTick !== undefined) {
      if (!w.alive(u) || w.winner) {
        state.darius.qWindupEndTick = null;
      } else if (w.tick >= state.darius.qWindupEndTick) {
        const rank = state.darius.qRank;
        state.darius.qWindupEndTick = null;
        const totalAd = u.damage + dariusNoxianMightBonusAd(w, state);
        const bladeDmg =
          DARIUS_KIT.q.baseDamageByRank[rank - 1] +
          totalAd * DARIUS_KIT.q.totalAdRatioByRank[rank - 1];
        let champsOuterHit = 0;
        for (const foe of w.units) {
          if (
            foe.team === u.team ||
            foe.kind === 'ward' ||
            !w.targetable(foe) ||
            foe.kind === 'turret' ||
            foe.kind === 'inhibitor' ||
            foe.kind === 'nexus'
          )
            continue;
          const d = distance(u, foe);
          if (d > DARIUS_KIT.q.outerRadius + foe.radius) continue;
          if (d >= DARIUS_KIT.q.innerRadius - foe.radius * 0.4) {
            if (foe.kind === 'champion') champsOuterHit++;
            applyDariusHemorrhage(w, u, state, foe, 1);
            w.damage(u, foe, bladeDmg, 'physical', 'ability');
          } else {
            w.damage(u, foe, bladeDmg * DARIUS_KIT.q.hiltMultiplier, 'physical', 'ability');
          }
        }
        if (champsOuterHit > 0 && w.alive(u)) {
          const frac = Math.min(
            DARIUS_KIT.q.maxMissingHpHeal,
            champsOuterHit * DARIUS_KIT.q.missingHpHealPerChamp
          );
          w.healUnit(u, Math.max(0, u.maxHp - u.hp) * frac);
        }
      }
    }

    // Vi Q & R dashes
    if (state.vi?.qDash) {
      const ccInterrupted =
        !hasBlackShield(u, w.tick) &&
        (u.stunUntil > w.tick || u.rootUntil > w.tick || (u.charm && u.charm.endTick > w.tick));
      if (!w.alive(u) || w.winner || ccInterrupted) {
        state.vi.qDash = null;
      } else {
        const dash = state.vi.qDash;
        const stepDist = dash.speed / TICK_RATE;
        const rem = distance(u, dash.destination);
        const dir = rem > 1e-3 ? direction(u, dash.destination) : { x: 0, y: 0 };
        const move = Math.min(stepDist, rem);
        const nextPos = w.battlefield.reachable(
          { x: u.x + dir.x * move, y: u.y + dir.y * move },
          u.radius,
          u.team
        );
        const prevPos = { x: u.x, y: u.y };
        u.previous = prevPos;
        u.x = nextPos.x;
        u.y = nextPos.y;
        const bonusAd = m6BonusAd(w, u, state);
        const dmg = VI_KIT.q.baseDamageByRank[dash.rank - 1] + bonusAd * VI_KIT.q.bonusAdRatio;
        let stoppedOnChamp = false;
        for (const foe of w.units) {
          if (
            dash.hitIds.includes(foe.id) ||
            foe.team === u.team ||
            foe.kind === 'ward' ||
            !w.targetable(foe) ||
            foe.kind === 'turret' ||
            foe.kind === 'inhibitor' ||
            foe.kind === 'nexus'
          )
            continue;
          if (distance(u, foe) <= VI_KIT.q.hitRadius + foe.radius) {
            dash.hitIds.push(foe.id);
            triggerViBlastShield(w, u, state);
            w.damage(u, foe, dmg, 'physical', 'ability');
            applyViDentingHit(w, u, state, foe);
            if (foe.kind === 'champion') {
              if (!hasBlackShield(foe, w.tick)) {
                foe.stunUntil = Math.max(foe.stunUntil, w.tick + VI_KIT.q.knockbackStunTicks);
              }
              stoppedOnChamp = true;
              break;
            }
          }
        }
        if (stoppedOnChamp || move >= rem - 1 || distance(prevPos, nextPos) < 0.5) {
          state.vi.qDash = null;
        }
      }
    }

    if (state.vi?.rDash) {
      const rDash = state.vi.rDash;
      const target = w.unit(rDash.targetId);
      if (!w.alive(u) || w.winner || !target || !w.alive(target)) {
        state.vi.rDash = null;
      } else {
        const rem = distance(u, target);
        const stepDist = rDash.speed / TICK_RATE;
        const bonusAd = m6BonusAd(w, u, state);
        const fullDmg = VI_KIT.r.baseDamageByRank[rDash.rank - 1] + bonusAd * VI_KIT.r.bonusAdRatio;
        if (rem <= stepDist + u.radius + target.radius) {
          const land = w.battlefield.reachable({ x: target.x, y: target.y }, u.radius, u.team);
          u.previous = { x: u.x, y: u.y };
          u.x = land.x;
          u.y = land.y;
          state.vi.rDash = null;
          triggerViBlastShield(w, u, state);
          if (!hasBlackShield(target, w.tick)) {
            target.stunUntil = Math.max(target.stunUntil, w.tick + VI_KIT.r.stunTicks);
          }
          w.damage(u, target, fullDmg, 'physical', 'ability');
        } else {
          const dir = direction(u, target);
          u.previous = { x: u.x, y: u.y };
          u.x += dir.x * stepDist;
          u.y += dir.y * stepDist;
          u.facing = Math.atan2(dir.x, dir.y);
          // Knock aside secondary enemy champions in Vi's unstoppable path
          const knockasideIds = (rDash.knockasideIds ??= []);
          for (const foe of w.units) {
            if (
              foe.id === target.id ||
              foe.kind !== 'champion' ||
              foe.team === u.team ||
              knockasideIds.includes(foe.id) ||
              !w.targetable(foe)
            )
              continue;
            if (distance(u, foe) <= VI_KIT.q.hitRadius + foe.radius) {
              knockasideIds.push(foe.id);
              w.damage(u, foe, fullDmg * 0.75, 'physical', 'ability');
              if (!hasBlackShield(foe, w.tick) && !isViUnstoppable(w.championState(foe.id))) {
                const side = (foe.x - u.x) * -dir.y + (foe.y - u.y) * dir.x >= 0 ? 1 : -1;
                const pushed = w.battlefield.reachable(
                  { x: foe.x - dir.y * 120 * side, y: foe.y + dir.x * 120 * side },
                  foe.radius,
                  foe.team
                );
                foe.x = pushed.x;
                foe.y = pushed.y;
                w.invalidateSpatialGrid();
                foe.stunUntil = Math.max(foe.stunUntil, w.tick + Math.round(0.5 * TICK_RATE));
              }
            }
          }
        }
      }
    }

    // Ezreal R channel release
    if (state.ezreal?.rChannel) {
      const ch = state.ezreal.rChannel;
      if (!w.alive(u) || w.winner) {
        state.ezreal.rChannel = null;
      } else if (w.tick >= ch.endTick) {
        state.ezreal.rChannel = null;
        const bonusAd = m6BonusAd(w, u, state);
        const dmg =
          EZREAL_KIT.r.baseDamageByRank[ch.rank - 1] +
          bonusAd * EZREAL_KIT.r.bonusAdRatio +
          w.abilityPower(u) * EZREAL_KIT.r.apRatio;
        w.m6Missiles ??= [];
        w.m6Missiles.push({
          id: w.nextId++,
          kind: 'ezreal-r',
          sourceId: u.id,
          team: u.team,
          x: u.x,
          y: u.y,
          previous: { x: u.x, y: u.y },
          direction: ch.direction,
          speed: EZREAL_KIT.r.speed,
          radius: EZREAL_KIT.r.radius,
          remaining: EZREAL_KIT.r.range,
          rank: ch.rank,
          damage: dmg,
          hitIds: [],
        });
      }
    }

    // Morgana R Soul Shackles tether evaluation
    if (state.morgana?.shackles) {
      const sh = state.morgana.shackles;
      if (!w.alive(u) || w.winner) {
        state.morgana.shackles = null;
      } else {
        sh.targetIds = sh.targetIds.filter((tid) => {
          const t = w.unit(tid);
          return !!t && w.alive(t) && distance(u, t) <= MORGANA_KIT.r.breakRadius;
        });
        if (!sh.targetIds.length) {
          state.morgana.shackles = null;
        } else if (w.tick >= sh.endTick) {
          const rank = sh.rank;
          const ids = [...sh.targetIds];
          state.morgana.shackles = null;
          const endDmg =
            MORGANA_KIT.r.baseDamageByRank[rank - 1] + w.abilityPower(u) * MORGANA_KIT.r.apRatio;
          for (const tid of ids) {
            const t = w.unit(tid);
            if (!t || !w.alive(t)) continue;
            if (!hasBlackShield(t, w.tick)) {
              t.stunUntil = Math.max(t.stunUntil, w.tick + MORGANA_KIT.r.stunTicks);
            }
            const beforeHp = t.hp;
            w.damage(u, t, endDmg, 'magic', 'ability');
            applyMorganaSoulSiphon(w, u, state, t, Math.max(0, beforeHp - t.hp));
          }
        }
      }
    }
  }

  // 2. Morgana W pools
  if (w.morganaPools?.length) {
    const keepPools: MorganaPool[] = [];
    for (const pool of w.morganaPools) {
      if (w.winner || w.tick >= pool.endTick) continue;
      if (w.tick >= pool.nextTick) {
        pool.nextTick += MORGANA_KIT.w.tickIntervalTicks;
        const caster = w.unit(pool.sourceId);
        const casterState = caster ? w.championState(caster.id) : undefined;
        if (caster && casterState) {
          const baseHalfSec =
            (MORGANA_KIT.w.dpsByRank[pool.rank - 1] +
              w.abilityPower(caster) * MORGANA_KIT.w.apRatioPerSecond) *
            0.5;
          for (const foe of w.units) {
            if (
              foe.team === pool.team ||
              foe.kind === 'ward' ||
              !w.targetable(foe) ||
              foe.kind === 'turret' ||
              foe.kind === 'inhibitor' ||
              foe.kind === 'nexus' ||
              (foe.kind === 'monster' &&
                foe.monster.phase === 'idle' &&
                caster.team !== 'blue' &&
                caster.team !== 'red')
            )
              continue;
            if (distance(pool, foe) <= pool.radius + foe.radius) {
              const missingFrac = Math.max(0, Math.min(1, 1 - foe.hp / foe.maxHp));
              let dmg =
                baseHalfSec * (1 + missingFrac * (MORGANA_KIT.w.maxMissingHpBonusMultiplier - 1));
              if (foe.kind === 'monster') dmg *= MORGANA_KIT.w.monsterMultiplier;
              const beforeHp = foe.hp;
              w.damage(caster, foe, dmg, 'magic', 'ability');
              applyMorganaSoulSiphon(w, caster, casterState, foe, Math.max(0, beforeHp - foe.hp));
            }
          }
        }
      }
      keepPools.push(pool);
    }
    w.morganaPools = keepPools;
  }

  // 3. Milestone 6 Skillshot Missiles (Ezreal Q/W/R, Morgana Q)
  if (w.m6Missiles?.length) {
    const keepMissiles: Milestone6Missile[] = [];
    for (const m of w.m6Missiles) {
      if (w.winner || m.remaining <= 0) continue;
      const step = Math.min(m.remaining, m.speed / TICK_RATE);
      m.previous = { x: m.x, y: m.y };
      m.x += m.direction.x * step;
      m.y += m.direction.y * step;
      m.remaining -= step;

      const caster = w.unit(m.sourceId);
      const casterState = caster ? w.championState(caster.id) : undefined;
      if (!caster || !casterState) continue;

      let consumed = false;
      for (const foe of w.units) {
        if (
          m.hitIds.includes(foe.id) ||
          foe.team === m.team ||
          foe.kind === 'ward' ||
          !w.targetable(foe)
        )
          continue;
        const isStruct = foe.kind === 'turret' || foe.kind === 'inhibitor' || foe.kind === 'nexus';

        if (m.kind === 'ezreal-w') {
          const validWTarget =
            foe.kind === 'champion' ||
            isStruct ||
            (foe.kind === 'monster' &&
              (foe.monster.species === 'baron' ||
                foe.monster.species === 'riftherald' ||
                foe.monster.species === 'voidgrub' ||
                foe.monster.species === 'elder-dragon' ||
                foe.monster.species.startsWith('dragon-')));
          if (!validWTarget) continue;
          if (segmentDistance(foe, m.previous, m) <= m.radius + foe.radius) {
            foe.essenceFlux = {
              sourceId: caster.id,
              rank: m.rank,
              endTick: w.tick + EZREAL_KIT.w.markDurationTicks,
            };
            consumed = true;
            break;
          }
          continue;
        }

        if (isStruct) continue;
        if (segmentDistance(foe, m.previous, m) > m.radius + foe.radius) continue;

        if (m.kind === 'ezreal-q') {
          m.hitIds.push(foe.id);
          grantEzrealRisingStack(w, casterState, 1);
          for (const slot of ['q', 'w', 'e', 'r'] as const) {
            if (casterState.cooldowns[slot] > w.tick) {
              casterState.cooldowns[slot] = Math.max(
                w.tick,
                casterState.cooldowns[slot] - EZREAL_KIT.q.cooldownRefundTicks
              );
            }
          }
          detonateEzrealFlux(w, caster, casterState, foe);
          const onHit = consumeItemOnHitDamage(
            w,
            caster,
            casterState,
            foe,
            championBaseAd(caster, casterState)
          );
          w.damage(caster, foe, m.damage + onHit, 'physical', 'ability');
          consumed = true;
          break;
        }

        if (m.kind === 'ezreal-r') {
          m.hitIds.push(foe.id);
          grantEzrealRisingStack(w, casterState, 1);
          detonateEzrealFlux(w, caster, casterState, foe);
          const isMinionOrSmallMonster =
            foe.kind !== 'champion' &&
            !(
              foe.kind === 'monster' &&
              (foe.monster.species === 'baron' ||
                foe.monster.species === 'elder-dragon' ||
                foe.monster.species.startsWith('dragon-'))
            );
          const mult = isMinionOrSmallMonster ? EZREAL_KIT.r.minionMultiplier : 1;
          w.damage(caster, foe, m.damage * mult, 'magic', 'ability');
          continue;
        }

        if (m.kind === 'morgana-q') {
          m.hitIds.push(foe.id);
          if (!hasBlackShield(foe, w.tick) && foe.monster?.species !== 'baron') {
            const rootTicks = Math.round(MORGANA_KIT.q.rootSecondsByRank[m.rank - 1] * TICK_RATE);
            foe.rootUntil = Math.max(foe.rootUntil, w.tick + rootTicks);
          }
          const beforeHp = foe.hp;
          w.damage(caster, foe, m.damage, 'magic', 'ability');
          applyMorganaSoulSiphon(w, caster, casterState, foe, Math.max(0, beforeHp - foe.hp));
          consumed = true;
          break;
        }
      }

      if (
        !consumed &&
        m.remaining > 0 &&
        Math.abs(m.x) <= w.battlefield.half + 500 &&
        Math.abs(m.y) <= w.battlefield.half + 500
      ) {
        keepMissiles.push(m);
      }
    }
    w.m6Missiles = keepMissiles;
  }
}

export function onMilestone6TargetKilled(w: World, victim: Unit): void {
  if (!victim.dariusWRefundPending || victim.dariusWRefundPending.tick !== w.tick) return;
  const caster = w.unit(victim.dariusWRefundPending.casterId);
  const st = caster ? w.championState(caster.id) : undefined;
  if (caster && st) {
    const manaCost = DARIUS_KIT.w.manaByRank[victim.dariusWRefundPending.rank - 1];
    caster.mana = Math.min(caster.maxMana, statPrecision(caster.mana + manaCost));
    const rem = st.cooldowns.w - w.tick;
    if (rem > 0) st.cooldowns.w = w.tick + Math.floor(rem * 0.5);
  }
  victim.dariusWRefundPending = undefined;
}

/** Bot learning order & tactical spell selection for Darius, Vi, Ezreal, and Morgana. */
export function milestone6BotSkillPriority(
  champion: Milestone6Champion
): readonly ('q' | 'w' | 'e' | 'r')[] {
  if (champion === 'darius') return ['r', 'q', 'e', 'w'];
  if (champion === 'vi') return ['r', 'q', 'e', 'w'];
  if (champion === 'ezreal') return ['r', 'q', 'e', 'w'];
  return ['r', 'q', 'w', 'e'];
}

export function runMilestone6BotTactics(
  w: World,
  u: Unit,
  state: ChampionState,
  visibleEnemies: readonly Unit[],
  retreating: boolean,
  aimPoint: (target: Vec2) => Vec2
): boolean {
  const champ = u.champion;
  if (!isMilestone6Champion(champ)) return false;

  const canCast = (slot: 'q' | 'w' | 'e' | 'r') =>
    state.spellRanks[slot] > 0 &&
    state.cooldowns[slot] <= w.tick &&
    u.mana >= milestone6AbilitySpec(w, champ, slot, u.id).cost;

  const enemyChamps = visibleEnemies
    .filter((e) => e.kind === 'champion')
    .sort((a, b) => a.hp - b.hp || distance(u, a) - distance(u, b));
  const nearestChamp = enemyChamps[0];
  const nearestUnit = [...visibleEnemies].sort((a, b) => distance(u, a) - distance(u, b))[0];

  if (champ === 'darius') {
    if (nearestChamp) {
      const d = distance(u, nearestChamp);
      const stacks =
        nearestChamp.hemorrhage && nearestChamp.hemorrhage.endTick > w.tick
          ? nearestChamp.hemorrhage.stacks
          : 0;
      if (
        canCast('r') &&
        d <= DARIUS_KIT.r.range &&
        (stacks >= 4 || nearestChamp.hp <= 220 + state.spellRanks.r * 130)
      ) {
        w.enqueue({
          type: 'cast',
          unit: u.id,
          ability: 'r',
          point: nearestChamp,
          targetId: nearestChamp.id,
        });
        return true;
      }
      if (!retreating && canCast('e') && d > 220 && d <= DARIUS_KIT.e.range) {
        w.enqueue({ type: 'cast', unit: u.id, ability: 'e', point: aimPoint(nearestChamp) });
        return true;
      }
      if (canCast('q') && d >= 200 && d <= DARIUS_KIT.q.outerRadius) {
        w.enqueue({ type: 'cast', unit: u.id, ability: 'q', point: u });
        return true;
      }
      if (!retreating && canCast('w') && d <= u.range + nearestChamp.radius + 30) {
        w.enqueue({ type: 'cast', unit: u.id, ability: 'w', point: u });
        return true;
      }
    } else if (
      !retreating &&
      nearestUnit &&
      canCast('q') &&
      u.mana / u.maxMana > 0.45 &&
      distance(u, nearestUnit) <= DARIUS_KIT.q.outerRadius
    ) {
      w.enqueue({ type: 'cast', unit: u.id, ability: 'q', point: u });
      return true;
    }
    return false;
  }

  if (champ === 'vi') {
    if (nearestChamp && !retreating) {
      const d = distance(u, nearestChamp);
      if (
        canCast('r') &&
        d <= VI_KIT.r.range &&
        (nearestChamp.hp / nearestChamp.maxHp < 0.65 || d > 350)
      ) {
        w.enqueue({
          type: 'cast',
          unit: u.id,
          ability: 'r',
          point: nearestChamp,
          targetId: nearestChamp.id,
        });
        return true;
      }
      if (canCast('q') && d <= VI_KIT.q.dashRange) {
        w.enqueue({ type: 'cast', unit: u.id, ability: 'q', point: aimPoint(nearestChamp) });
        return true;
      }
      if (canCast('e') && d <= u.range + 90) {
        w.enqueue({ type: 'cast', unit: u.id, ability: 'e', point: u });
        return true;
      }
    } else if (nearestUnit?.kind === 'monster') {
      const d = distance(u, nearestUnit);
      if (canCast('q') && d <= 500 && u.mana / u.maxMana > 0.3) {
        w.enqueue({ type: 'cast', unit: u.id, ability: 'q', point: nearestUnit });
        return true;
      }
      if (canCast('e') && d <= 220 && u.mana / u.maxMana > 0.25) {
        w.enqueue({ type: 'cast', unit: u.id, ability: 'e', point: u });
        return true;
      }
    }
    return false;
  }

  if (champ === 'ezreal') {
    if (retreating && canCast('e') && nearestChamp && distance(u, nearestChamp) < 420) {
      const home = w.battlefield.spawns[u.team as Team];
      const away = direction(nearestChamp, home);
      w.enqueue({
        type: 'cast',
        unit: u.id,
        ability: 'e',
        point: {
          x: u.x + away.x * EZREAL_KIT.e.blinkRange,
          y: u.y + away.y * EZREAL_KIT.e.blinkRange,
        },
      });
      return true;
    }
    if (nearestChamp) {
      const d = distance(u, nearestChamp);
      if (
        canCast('r') &&
        nearestChamp.hp <= 340 + state.spellRanks.r * 160 &&
        d <= 2200 &&
        d >= 450
      ) {
        w.enqueue({ type: 'cast', unit: u.id, ability: 'r', point: aimPoint(nearestChamp) });
        return true;
      }
      if (canCast('w') && d <= EZREAL_KIT.w.range) {
        w.enqueue({ type: 'cast', unit: u.id, ability: 'w', point: aimPoint(nearestChamp) });
        return true;
      }
      if (canCast('q') && d <= EZREAL_KIT.q.range - 50) {
        w.enqueue({ type: 'cast', unit: u.id, ability: 'q', point: aimPoint(nearestChamp) });
        return true;
      }
    } else if (
      !retreating &&
      nearestUnit &&
      canCast('q') &&
      u.mana / u.maxMana > 0.35 &&
      distance(u, nearestUnit) <= EZREAL_KIT.q.range - 80
    ) {
      const isStruct =
        nearestUnit.kind === 'turret' ||
        nearestUnit.kind === 'inhibitor' ||
        nearestUnit.kind === 'nexus';
      if (!isStruct) {
        w.enqueue({ type: 'cast', unit: u.id, ability: 'q', point: nearestUnit });
        return true;
      }
    }
    return false;
  }

  // Morgana
  if (canCast('e')) {
    const threatenedAlly = w.units
      .filter(
        (a) =>
          a.kind === 'champion' &&
          a.team === u.team &&
          w.alive(a) &&
          distance(u, a) <= MORGANA_KIT.e.range &&
          (a.hp / a.maxHp < 0.65 || enemyChamps.some((e) => distance(a, e) < 550))
      )
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (threatenedAlly) {
      w.enqueue({
        type: 'cast',
        unit: u.id,
        ability: 'e',
        point: threatenedAlly,
        targetId: threatenedAlly.id,
      });
      return true;
    }
  }
  if (nearestChamp) {
    const d = distance(u, nearestChamp);
    if (!retreating && canCast('r') && d <= MORGANA_KIT.r.tetherRadius - 50) {
      w.enqueue({ type: 'cast', unit: u.id, ability: 'r', point: u });
      return true;
    }
    if (canCast('q') && d <= MORGANA_KIT.q.range - 80) {
      w.enqueue({ type: 'cast', unit: u.id, ability: 'q', point: aimPoint(nearestChamp) });
      return true;
    }
    if (canCast('w') && d <= MORGANA_KIT.w.range) {
      w.enqueue({ type: 'cast', unit: u.id, ability: 'w', point: aimPoint(nearestChamp) });
      return true;
    }
  }
  return false;
}
