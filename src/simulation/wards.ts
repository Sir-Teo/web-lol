import type { World } from './world';
import type { Team, Unit } from './types';
import type { Vec2 } from './math';
import { distance } from './math';
import {
  CONTROL_WARD_POLICY,
  FAELIGHT_POLICY,
  FARSIGHT_POLICY,
  matchingFaelight,
} from '../content/faelights';
import { maxControlWardsForQuest, maxStealthWardsForQuest } from '../content/role-quests';
import { WARD_SOURCE as S, WARD_POLICY as P, wardScaling } from '../content/warding-totem';
import { isElementalRiftTransformed } from './epic-objectives';
import { averageChampionLevel, spendTrinket, advanceTrinket, trinketError } from './trinkets';
export { newTrinket, resetTrinket, averageChampionLevel } from './trinkets';

export function wardError(w: World, u: Unit): string | null {
  return trinketError(w, u, 'ward');
}
export function farsightError(w: World, u: Unit): string | null {
  return trinketError(w, u, 'farsight');
}

function resolveFaelightId(w: World, point: Vec2): string | undefined {
  if (!w.battlefield.publicRift) return undefined;
  return matchingFaelight(point, isElementalRiftTransformed(w))?.id;
}

function applyFaelightBloom(
  w: World,
  team: Team,
  point: Vec2,
  faelightId: string | undefined
): void {
  if (!faelightId) return;
  w.visionAreas.push({
    x: point.x,
    y: point.y,
    radius: FAELIGHT_POLICY.bonusVisionRadius,
    kind: 'scout',
    team,
    endTick: w.tick + FAELIGHT_POLICY.bonusVisionTicks,
    unobstructed: true,
  });
}

export function requestWard(w: World, u: Unit, point: Vec2): string | null {
  const error = wardError(w, u);
  if (error) return error;
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    Math.abs(point.x) > w.battlefield.half ||
    Math.abs(point.y) > w.battlefield.half
  )
    return 'Choose a point on the battlefield';
  // Placement uses walkable ground. Exact native wall and brush nudging is open.
  const destination = w.battlefield.reachable(
    point,
    S.pathfindingRadius,
    u.team === 'neutral' ? undefined : u.team
  );
  const s = w.championState(u.id)!.trinket;
  if (distance(u, destination) > S.range) {
    w.setOrder(u, { type: 'move', point: destination });
    s.order = destination;
    return null;
  }
  if (s.order) w.setOrder(u, { type: 'idle' });
  s.order = null;
  spendTrinket(w, s);
  s.cooldownTick = w.tick + P.cooldownTicks;
  const faelightId = resolveFaelightId(w, destination);
  w.pendingWards.push({
    origin: { x: u.x, y: u.y },
    ownerId: u.id,
    team: u.team as 'blue' | 'red',
    point: destination,
    startTick: w.tick,
    readyTick: w.tick + P.placementTicks,
    lifeTicks: wardScaling(averageChampionLevel(w)).lifeTicks,
    ...(faelightId ? { faelightId } : {}),
  });
  return null;
}

export function requestFarsight(w: World, u: Unit, point: Vec2): string | null {
  const error = farsightError(w, u);
  if (error) return error;
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    Math.abs(point.x) > w.battlefield.half ||
    Math.abs(point.y) > w.battlefield.half
  )
    return 'Choose a point on the battlefield';
  let targetPoint = point;
  const d = distance(u, point);
  if (d > FARSIGHT_POLICY.range) {
    const scale = FARSIGHT_POLICY.range / d;
    targetPoint = {
      x: u.x + (point.x - u.x) * scale,
      y: u.y + (point.y - u.y) * scale,
    };
  }
  const destination = w.battlefield.reachable(
    targetPoint,
    S.pathfindingRadius,
    u.team === 'neutral' ? undefined : u.team
  );
  const s = w.championState(u.id)!.trinket;
  spendTrinket(w, s);
  s.cooldownTick = w.tick + FARSIGHT_POLICY.cooldownTicks;
  const team = u.team as Team;
  w.visionAreas.push({
    x: destination.x,
    y: destination.y,
    radius: FARSIGHT_POLICY.arrivalRevealRadius,
    kind: 'scout',
    team,
    endTick: w.tick + FARSIGHT_POLICY.arrivalRevealTicks,
    unobstructed: true,
  });
  const faelightId = resolveFaelightId(w, destination);
  w.pendingWards.push({
    origin: { x: u.x, y: u.y },
    ownerId: u.id,
    team,
    point: destination,
    startTick: w.tick,
    readyTick: w.tick + FARSIGHT_POLICY.placementTicks,
    lifeTicks: Infinity,
    variant: 'farsight',
    ...(faelightId ? { faelightId } : {}),
  });
  return null;
}

export function requestControlWard(w: World, u: Unit, point: Vec2): string | null {
  if (w.winner || !w.alive(u) || u.kind !== 'champion') return 'Cannot place Control Ward';
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    Math.abs(point.x) > w.battlefield.half ||
    Math.abs(point.y) > w.battlefield.half
  )
    return 'Choose a point on the battlefield';
  let targetPoint = point;
  const d = distance(u, point);
  if (d > CONTROL_WARD_POLICY.range) {
    const scale = CONTROL_WARD_POLICY.range / d;
    targetPoint = {
      x: u.x + (point.x - u.x) * scale,
      y: u.y + (point.y - u.y) * scale,
    };
  }
  const destination = w.battlefield.reachable(targetPoint, S.pathfindingRadius, u.team);
  const faelightId = resolveFaelightId(w, destination);
  w.pendingWards.push({
    origin: { x: u.x, y: u.y },
    ownerId: u.id,
    team: u.team,
    point: destination,
    startTick: w.tick,
    readyTick: w.tick + CONTROL_WARD_POLICY.placementTicks,
    lifeTicks: Infinity,
    variant: 'control',
    ...(faelightId ? { faelightId } : {}),
  });
  return null;
}
export function endWard(w: World, u: Unit): void {
  if (u.kind !== 'ward' || !w.alive(u)) return;
  u.hp = 0;
  u.deadAt = w.tick;
  u.order = { type: 'idle' };
  w.emit('death', u, { unit: u.id, team: u.team });
}
export function hitWard(w: World, source: Unit, target: Unit): void {
  if (source.kind !== 'champion' || source.team === target.team || !w.alive(target)) return;
  target.ward!.revealUntil = Math.max(target.ward!.revealUntil, w.tick + P.revealTicks);
  target.hp--;
  w.emit('damage', target, { unit: target.id, team: source.team, value: 1 });
  if (target.hp === 0) {
    const bounty = target.goldBounty ?? P.killGold;
    const owner = w.championState(source.id)!;
    owner.gold += bounty;
    w.emit('gold', target, { unit: source.id, team: source.team, value: bounty });
    target.hp = 1;
    endWard(w, target);
  }
}
export function advanceWards(w: World): void {
  for (const u of w.units) {
    if (u.kind === 'ward' && w.alive(u) && u.ward!.expireTick <= w.tick) endWard(w, u);
    const s = w.championState(u.id)?.trinket;
    if (!s) continue;
    advanceTrinket(w, u, s);
    if (s.order && distance(u, s.order) <= S.range && !wardError(w, u)) requestWard(w, u, s.order);
  }
  const pending = w.pendingWards.filter((p) => p.readyTick <= w.tick);
  w.pendingWards = w.pendingWards.filter((p) => p.readyTick > w.tick);
  for (const p of pending) {
    const ownerState = w.championState(p.ownerId);
    if (p.variant === 'control') {
      const maxCtrl = maxControlWardsForQuest(ownerState?.roleQuest);
      const ownedCtrl = w.units.filter(
        (u) =>
          u.kind === 'ward' &&
          u.ward!.ownerId === p.ownerId &&
          u.ward!.variant === 'control' &&
          w.alive(u)
      );
      if (ownedCtrl.length >= maxCtrl)
        endWard(
          w,
          ownedCtrl.sort((a, b) => a.ward!.createdTick - b.ward!.createdTick || a.id - b.id)[0]
        );
    } else if (!p.variant) {
      const maxStealth = maxStealthWardsForQuest(ownerState?.roleQuest, S.maxPlaced);
      const owned = w.units.filter(
        (u) => u.kind === 'ward' && u.ward!.ownerId === p.ownerId && !u.ward!.variant && w.alive(u)
      );
      if (owned.length >= maxStealth)
        endWard(
          w,
          owned.sort((a, b) => a.ward!.createdTick - b.ward!.createdTick || a.id - b.id)[0]
        );
    }
    w.spawnWard(p);
    applyFaelightBloom(w, p.team, p.point, p.faelightId);
  }
}
