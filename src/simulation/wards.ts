import type { World } from './world';
import type { TrinketState, Unit } from './types';
import type { Vec2 } from './math';
import { distance } from './math';
import { WARD_SOURCE as S, WARD_POLICY as P, wardScaling } from '../content/warding-totem';

export function newTrinket(tick = 0): TrinketState {
  return {
    createdTick: tick,
    charges: P.initialCharges,
    rechargeStartTick: tick,
    rechargeEndTick: tick + wardScaling(1).rechargeTicks,
    cooldownTick: 0,
    order: null,
  };
}
/** Practice tool: accepted placements retain their independent delivery. */
export function resetTrinket(s: TrinketState): void {
  s.charges = S.maxCharges;
  s.rechargeStartTick = null;
  s.rechargeEndTick = null;
  s.cooldownTick = 0;
}
export function averageChampionLevel(w: World): number {
  const champions = w.units.filter((u) => u.kind === 'champion');
  return (
    champions.reduce((sum, u) => sum + w.championState(u.id)!.level, 0) /
    Math.max(1, champions.length)
  );
}
export function wardError(w: World, u: Unit): string | null {
  const s = w.championState(u.id)?.trinket;
  if (!s || u.kind !== 'champion') return 'Only champions can place wards';
  if (w.winner || !w.alive(u)) return 'Cannot place a ward while dead';
  if (u.stunUntil > w.tick) return 'Cannot place a ward while stunned';
  if (s.charges === 0) return 'Stealth Ward has no charges';
  if (s.cooldownTick > w.tick) return 'Stealth Ward is cooling down';
  return null;
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
  if (s.charges === S.maxCharges) {
    s.rechargeStartTick = w.tick;
    s.rechargeEndTick = w.tick + wardScaling(averageChampionLevel(w)).rechargeTicks;
  }
  s.charges--;
  s.cooldownTick = w.tick + P.cooldownTicks;
  w.pendingWards.push({
    origin: { x: u.x, y: u.y },
    ownerId: u.id,
    team: u.team as 'blue' | 'red',
    point: destination,
    startTick: w.tick,
    readyTick: w.tick + P.placementTicks,
    lifeTicks: wardScaling(averageChampionLevel(w)).lifeTicks,
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
    // Local trinket reward override; no champion/minion CS, XP or kill credit.
    const owner = w.championState(source.id)!;
    owner.gold += P.killGold;
    w.emit('gold', target, { unit: source.id, team: source.team, value: P.killGold });
    target.hp = 1;
    endWard(w, target);
  }
}
export function advanceWards(w: World): void {
  for (const u of w.units) {
    if (u.kind === 'ward' && w.alive(u) && u.ward!.expireTick <= w.tick) endWard(w, u);
    const s = w.championState(u.id)?.trinket;
    if (!s) continue;
    while (s.rechargeEndTick !== null && w.tick >= s.rechargeEndTick) {
      s.charges++;
      const tick = s.rechargeEndTick;
      s.rechargeStartTick = s.charges === S.maxCharges ? null : tick;
      s.rechargeEndTick =
        s.charges === S.maxCharges
          ? null
          : tick + wardScaling(averageChampionLevel(w)).rechargeTicks;
    }
    if (!w.alive(u)) s.order = null;
    if (s.order && distance(u, s.order) <= S.range && !wardError(w, u)) requestWard(w, u, s.order);
  }
  const pending = w.pendingWards.filter((p) => p.readyTick <= w.tick);
  w.pendingWards = w.pendingWards.filter((p) => p.readyTick > w.tick);
  for (const p of pending) {
    const owned = w.units.filter(
      (u) => u.kind === 'ward' && u.ward!.ownerId === p.ownerId && w.alive(u)
    );
    if (owned.length >= S.maxPlaced)
      endWard(w, owned.sort((a, b) => a.ward!.createdTick - b.ward!.createdTick || a.id - b.id)[0]);
    w.spawnWard(p);
  }
}
