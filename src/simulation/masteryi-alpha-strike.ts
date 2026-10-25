import { MASTER_YI_Q } from '../content/masteryi-q';
import { TICK_RATE } from '../content/rules';
import { distance } from './math';
import { isStructureKind, type ChampionState, type Unit, type Order, type Team } from './types';
import type { Vec2 } from './math';
import type { World } from './world';

/** Local fixed-step reading of secondary behavior descriptions. These are not
 * the frozen child missile durations or recovered native callback deadlines. */
export const ALPHA_MARK_TICKS = 14;
export const ALPHA_RECOVERY_TICKS = 10;
export const ALPHA_BOUNCE_RANGE = 600;
export const ALPHA_FOLLOW_RANGE = 2000;
export const ALPHA_EXIT_DISTANCE = 75;

export interface AlphaStrikeMark {
  tick: number;
  targetId: number;
  point: Vec2;
  damage: number;
  onHitScale: number;
  critical: boolean;
  repeatIndex: number;
  result: 'pending' | 'hit' | 'lost';
}
export interface AlphaStrikeState {
  startTick: number;
  rank: number;
  origin: Vec2;
  primaryTargetId: number;
  primaryPoint: Vec2;
  nextMarkTick: number;
  lastTick: number;
  exitDirection: Vec2 | null;
  marks: AlphaStrikeMark[];
  reappearTick: number | null;
  endTick: number | null;
  returnPoint: Vec2 | null;
  stopReason: 'complete' | 'lost' | null;
  resumeOrder: Order | null;
}

export function alphaVanished(owner: ChampionState | undefined): boolean {
  return !!owner?.alphaStrike && owner.alphaStrike.reappearTick === null;
}
export function alphaTarget(world: World, source: Unit, target: Unit | undefined): target is Unit {
  return (
    !!target &&
    source.team !== target.team &&
    world.targetable(target) &&
    world.visible(target, source.team as Team) &&
    !isStructureKind(target.kind) &&
    target.kind !== 'ward' &&
    !(target.kind === 'monster' && target.monster.phase === 'returning')
  );
}
export function beginAlphaStrike(
  owner: ChampionState,
  unit: Unit,
  target: Unit,
  tick: number
): void {
  owner.alphaStrike = {
    startTick: tick,
    rank: owner.spellRanks.q,
    origin: { x: unit.x, y: unit.y },
    primaryTargetId: target.id,
    primaryPoint: { x: target.x, y: target.y },
    nextMarkTick: tick + ALPHA_MARK_TICKS,
    lastTick: tick,
    exitDirection: null,
    marks: [],
    reappearTick: null,
    endTick: null,
    returnPoint: null,
    stopReason: null,
    resumeOrder: null,
  };
  const child = owner.doubleStrike?.strike;
  if (child && child.poseStopTick === null) child.poseStopTick = tick;
}

/** Pause only the elapsed vanished interval, before ordinary buff expiry. */
export function settleAlphaStrike(world: World, owner: ChampionState, unit: Unit): void {
  const q = owner.alphaStrike;
  if (!q) return;
  if (unit.hp <= 0 || world.winner) {
    owner.alphaStrike = null;
    return;
  }
  const until = Math.min(world.tick, q.reappearTick ?? world.tick);
  const elapsed = until - q.lastTick;
  q.lastTick = until;
  if (elapsed <= 0) return;
  for (const buff of [owner.wujuStyle, owner.highlander])
    if (buff && buff.startTick < world.tick && buff.endTick >= world.tick) {
      buff.endTick += elapsed;
      buff.pausedTicks += elapsed;
    }
}

export function captureAlphaOrder(world: World, unit: Unit, order: Order): boolean {
  const q = world.championState(unit.id)?.alphaStrike;
  if (!q) return false;
  if (q.reappearTick !== null || order.type === 'idle') q.resumeOrder = structuredClone(order);
  else {
    const target = world.unit(q.primaryTargetId);
    const center = target ?? q.primaryPoint;
    const point = order.type === 'attack' ? world.unit(order.target) : order.point;
    if (point) {
      const dx = point.x - center.x,
        dy = point.y - center.y,
        length = Math.hypot(dx, dy);
      if (length > 0) q.exitDirection = { x: dx / length, y: dy / length };
    }
    q.resumeOrder = null;
  }
  return true;
}

function chooseTarget(world: World, unit: Unit, q: AlphaStrikeState): Unit | undefined {
  if (!q.marks.length) {
    const primary = world.unit(q.primaryTargetId);
    if (alphaTarget(world, unit, primary) && distance(q.origin, primary) <= ALPHA_FOLLOW_RANGE)
      return primary;
  }
  const last = q.marks.at(-1);
  const center = last ? (world.unit(last.targetId) ?? last.point) : q.primaryPoint;
  const eligible = world.units.filter(
    (t) =>
      alphaTarget(world, unit, t) &&
      distance(center, t) <= ALPHA_BOUNCE_RANGE &&
      distance(q.origin, t) <= ALPHA_FOLLOW_RANGE
  );
  const count = (id: number) => q.marks.filter((m) => m.targetId === id).length;
  const fresh = eligible.filter((t) => count(t.id) === 0);
  if (fresh.length)
    return fresh.sort((a, b) => distance(center, a) - distance(center, b) || a.id - b.id)[0];
  // Local repeat policy: balanced cycles in first-mark order, not random retargeting.
  return eligible.sort(
    (a, b) =>
      count(a.id) - count(b.id) ||
      q.marks.findIndex((m) => m.targetId === a.id) -
        q.marks.findIndex((m) => m.targetId === b.id) ||
      a.id - b.id
  )[0];
}
function resolve(world: World, unit: Unit, mark: AlphaStrikeMark): void {
  const target = world.unit(mark.targetId);
  mark.result =
    alphaTarget(world, unit, target) &&
    world.hitAlphaStrike(unit, target, mark.damage, mark.onHitScale)
      ? 'hit'
      : 'lost';
}
function reappear(
  world: World,
  unit: Unit,
  q: AlphaStrikeState,
  reason: 'complete' | 'lost'
): void {
  const target = world.unit(q.primaryTargetId);
  let point = q.origin;
  if (alphaTarget(world, unit, target) && distance(q.origin, target) <= ALPHA_FOLLOW_RANGE) {
    const d = q.exitDirection ?? { x: Math.sin(target.facing), y: Math.cos(target.facing) };
    point = world.battlefield.reachable(
      {
        x: target.x + d.x * ALPHA_EXIT_DISTANCE,
        y: target.y + d.y * ALPHA_EXIT_DISTANCE,
      },
      unit.radius,
      unit.team as Team
    );
  }
  q.returnPoint = { ...point };
  q.reappearTick = world.tick;
  q.endTick = world.tick + ALPHA_RECOVERY_TICKS;
  q.stopReason = reason;
  unit.x = point.x;
  unit.y = point.y;
  unit.previous = { ...point };
  unit.path = [];
  unit.runClock = null;
  if (target) unit.facing = Math.atan2(target.x - unit.x, target.y - unit.y);
  for (const mark of q.marks) if (mark.result === 'pending') resolve(world, unit, mark);
}

/** Committed Double Strike dispatch precedes this body/action lock. */
export function advanceAlphaStrike(world: World, unit: Unit): boolean {
  const owner = world.championState(unit.id)!,
    q = owner.alphaStrike;
  if (!q) return false;
  if (q.reappearTick !== null) {
    if (world.tick < q.endTick!) return true;
    const target = world.unit(q.primaryTargetId);
    const order =
      q.resumeOrder ??
      (alphaTarget(world, unit, target) && target.kind === 'champion'
        ? { type: 'attack' as const, target: target.id }
        : { type: 'idle' as const });
    owner.alphaStrike = null;
    world.setOrder(unit, order);
    return false;
  }
  if (world.tick < q.nextMarkTick) return true;
  const target = chooseTarget(world, unit, q);
  if (!target) {
    reappear(world, unit, q, 'lost');
    return true;
  }
  const repeatIndex = q.marks.filter((m) => m.targetId === target.id).length;
  const repeated = repeatIndex > 0 ? MASTER_YI_Q.subsequentHitMultiplier : 1;
  const chance = world.criticalChance(unit);
  const critical = chance > 0 && world.random.next() < chance;
  const multiplier = critical
    ? 1 + (world.basicAttackDamageMultiplier(unit, true) - 1) * MASTER_YI_Q.bonusCritDamageRatio
    : 1;
  // Local omitted-stat-formula convention: total AD, sampled separately at every mark.
  // Monster bonus scales with the same repeated-hit factor; no native order claim.
  const damage =
    (MASTER_YI_Q.baseDamageByRank[q.rank - 1] + unit.damage * MASTER_YI_Q.attackDamageRatio) *
      multiplier +
    (target.kind === 'monster' ? MASTER_YI_Q.bonusMonsterDamageByRank[q.rank - 1] : 0);
  const mark: AlphaStrikeMark = {
    tick: world.tick,
    targetId: target.id,
    point: { x: target.x, y: target.y },
    damage: damage * repeated,
    onHitScale: MASTER_YI_Q.onHitMultiplier * repeated,
    critical,
    repeatIndex,
    result: 'pending',
  };
  q.marks.push(mark);
  if (target.kind === 'champion') {
    // Secondary-reference assist eligibility begins at the local mark pulse,
    // before first-contact damage. Keep this out of execution/damage history.
    const contributors = world.championState(target.id)!.alphaMarkContributors;
    const entry = contributors.find((c) => c.sourceId === unit.id);
    if (entry) entry.lastMarkTick = world.tick;
    else contributors.push({ sourceId: unit.id, lastMarkTick: world.tick });
  }
  q.nextMarkTick += ALPHA_MARK_TICKS;
  if (repeatIndex > 0) resolve(world, unit, mark);
  if (q.marks.length === MASTER_YI_Q.bounceCount) reappear(world, unit, q, 'complete');
  return true;
}

export function reduceAlphaCooldown(world: World, unit: Unit): void {
  if (unit.champion !== 'masteryi') return;
  const owner = world.championState(unit.id)!;
  if (!owner.spellRanks.q || owner.cooldowns.q <= world.tick) return;
  const reduction = Math.ceil(
    (MASTER_YI_Q.basicAttackCooldownReductionSeconds * TICK_RATE * 100) /
      (100 + world.abilityHaste(unit.id))
  );
  owner.cooldowns.q = Math.max(world.tick, owner.cooldowns.q - reduction);
}

export function validateAlphaStrikes(
  owners: readonly Pick<
    ChampionState,
    'id' | 'spellRanks' | 'alphaStrike' | 'recallEnd' | 'meditate'
  >[],
  units: readonly Unit[],
  tick: number,
  winner: Team | null,
  nextId: number
): void {
  for (const owner of owners) {
    const q = owner.alphaStrike;
    if (!q) continue;
    const unit = units.find((u) => u.id === owner.id),
      primary = units.find((u) => u.id === q.primaryTargetId);
    const appeared = q.reappearTick !== null;
    const resume = q.resumeOrder;
    if (
      !unit ||
      unit.champion !== 'masteryi' ||
      unit.hp <= 0 ||
      winner ||
      q.rank > owner.spellRanks.q ||
      q.startTick > tick ||
      owner.recallEnd !== null ||
      owner.meditate?.stopTick === null ||
      unit.releaseTick !== null ||
      unit.order.type !== 'idle' ||
      (primary && primary.team === unit.team) ||
      q.primaryTargetId === owner.id ||
      q.primaryTargetId >= nextId ||
      distance(q.origin, q.primaryPoint) > MASTER_YI_Q.castRange ||
      q.nextMarkTick !== q.startTick + (q.marks.length + 1) * ALPHA_MARK_TICKS ||
      q.lastTick !== (q.reappearTick ?? tick) ||
      appeared !== (q.endTick !== null) ||
      appeared !== (q.returnPoint !== null) ||
      appeared !== (q.stopReason !== null) ||
      (!appeared && (q.marks.length >= MASTER_YI_Q.bounceCount || tick >= q.nextMarkTick)) ||
      (appeared &&
        (q.reappearTick! > tick ||
          tick >= q.endTick! ||
          q.endTick !== q.reappearTick! + ALPHA_RECOVERY_TICKS ||
          q.reappearTick! !==
            q.startTick + (q.marks.length + (q.stopReason === 'lost' ? 1 : 0)) * ALPHA_MARK_TICKS ||
          (q.stopReason === 'complete' && q.marks.length !== MASTER_YI_Q.bounceCount) ||
          (q.stopReason === 'lost' && q.marks.length >= MASTER_YI_Q.bounceCount))) ||
      (q.exitDirection !== null &&
        Math.abs(Math.hypot(q.exitDirection.x, q.exitDirection.y) - 1) > 1e-9) ||
      (!appeared && (unit.x !== q.origin.x || unit.y !== q.origin.y)) ||
      (appeared && (unit.x !== q.returnPoint!.x || unit.y !== q.returnPoint!.y)) ||
      (resume?.type === 'attack' &&
        (!units.some((u) => u.id === resume.target) || resume.target === unit.id))
    )
      throw new Error('Saved match contains invalid Alpha Strike phase.');
    const counts = new Map<number, number>();
    for (let i = 0; i < q.marks.length; i++) {
      const m = q.marks[i],
        count = counts.get(m.targetId) ?? 0;
      const target = units.find((u) => u.id === m.targetId);
      if (
        m.tick !== q.startTick + (i + 1) * ALPHA_MARK_TICKS ||
        m.tick > tick ||
        m.targetId === unit.id ||
        m.targetId >= nextId ||
        (target &&
          (target.team === unit.team || isStructureKind(target.kind) || target.kind === 'ward')) ||
        m.repeatIndex !== count ||
        m.onHitScale !==
          MASTER_YI_Q.onHitMultiplier * (count ? MASTER_YI_Q.subsequentHitMultiplier : 1) ||
        (m.result === 'pending') !== (count === 0 && !appeared)
      )
        throw new Error('Saved match contains invalid Alpha Strike marks.');
      counts.set(m.targetId, count + 1);
    }
  }
}
