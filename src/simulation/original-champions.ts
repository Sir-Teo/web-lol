import {
  isOriginalChampion,
  ORIGINAL_EFFECT_TICKS,
  ORIGINAL_LINEUP,
  ORIGINAL_PASSIVE_EXPIRY,
  ORIGINAL_PASSIVE_HITS,
  ORIGINAL_SLOTS,
  originalSpellAmount,
  type OriginalSlot,
  type OriginalSpell,
} from '../content/original-lineup';
import { TICK_RATE } from '../content/rules';
import { distance, direction, sweepCircle, type Vec2 } from './math';
import { isStructureKind, type ChampionState, type TeamUnit, type Unit } from './types';
import { primeSpellbladeOnCast } from './item-effects';
import type { World } from './world';

export interface OriginalCast {
  slot: OriginalSlot;
  rank: number;
  origin: Vec2;
  point: Vec2;
  startTick: number;
  releaseTick: number;
  phase: 'windup' | 'impact' | 'cancelled';
}

export interface OriginalChampionState {
  hits: number;
  hitExpiry: number;
  casts: OriginalCast[];
}

export function originalCastGeometry(spell: OriginalSpell, origin: Vec2, aim: Vec2): Vec2 {
  const unitDirection = direction(origin, aim);
  const length =
    spell.shape === 'line' ? spell.range : Math.min(distance(origin, aim), spell.range);
  return { x: origin.x + unitDirection.x * length, y: origin.y + unitDirection.y * length };
}

export const ORIGINAL_RING_INNER = 0.62;
export const ORIGINAL_SLOW_MULTIPLIER = 0.68;

function disabled(unit: Unit, spell: OriginalSpell, tick: number) {
  return (
    unit.stunUntil > tick ||
    unit.silenceUntil > tick ||
    !!unit.charm ||
    (spell.shape === 'dash' && unit.rootUntil > tick)
  );
}

export function castOriginalAbility(
  world: World,
  unit: TeamUnit,
  state: ChampionState,
  slot: OriginalSlot,
  aim: Vec2
): boolean {
  if (!isOriginalChampion(unit.champion) || !state.original || world.winner) return false;
  const spell = ORIGINAL_LINEUP[unit.champion].spells[slot];
  const rank = state.spellRanks[slot];
  if (
    !rank ||
    state.cooldowns[slot] > world.tick ||
    unit.mana < spell.mana ||
    disabled(unit, spell, world.tick) ||
    state.original.casts.some((cast) => cast.phase === 'windup') ||
    (spell.shape === 'line' && distance(unit, aim) === 0)
  )
    return false;
  if (spell.shape !== 'self' && distance(unit, aim) > 0)
    unit.facing = Math.atan2(aim.x - unit.x, aim.y - unit.y);
  world.setOrder(unit, { type: 'idle' });
  unit.mana -= spell.mana;
  state.cooldowns[slot] =
    world.tick +
    Math.round((spell.cooldown * TICK_RATE * 100) / (100 + world.abilityHaste(unit.id)));
  state.original.casts.push({
    slot,
    rank,
    origin: { x: unit.x, y: unit.y },
    point: originalCastGeometry(spell, unit, aim),
    startTick: world.tick,
    releaseTick: world.tick + spell.windup,
    phase: 'windup',
  });
  world.startCastAnimation(state, slot);
  primeSpellbladeOnCast(world, state);
  if (slot === 'r') world.onChampionUltimateCast(unit);
  world.emit('cast', unit, { unit: unit.id, team: unit.team, champion: unit.champion, text: slot });
  return true;
}

function canHit(world: World, source: TeamUnit, target: Unit) {
  return (
    target.team !== source.team &&
    !isStructureKind(target.kind) &&
    target.kind !== 'ward' &&
    world.vulnerable(target) &&
    (target.kind !== 'monster' || target.monster.phase !== 'returning')
  );
}

function areaHits(world: World, source: TeamUnit, cast: OriginalCast, spell: OriginalSpell) {
  if (spell.shape === 'line') {
    return world.units
      .flatMap((target) => {
        if (!canHit(world, source, target)) return [];
        const fraction = sweepCircle(cast.origin, cast.point, target, spell.radius + target.radius);
        return fraction === null ? [] : [{ target, fraction }];
      })
      .sort((a, b) => a.fraction - b.fraction || a.target.id - b.target.id)
      .slice(0, spell.first ? 1 : undefined)
      .map(({ target }) => target);
  }
  return world.units.filter((target) => {
    if (!canHit(world, source, target)) return false;
    const offset = distance(cast.point, target);
    return (
      offset <= spell.radius + target.radius &&
      (spell.shape !== 'ring' || offset + target.radius >= spell.radius * ORIGINAL_RING_INNER)
    );
  });
}

function creditSupport(world: World, source: TeamUnit, ally: Unit) {
  if (source.id === ally.id) return;
  const state = world.championState(ally.id);
  if (!state) return;
  const prior = state.supportContributors.find((entry) => entry.sourceId === source.id);
  if (prior) prior.lastSupportTick = world.tick;
  else state.supportContributors.push({ sourceId: source.id, lastSupportTick: world.tick });
}

function release(world: World, source: TeamUnit, cast: OriginalCast, spell: OriginalSpell) {
  if (spell.shape === 'dash') {
    const landing = world.battlefield.reachable(cast.point, source.radius, source.team);
    const end =
      distance(source, landing) <= spell.range + 1 &&
      world.battlefield.lineWalkable(source, landing, source.radius, source.team)
        ? landing
        : { x: source.x, y: source.y };
    world.setOrder(source, { type: 'idle' });
    Object.assign(source, end, { previous: { ...end } });
    cast.point = { ...end };
  } else if (spell.shape === 'self') {
    cast.point = { x: source.x, y: source.y };
  }
  world.emit('original-impact', cast.point, {
    unit: source.id,
    team: source.team,
    champion: source.champion,
    text: cast.slot,
  });
  const scaled = (base: number) => originalSpellAmount(base, cast.slot, cast.rank);
  if (spell.damage || spell.slow || spell.root) {
    for (const target of areaHits(world, source, cast, spell)) {
      if (spell.damage) {
        const ap = world.abilityPower(source);
        const adHybrid =
          source.champion === 'brannic' || source.champion === 'taviq'
            ? source.damage * 0.55
            : 0;
        const scaling = spell.physical
          ? source.damage * (cast.slot === 'r' ? 1.05 : 0.7)
          : Math.max(ap, adHybrid) * (cast.slot === 'r' ? 1.0 : 0.68);
        world.damage(
          source,
          target,
          scaled(spell.damage) + scaling,
          spell.physical ? 'physical' : 'magic',
          'ability'
        );
      }
      if (spell.root && world.alive(target)) world.applyRoot(target, spell.root);
      if (spell.slow && world.alive(target))
        world.applySlow(source, target, 'original', spell.slow, ORIGINAL_SLOW_MULTIPLIER);
    }
  }
  if (!spell.shield && !spell.heal) return;
  const recipients =
    spell.shape === 'self' || spell.shape === 'dash'
      ? [source]
      : world.units.filter(
          (unit) =>
            unit.team === source.team &&
            unit.kind === 'champion' &&
            world.alive(unit) &&
            distance(unit, cast.point) <= spell.radius + unit.radius
        );
  for (const ally of recipients) {
    if (spell.shield) {
      const hpBonus = spell.shape === 'self' ? source.maxHp * 0.09 : 0;
      world.applyShield(
        source,
        ally,
        scaled(spell.shield) + 0.55 * world.abilityPower(source) + hpBonus,
        150
      );
      creditSupport(world, source, ally);
    }
    if (
      spell.heal &&
      world.healUnit(ally, scaled(spell.heal) + 0.58 * world.abilityPower(source)) > 0
    )
      creditSupport(world, source, ally);
  }
}

export function advanceOriginalChampion(world: World, unit: Unit, state: ChampionState) {
  if (!isOriginalChampion(unit.champion) || !state.original || unit.team === 'neutral') return;
  const original = state.original;
  if (original.hitExpiry <= world.tick) {
    original.hits = 0;
    original.hitExpiry = 0;
  }
  original.casts = original.casts.filter(
    (cast) => world.tick < cast.releaseTick + ORIGINAL_EFFECT_TICKS
  );
  for (const cast of original.casts) {
    if (cast.phase !== 'windup') continue;
    const spell = ORIGINAL_LINEUP[unit.champion].spells[cast.slot];
    if (
      !world.alive(unit) ||
      disabled(unit, spell, world.tick) ||
      (state.itemState?.stasisUntilTick ?? 0) > world.tick
    ) {
      cast.phase = 'cancelled';
      continue;
    }
    if (world.tick === cast.releaseTick) {
      cast.phase = 'impact';
      release(world, unit, cast, spell);
    }
  }
}

export function originalBasicAttackBonus(
  world: World,
  unit: Unit,
  target: Unit,
  state: ChampionState
) {
  if (
    !world.alive(unit) ||
    unit.team === 'neutral' ||
    !state.original ||
    (target.kind !== 'champion' && target.kind !== 'monster') ||
    (target.kind === 'monster' && (target.monster.phase === 'returning' || target.maxHp < 500)) ||
    (unit.champion === 'taviq' && target.kind !== 'monster')
  )
    return 0;
  if (++state.original.hits < ORIGINAL_PASSIVE_HITS) {
    state.original.hitExpiry = world.tick + ORIGINAL_PASSIVE_EXPIRY;
    return 0;
  }
  state.original.hits = 0;
  state.original.hitExpiry = 0;
  if (unit.champion === 'brannic') world.applyShield(unit, unit, 105 + state.level * 15, 150);
  if (unit.champion === 'taviq') world.healUnit(unit, Math.round(36 + state.level * 5));
  if (unit.champion === 'irielle') state.cooldowns.q = Math.max(world.tick, state.cooldowns.q - 90);
  if (unit.champion === 'oona') {
    const recipient = world.units
      .filter(
        (ally) =>
          ally.kind === 'champion' &&
          ally.team === unit.team &&
          world.alive(ally) &&
          distance(unit, ally) <= 560 &&
          ally.hp < ally.maxHp
      )
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.id - b.id)[0];
    if (recipient && world.healUnit(recipient, Math.round(44 + state.level * 5.5)) > 0)
      creditSupport(world, unit, recipient);
  }
  return unit.champion === 'vess'
    ? Math.round(30 + state.level * 6.5 + unit.damage * 0.14)
    : 0;
}

export function planOriginalAbility(
  world: World,
  unit: TeamUnit,
  state: ChampionState,
  aim: (point: Vec2) => Vec2,
  retreat?: Vec2
) {
  if (
    !isOriginalChampion(unit.champion) ||
    !state.original ||
    state.recallEnd !== null ||
    state.original.casts.some((cast) => cast.phase === 'windup')
  )
    return false;
  const definition = ORIGINAL_LINEUP[unit.champion];
  const enemies = world.units.filter(
    (other) =>
      canHit(world, unit, other) && world.visible(other, unit.team) && distance(unit, other) <= 1250
  );
  const allies =
    definition.role === 'support'
      ? world.units.filter(
          (other) => other.kind === 'champion' && other.team === unit.team && world.alive(other)
        )
      : [unit];
  for (const slot of [...ORIGINAL_SLOTS].reverse()) {
    const spell = definition.spells[slot];
    if (
      !state.spellRanks[slot] ||
      state.cooldowns[slot] > world.tick ||
      unit.mana < spell.mana ||
      disabled(unit, spell, world.tick)
    )
      continue;
    const needsHelp = allies
      .filter(
        (ally) =>
          ally.hp / ally.maxHp < (slot === 'r' ? 0.62 : 0.79) &&
          distance(ally, unit) <= spell.range + spell.radius
      )
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.id - b.id)[0];
    const target = enemies
      .filter(
        (enemy) =>
          (enemy.kind === 'champion' ||
            (definition.role === 'jungle' &&
              enemy.kind === 'monster' &&
              distance(unit, enemy) <= 320) ||
            (slot === 'q' &&
              definition.role !== 'support' &&
              enemy.kind !== 'monster' &&
              distance(unit, enemy) <= 580)) &&
          distance(unit, enemy) <= (spell.shape === 'self' ? spell.radius : spell.range)
      )
      .sort(
        (a, b) =>
          Number(b.kind === 'champion') - Number(a.kind === 'champion') ||
          distance(unit, a) - distance(unit, b) ||
          a.id - b.id
      )[0];
    let point: Vec2 | undefined;
    if (spell.shape === 'dash') {
      if (retreat) point = retreat;
      else if (
        target?.kind === 'monster' &&
        definition.role === 'jungle' &&
        distance(unit, target) > unit.range
      )
        point = target;
      else if (
        spell.damage &&
        target?.kind === 'champion' &&
        unit.hp / unit.maxHp > 0.45 &&
        target.hp / target.maxHp < 0.85 &&
        distance(unit, target) <= spell.range + spell.radius * 0.5
      )
        point = aim(target);
      else continue;
    } else if (spell.heal || (spell.shield && !spell.damage)) {
      if (
        needsHelp &&
        (spell.heal ||
          target ||
          retreat ||
          (definition.role === 'support' &&
            enemies.some((enemy) => distance(needsHelp, enemy) < 520)))
      )
        point = needsHelp;
    } else if (
      target &&
      (!retreat || (spell.shape !== 'ring' && slot !== 'r' && target.kind === 'champion')) &&
      (slot !== 'r' || target.kind === 'champion')
    ) {
      const leadTicks = Math.min(spell.windup, 16) * 0.65;
      const predicted = {
        x: target.x + (target.x - target.previous.x) * leadTicks,
        y: target.y + (target.y - target.previous.y) * leadTicks,
      };
      point = aim(predicted);
      if (spell.shape === 'ring') {
        const toward = direction(predicted, unit);
        const radius = (spell.radius * (1 + ORIGINAL_RING_INNER)) / 2;
        point = { x: point.x + toward.x * radius, y: point.y + toward.y * radius };
      }
    }
    if (!point) continue;
    world.enqueue({
      type: 'cast',
      unit: unit.id,
      ability: slot,
      point: { x: point.x, y: point.y },
    });
    return true;
  }
  return false;
}
