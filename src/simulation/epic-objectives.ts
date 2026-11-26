import {
  DRAGON_ELEMENTS,
  DRAGON_ELEMENT_NAMES,
  DRAGON_PIT_POINT,
  DRAGON_SLAYER_BUFFS,
  DRAGON_SOUL_NAMES,
  EPIC_OBJECTIVE_TIMING,
  TOP_PIT_POINT,
  VOIDGRUB_OFFSETS,
  scaleEpicMonsterAtLevel,
  type DragonElement,
} from '../content/epic-objectives';
import { TICK_RATE } from '../content/rules';
import { championItemBonusAd } from './champion-stats';
import { distance, type Vec2 } from './math';
import { statPrecision } from './progression';
import { runeAdaptiveStats } from './runes';
import { averageChampionLevel } from './trinkets';
import type { ChampionState, Team, Unit } from './types';
import type { World } from './world';

export interface RiftObjectivesState {
  dragon: {
    unitId: number | null;
    activeKind: DragonElement | 'elder' | null;
    nextElement: DragonElement;
    seenInitialElements: DragonElement[];
    lockedRiftElement: DragonElement | null;
    nextReadyTick: number;
    lastClear: { tick: number; team: Team | null; kind: DragonElement | 'elder' } | null;
    stacks: Record<Team, DragonElement[]>;
    soulTeam: Team | null;
    soulElement: DragonElement | null;
    elderBuff: { team: Team; endTick: number; holders: number[] } | null;
    soulCooldowns: Record<number, number>;
    cloudUltBurstUntil: Record<number, number>;
  };
  voidgrubs: {
    unitIds: number[];
    spawnsCompleted: number;
    nextReadyTick: number | null;
    stacks: Record<Team, number>;
    miteCooldowns?: Record<number, number>;
  };
  herald: {
    unitId: number | null;
    spawned: boolean;
    clearedTick: number | null;
    chargeHolder: { unitId: number; team: Team; endTick: number } | null;
    summonedUnitId?: number | null;
  };
}

function pickRandomElement(w: World, exclude: readonly DragonElement[]): DragonElement {
  const pool = DRAGON_ELEMENTS.filter((el) => !exclude.includes(el));
  const choices = pool.length > 0 ? pool : DRAGON_ELEMENTS;
  const idx = Math.floor(w.random.next() * choices.length) % choices.length;
  return choices[idx];
}

export function createRiftObjectivesState(w: World): RiftObjectivesState {
  const first = pickRandomElement(w, []);
  return {
    dragon: {
      unitId: null,
      activeKind: null,
      nextElement: first,
      seenInitialElements: [first],
      lockedRiftElement: null,
      nextReadyTick: EPIC_OBJECTIVE_TIMING.dragonFirstReadyTick,
      lastClear: null,
      stacks: { blue: [], red: [] },
      soulTeam: null,
      soulElement: null,
      elderBuff: null,
      soulCooldowns: {},
      cloudUltBurstUntil: {},
    },
    voidgrubs: {
      unitIds: [],
      spawnsCompleted: 0,
      nextReadyTick: EPIC_OBJECTIVE_TIMING.voidgrubFirstReadyTick,
      stacks: { blue: 0, red: 0 },
    },
    herald: {
      unitId: null,
      spawned: false,
      clearedTick: null,
      chargeHolder: null,
    },
  };
}

export function isElementalRiftTransformed(w: World): boolean {
  return !!w.riftObjectives?.dragon.lockedRiftElement;
}

export function advanceRiftObjectives(w: World): void {
  const obj = w.riftObjectives;
  if (!obj || w.winner) return;
  const avgLvl = averageChampionLevel(w);

  // 1. Expire Elder buff and Herald charge
  if (obj.dragon.elderBuff && w.tick >= obj.dragon.elderBuff.endTick) {
    obj.dragon.elderBuff = null;
  }
  if (obj.herald.chargeHolder && w.tick >= obj.herald.chargeHolder.endTick) {
    obj.herald.chargeHolder = null;
  }

  // 2. Voidgrubs (06:00 -> 14:45)
  obj.voidgrubs.unitIds = obj.voidgrubs.unitIds.filter((id) => {
    const u = w.unit(id);
    return !!u && w.alive(u);
  });
  if (w.tick >= EPIC_OBJECTIVE_TIMING.voidgrubDespawnTick) {
    obj.voidgrubs.nextReadyTick = null;
    for (const id of [...obj.voidgrubs.unitIds]) {
      const u = w.unit(id);
      if (u && u.kind === 'monster' && u.monster.phase !== 'engaged') {
        u.hp = 0;
        u.deadAt = w.tick;
        obj.voidgrubs.unitIds = obj.voidgrubs.unitIds.filter((x) => x !== id);
      }
    }
  } else if (
    obj.voidgrubs.unitIds.length === 0 &&
    obj.voidgrubs.nextReadyTick !== null &&
    w.tick >= obj.voidgrubs.nextReadyTick - 72
  ) {
    const readyTick = Math.max(obj.voidgrubs.nextReadyTick, w.tick + 72);
    const startTick = readyTick - 72;
    obj.voidgrubs.nextReadyTick = null;
    obj.voidgrubs.spawnsCompleted++;
    const scaled = scaleEpicMonsterAtLevel('voidgrub', avgLvl);
    for (const offset of VOIDGRUB_OFFSETS) {
      const point = w.battlefield.reachable(
        { x: TOP_PIT_POINT.x + offset.x, y: TOP_PIT_POINT.y + offset.y },
        70
      );
      const grub = w.spawnMonster(point, { startTick, readyTick, clip: 'spawn' }, 'voidgrub');
      Object.assign(grub, scaled, { hp: scaled.maxHp });
      obj.voidgrubs.unitIds.push(grub.id);
    }
  }

  // 3. Rift Herald (15:00 -> 19:45)
  if (obj.herald.unitId !== null) {
    const h = w.unit(obj.herald.unitId);
    if (!h || !w.alive(h)) {
      obj.herald.unitId = null;
    } else if (
      w.tick >= EPIC_OBJECTIVE_TIMING.heraldDespawnTick &&
      h.kind === 'monster' &&
      h.monster.phase !== 'engaged'
    ) {
      h.hp = 0;
      h.deadAt = w.tick;
      obj.herald.unitId = null;
    }
  } else if (
    !obj.herald.spawned &&
    obj.voidgrubs.unitIds.length === 0 &&
    w.tick >= EPIC_OBJECTIVE_TIMING.heraldFirstReadyTick - 72 &&
    w.tick < EPIC_OBJECTIVE_TIMING.heraldDespawnTick
  ) {
    const readyTick = Math.max(EPIC_OBJECTIVE_TIMING.heraldFirstReadyTick, w.tick + 72);
    const startTick = readyTick - 72;
    obj.herald.spawned = true;
    const point = w.battlefield.reachable(TOP_PIT_POINT, 110);
    const herald = w.spawnMonster(point, { startTick, readyTick, clip: 'spawn' }, 'riftherald');
    const scaled = scaleEpicMonsterAtLevel('riftherald', avgLvl);
    Object.assign(herald, scaled, { hp: scaled.maxHp });
    obj.herald.unitId = herald.id;
  }

  // 4. Elemental Drakes & Elder Dragon
  if (obj.dragon.unitId !== null) {
    const d = w.unit(obj.dragon.unitId);
    if (!d || !w.alive(d)) obj.dragon.unitId = null;
  }
  if (obj.dragon.unitId === null && w.tick >= obj.dragon.nextReadyTick - 72) {
    const readyTick = Math.max(obj.dragon.nextReadyTick, w.tick + 72);
    const startTick = readyTick - 72;
    const point = w.battlefield.reachable(DRAGON_PIT_POINT, 80);
    if (obj.dragon.soulTeam !== null) {
      const elder = w.spawnMonster(point, { startTick, readyTick, clip: 'spawn' }, 'elder-dragon');
      const scaled = scaleEpicMonsterAtLevel('elder-dragon', avgLvl);
      Object.assign(elder, scaled, { hp: scaled.maxHp });
      obj.dragon.unitId = elder.id;
      obj.dragon.activeKind = 'elder';
    } else {
      const element = obj.dragon.lockedRiftElement ?? obj.dragon.nextElement;
      const species = `dragon-${element}` as const;
      const drake = w.spawnMonster(point, { startTick, readyTick, clip: 'spawn' }, species);
      const scaled = scaleEpicMonsterAtLevel(species, avgLvl);
      Object.assign(drake, scaled, { hp: scaled.maxHp });
      obj.dragon.unitId = drake.id;
      obj.dragon.activeKind = element;
    }
  }

  // 5. Periodic Dragon Slayer & Soul ticks (Ocean regen, Mountain shield) + Void/Elder burns
  for (const u of w.units) {
    if (u.voidTouchBurn) {
      if (!w.alive(u) || u.voidTouchBurn.endTick < w.tick) u.voidTouchBurn = undefined;
      else if (w.tick >= u.voidTouchBurn.nextTick) {
        u.voidTouchBurn.nextTick += TICK_RATE;
        const owner = w.unit(u.voidTouchBurn.sourceId);
        if (owner) w.damage(owner, u, u.voidTouchBurn.dps, 'true', 'objective');
      }
    }
    if (u.elderBurn) {
      if (!w.alive(u) || u.elderBurn.endTick < w.tick) u.elderBurn = undefined;
      else if (w.tick >= u.elderBurn.nextTick) {
        u.elderBurn.nextTick += TICK_RATE;
        const owner = w.unit(u.elderBurn.sourceId);
        if (owner) w.damage(owner, u, u.elderBurn.dps, 'true', 'objective');
      }
    }

    if (u.kind !== 'champion' || !w.alive(u)) continue;
    const team = u.team;
    const waterStacks = obj.dragon.stacks[team].filter((e) => e === 'water').length;
    if (waterStacks > 0 && w.tick > 0 && w.tick % (5 * TICK_RATE) === 0) {
      const missing = Math.max(0, u.maxHp - u.hp);
      if (missing > 0) {
        w.healUnit(
          u,
          missing * DRAGON_SLAYER_BUFFS.waterMissingHpRegenPer5sFractionPerStack * waterStacks
        );
      }
    }
    if (
      obj.dragon.soulTeam === team &&
      obj.dragon.soulElement === 'earth' &&
      w.tick > 0 &&
      w.tick % (TICK_RATE / 2) === 0
    ) {
      const lastCombat = u.lastCombatTick ?? -Infinity;
      const outOfCombat = w.tick - lastCombat >= DRAGON_SLAYER_BUFFS.mountainSoulOutOfCombatTicks;
      const hasMountainShield = u.shields.some((s) => s.mountainSoul && s.endTick > w.tick);
      if (outOfCombat && !hasMountainShield) {
        u.shields.push({
          sourceId: u.id,
          amount: DRAGON_SLAYER_BUFFS.mountainSoulShieldBase + Math.round(u.maxHp * 0.08),
          endTick: w.tick + 12 * TICK_RATE,
          mountainSoul: true,
        });
      }
    }
  }

  // Advance summoned Rift Herald mercenary turret charge & AI holder auto-summon near enemy turret
  if (obj.herald.chargeHolder && obj.herald.chargeHolder.endTick > w.tick) {
    const holder = w.unit(obj.herald.chargeHolder.unitId);
    if (holder && holder.ai && w.alive(holder) && holder.team !== 'neutral') {
      const nearbyTurret = w.units.find(
        (t) =>
          t.kind === 'turret' &&
          t.team !== holder.team &&
          w.alive(t) &&
          w.targetable(t) &&
          distance(holder, t) <= 900
      );
      if (nearbyTurret) {
        summonRiftHerald(w, holder, { x: nearbyTurret.x, y: nearbyTurret.y });
      }
    }
  }

  if (obj.herald.summonedUnitId) {
    const summoned = w.unit(obj.herald.summonedUnitId);
    if (!summoned || !w.alive(summoned) || summoned.team === 'neutral') {
      obj.herald.summonedUnitId = null;
    } else {
      const turret = w.units.find(
        (t) =>
          t.kind === 'turret' &&
          t.team !== summoned.team &&
          w.alive(t) &&
          w.targetable(t) &&
          distance(summoned, t) <= 320 + t.radius
      );
      if (turret && w.tick >= (summoned.lastCombatTick ?? 0)) {
        summoned.lastCombatTick = w.tick + 6 * TICK_RATE;
        const chargeDmg =
          EPIC_OBJECTIVE_TIMING.heraldTurretBaseTrueDamage +
          turret.maxHp * EPIC_OBJECTIVE_TIMING.heraldTurretMaxHpTrueFraction;
        w.emit('message', turret, {
          text: 'Rift Herald Siege Charge!',
          unit: summoned.id,
          team: summoned.team,
        });
        w.damage(summoned, turret, chargeDmg, 'true', 'objective');
        summoned.hp = Math.max(1, statPrecision(summoned.hp * 0.5));
      }
    }
  }
}

export function onEpicObjectiveKilled(w: World, victim: Unit, killer: Unit | undefined): void {
  const obj = w.riftObjectives;
  if (!obj || victim.kind !== 'monster') return;
  const team: Team | null = killer && killer.team !== 'neutral' ? killer.team : null;
  const sp = victim.monster.species;

  // Voidgrub
  if (sp === 'voidgrub') {
    obj.voidgrubs.unitIds = obj.voidgrubs.unitIds.filter((id) => id !== victim.id);
    if (team) {
      obj.voidgrubs.stacks[team]++;
      if (killer?.id === w.player.id || team === 'blue') {
        w.emit('message', victim, {
          text: `${team === 'blue' ? 'Your' : 'Enemy'} team slew a Voidgrub (${obj.voidgrubs.stacks[team]} Touch of the Void)`,
          team,
        });
      }
    }
    if (
      obj.voidgrubs.unitIds.length === 0 &&
      obj.voidgrubs.spawnsCompleted === 1 &&
      w.tick + EPIC_OBJECTIVE_TIMING.voidgrubRespawnTicks <
        EPIC_OBJECTIVE_TIMING.voidgrubDespawnTick
    ) {
      obj.voidgrubs.nextReadyTick = Math.min(
        EPIC_OBJECTIVE_TIMING.voidgrubLastRespawnStartTick,
        w.tick + EPIC_OBJECTIVE_TIMING.voidgrubRespawnTicks
      );
    }
    return;
  }

  // Rift Herald
  if (sp === 'riftherald') {
    obj.herald.unitId = null;
    obj.herald.clearedTick = w.tick;
    if (team) {
      for (const ch of w.units) {
        if (ch.kind !== 'champion' || ch.team !== team) continue;
        const st = w.championState(ch.id);
        if (st) st.gold = statPrecision(st.gold + (ch.id === killer?.id ? 200 : 50));
      }
      if (killer && killer.kind === 'champion' && w.alive(killer)) {
        obj.herald.chargeHolder = {
          unitId: killer.id,
          team,
          endTick: w.tick + EPIC_OBJECTIVE_TIMING.heraldChargeDurationTicks,
        };
      }
      w.emit('message', victim, {
        text: `${team === 'blue' ? 'Your' : 'Enemy'} team slew Rift Herald! Herald Siege Charge granted.`,
        team,
      });
    }
    return;
  }

  // Elder Dragon
  if (sp === 'elder-dragon') {
    obj.dragon.unitId = null;
    obj.dragon.activeKind = null;
    obj.dragon.lastClear = { tick: w.tick, team, kind: 'elder' };
    obj.dragon.nextReadyTick = w.tick + EPIC_OBJECTIVE_TIMING.elderRespawnTicks;
    if (team) {
      const holders: number[] = [];
      for (const ch of w.units) {
        if (ch.kind !== 'champion' || ch.team !== team) continue;
        if (w.alive(ch)) holders.push(ch.id);
        const st = w.championState(ch.id);
        if (st) st.gold = statPrecision(st.gold + 150);
      }
      obj.dragon.elderBuff = {
        team,
        endTick: w.tick + EPIC_OBJECTIVE_TIMING.elderBuffDurationTicks,
        holders,
      };
      w.emit('message', victim, {
        text: `${team === 'blue' ? 'Your' : 'Enemy'} team slew the Elder Dragon! Aspect of the Dragon active.`,
        team,
      });
    }
    return;
  }

  // Elemental Drakes
  if (sp.startsWith('dragon-')) {
    const element = sp.slice('dragon-'.length) as DragonElement;
    obj.dragon.unitId = null;
    obj.dragon.activeKind = null;
    obj.dragon.lastClear = { tick: w.tick, team, kind: element };

    if (team) {
      obj.dragon.stacks[team].push(element);
      for (const ch of w.units) {
        if (ch.kind !== 'champion' || ch.team !== team) continue;
        const st = w.championState(ch.id);
        if (st) st.gold = statPrecision(st.gold + 25);
      }

      if (
        obj.dragon.soulTeam === null &&
        obj.dragon.stacks[team].length >= DRAGON_SLAYER_BUFFS.soulStacksRequired
      ) {
        obj.dragon.soulTeam = team;
        obj.dragon.soulElement = obj.dragon.lockedRiftElement ?? element;
        obj.dragon.nextReadyTick = w.tick + EPIC_OBJECTIVE_TIMING.elderFirstDelayAfterSoulTicks;
        w.emit('message', victim, {
          text: `${team === 'blue' ? 'Your' : 'Enemy'} team claimed the ${DRAGON_SOUL_NAMES[obj.dragon.soulElement]}!`,
          team,
        });
        return;
      }

      w.emit('message', victim, {
        text: `${team === 'blue' ? 'Your' : 'Enemy'} team slew the ${DRAGON_ELEMENT_NAMES[element]} (${obj.dragon.stacks[team].length}/4).`,
        team,
      });
    }

    // Advance element rotation: 1st -> 2nd distinct -> 3rd locks Elemental Rift
    const totalCleared = obj.dragon.stacks.blue.length + obj.dragon.stacks.red.length;
    if (totalCleared === 1 && !obj.dragon.lockedRiftElement) {
      const second = pickRandomElement(w, obj.dragon.seenInitialElements);
      obj.dragon.seenInitialElements.push(second);
      obj.dragon.nextElement = second;
    } else if (totalCleared >= 2 && !obj.dragon.lockedRiftElement) {
      const third = pickRandomElement(w, obj.dragon.seenInitialElements);
      obj.dragon.lockedRiftElement = third;
      obj.dragon.nextElement = third;
      w.emit('message', victim, {
        text: `Elemental Rift transformed: ${DRAGON_ELEMENT_NAMES[third]}! Elemental Faelights awakened.`,
      });
    }
    obj.dragon.nextReadyTick = w.tick + EPIC_OBJECTIVE_TIMING.dragonRespawnTicks;
  }
}

export function dragonOffenseMultiplier(w: World, team: Team): number {
  const stacks = w.riftObjectives?.dragon.stacks[team].filter((e) => e === 'fire').length ?? 0;
  return 1 + stacks * DRAGON_SLAYER_BUFFS.fireBonusOffenseFractionPerStack;
}

export function dragonDefenseMultiplier(w: World, team: Team): number {
  const stacks = w.riftObjectives?.dragon.stacks[team].filter((e) => e === 'earth').length ?? 0;
  return 1 + stacks * DRAGON_SLAYER_BUFFS.earthBonusDefenseFractionPerStack;
}

export function dragonSlowResist(w: World, team: Team): number {
  const stacks = w.riftObjectives?.dragon.stacks[team].filter((e) => e === 'air').length ?? 0;
  return Math.min(0.5, stacks * DRAGON_SLAYER_BUFFS.airSlowResistPerStack);
}

export function dragonBonusHaste(w: World, team: Team): number {
  const stacks = w.riftObjectives?.dragon.stacks[team].filter((e) => e === 'hextech').length ?? 0;
  return stacks * DRAGON_SLAYER_BUFFS.hextechAbilityHastePerStack;
}

export function dragonBonusAttackSpeed(w: World, team: Team): number {
  const stacks = w.riftObjectives?.dragon.stacks[team].filter((e) => e === 'hextech').length ?? 0;
  return stacks * DRAGON_SLAYER_BUFFS.hextechAttackSpeedPerStack;
}

export function dragonBonusMoveSpeedMultiplier(w: World, u: Unit): number {
  const obj = w.riftObjectives;
  if (!obj || u.team === 'neutral') return 1;
  const airStacks = obj.dragon.stacks[u.team].filter((e) => e === 'air').length;
  let mult = 1 + airStacks * DRAGON_SLAYER_BUFFS.airBonusMoveSpeedFractionPerStack;
  if (obj.dragon.soulTeam === u.team && obj.dragon.soulElement === 'air') {
    mult += DRAGON_SLAYER_BUFFS.cloudSoulPassiveSpeedFraction;
    if ((obj.dragon.cloudUltBurstUntil[u.id] ?? 0) > w.tick) {
      mult += DRAGON_SLAYER_BUFFS.cloudSoulUltimateBurstFraction;
    }
  }
  return mult;
}

export function dragonTenacity(w: World, team: Team): number {
  const stacks = w.riftObjectives?.dragon.stacks[team].filter((e) => e === 'chemtech').length ?? 0;
  return stacks * DRAGON_SLAYER_BUFFS.chemtechTenacityPerStack;
}

export function onUltimateCastDragonSoul(w: World, caster: Unit): void {
  const obj = w.riftObjectives;
  if (!obj || caster.team === 'neutral') return;
  if (obj.dragon.soulTeam === caster.team && obj.dragon.soulElement === 'air') {
    obj.dragon.cloudUltBurstUntil[caster.id] =
      w.tick + DRAGON_SLAYER_BUFFS.cloudSoulUltimateBurstTicks;
  }
}

export function hasHeraldEmpoweredRecall(w: World, state: ChampionState): boolean {
  const holder = w.riftObjectives?.herald.chargeHolder;
  return !!holder && holder.unitId === state.id && holder.endTick > w.tick;
}

export function summonRiftHerald(w: World, summoner: Unit, point?: Vec2): string | null {
  const obj = w.riftObjectives;
  if (!obj || summoner.kind !== 'champion' || !w.alive(summoner))
    return 'Cannot summon Rift Herald right now';
  const holder = obj.herald.chargeHolder;
  if (!holder || holder.unitId !== summoner.id || holder.endTick <= w.tick) {
    return 'You do not hold the Eye of the Herald';
  }
  const team = summoner.team;
  obj.herald.chargeHolder = null;
  const targetPoint = point ?? { x: summoner.x + 120, y: summoner.y };
  const spawnPos = w.battlefield.reachable(
    {
      x: summoner.x + Math.max(-180, Math.min(180, targetPoint.x - summoner.x)),
      y: summoner.y + Math.max(-180, Math.min(180, targetPoint.y - summoner.y)),
    },
    64,
    team
  );
  const minutes = Math.max(0, w.tick / (60 * TICK_RATE));
  const maxHp = Math.round(2600 + minutes * 90);
  const herald = w.spawn('siege', team, spawnPos);
  herald.name = 'Rift Herald';
  herald.summonedObjective = 'rift-herald';
  herald.maxHp = maxHp;
  herald.hp = maxHp;
  herald.damage = 95;
  herald.armor = 60;
  herald.magicResist = 50;
  herald.speed = 375;
  herald.radius = 64;
  herald.range = 200;
  herald.goldBounty = 25;
  herald.experienceBounty = 0;
  herald.ai = true;
  // Assign to the lane closest to the summon point so it marches down-lane
  let bestLane = 1;
  let bestDist = Infinity;
  for (let laneIdx = 0; laneIdx < w.battlefield.lanes.length; laneIdx++) {
    const waypoints = w.battlefield.lanes[laneIdx]!.points;
    for (const wp of waypoints) {
      const d = distance(spawnPos, wp);
      if (d < bestDist) {
        bestDist = d;
        bestLane = laneIdx;
      }
    }
  }
  herald.lane = bestLane;
  obj.herald.summonedUnitId = herald.id;
  w.emit('message', herald, {
    text: `${team === 'blue' ? 'Your' : 'Enemy'} team summoned the Rift Herald!`,
    unit: herald.id,
    team,
  });
  return null;
}

export function onObjectivePostHitEffects(
  w: World,
  source: Unit,
  target: Unit,
  dealt: number,
  isBasicAttack: boolean
): void {
  const obj = w.riftObjectives;
  if (!obj || dealt <= 0 || source.kind !== 'champion' || source.team === target.team) return;
  const team = source.team;
  const isStructure =
    target.kind === 'turret' || target.kind === 'inhibitor' || target.kind === 'nexus';

  // Touch of the Void, Voidmites (4+ stacks), & Herald Siege Charge against structures
  if (isStructure && isBasicAttack) {
    const grubStacks = obj.voidgrubs.stacks[team];
    if (grubStacks > 0) {
      target.voidTouchBurn = {
        sourceId: source.id,
        dps: grubStacks * EPIC_OBJECTIVE_TIMING.voidTouchStructureTrueDpsPerStack,
        endTick: w.tick + EPIC_OBJECTIVE_TIMING.voidTouchDurationTicks,
        nextTick: w.tick + TICK_RATE,
      };
      if (grubStacks >= 4) {
        const cooldowns = (obj.voidgrubs.miteCooldowns ??= {});
        const readyAt = cooldowns[source.id] ?? 0;
        if (w.tick >= readyAt) {
          cooldowns[source.id] = w.tick + 12 * TICK_RATE;
          const miteCount = grubStacks >= 5 ? 2 : 1;
          for (let i = 0; i < miteCount; i++) {
            const offset = i === 0 ? -45 : 45;
            const mitePos = w.battlefield.reachable(
              { x: source.x + offset, y: source.y + offset },
              28,
              team
            );
            const mite = w.spawn('melee', team, mitePos);
            mite.name = 'Voidmite';
            mite.summonedObjective = 'voidmite';
            mite.maxHp = 220;
            mite.hp = 220;
            mite.damage = 14;
            mite.speed = 360;
            mite.radius = 28;
            mite.goldBounty = 0;
            mite.experienceBounty = 0;
            mite.order = { type: 'attack', target: target.id };
          }
        }
      }
    }
    if (
      target.kind === 'turret' &&
      obj.herald.chargeHolder?.unitId === source.id &&
      obj.herald.chargeHolder.endTick > w.tick
    ) {
      obj.herald.chargeHolder = null;
      const chargeDmg =
        EPIC_OBJECTIVE_TIMING.heraldTurretBaseTrueDamage +
        target.maxHp * EPIC_OBJECTIVE_TIMING.heraldTurretMaxHpTrueFraction;
      w.emit('message', target, {
        text: 'Herald Siege Charge!',
        unit: source.id,
        team,
      });
      w.damage(source, target, chargeDmg, 'true', 'objective');
    }
    return;
  }

  if (isStructure) return;

  // Dragon Soul combat procs against champions
  if (target.kind === 'champion' && obj.dragon.soulTeam === team) {
    const ready = obj.dragon.soulCooldowns[source.id] ?? 0;
    if (obj.dragon.soulElement === 'fire' && w.tick >= ready) {
      obj.dragon.soulCooldowns[source.id] = w.tick + DRAGON_SLAYER_BUFFS.infernalSoulCooldownTicks;
      const srcState = w.championState(source.id);
      const bonusAd = srcState
        ? championItemBonusAd(source, srcState) + runeAdaptiveStats(w, source, srcState).bonusAd
        : 0;
      const burst =
        DRAGON_SLAYER_BUFFS.infernalSoulBaseDamage +
        bonusAd * 0.22 +
        w.abilityPower(source) * 0.15;
      for (const foe of w.units) {
        if (
          foe.team !== team &&
          foe.team !== 'neutral' &&
          w.targetable(foe) &&
          !(foe.kind === 'turret' || foe.kind === 'inhibitor' || foe.kind === 'nexus') &&
          distance(target, foe) <= 250 + foe.radius
        ) {
          w.damage(source, foe, burst, 'magic', 'objective');
        }
      }
    } else if (obj.dragon.soulElement === 'water' && w.tick >= ready) {
      obj.dragon.soulCooldowns[source.id] = w.tick + DRAGON_SLAYER_BUFFS.oceanSoulCooldownTicks;
      if (w.alive(source)) {
        w.healUnit(source, DRAGON_SLAYER_BUFFS.oceanSoulHealBase + source.maxHp * 0.04);
        source.mana = Math.min(
          source.maxMana,
          statPrecision(source.mana + DRAGON_SLAYER_BUFFS.oceanSoulManaBase)
        );
      }
    } else if (obj.dragon.soulElement === 'hextech' && w.tick >= ready) {
      obj.dragon.soulCooldowns[source.id] = w.tick + DRAGON_SLAYER_BUFFS.hextechSoulCooldownTicks;
      w.damage(source, target, DRAGON_SLAYER_BUFFS.hextechSoulMagicDamage, 'magic', 'objective');
      w.applyExtraSlow(source, target, 'hextech-soul');
    }
  }

  // Aspect of the Dragon (Elder buff: true-damage burn + 20% HP champion execute!)
  if (
    obj.dragon.elderBuff &&
    obj.dragon.elderBuff.team === team &&
    obj.dragon.elderBuff.endTick > w.tick &&
    obj.dragon.elderBuff.holders.includes(source.id) &&
    w.alive(target)
  ) {
    target.elderBurn = {
      sourceId: source.id,
      dps: EPIC_OBJECTIVE_TIMING.elderBurnTotalTrueDamage / 3,
      endTick: w.tick + EPIC_OBJECTIVE_TIMING.elderBurnDurationTicks,
      nextTick: w.tick + TICK_RATE,
    };
    if (
      target.kind === 'champion' &&
      target.hp / target.maxHp < EPIC_OBJECTIVE_TIMING.elderExecuteThreshold &&
      (w.championState(target.id)?.itemState?.stasisUntilTick ?? 0) <= w.tick
    ) {
      w.emit('message', target, {
        text: 'Aspect of the Dragon Execute!',
        unit: source.id,
        team,
      });
      w.damage(source, target, target.hp + 9999, 'true', 'objective');
    }
  }
}
