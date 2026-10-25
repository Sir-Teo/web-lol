import {
  SCUTTLER_SOURCE as SOURCE,
  SCUTTLER_POLICY as P,
  RIVER_SIDES,
  type RiverSide,
} from '../content/scuttler-policy';
import type { World } from './world';
import type { RiverScuttlers, Unit } from './types';
import type { Battlefield } from './battlefield';
import { distance, type Vec2 } from './math';

type Monster = Extract<Unit, { kind: 'monster' }>;
export function newRiverScuttlers(): RiverScuttlers {
  return {
    initialDeaths: 0,
    unitIds: { dragon: null, baron: null },
    pending: { side: 'both', readyTick: P.firstReadyTick, deathTick: null },
    streakSide: null,
    streakCount: 0,
    shrines: [],
    speedBuffs: [],
  };
}
export function riverContains(side: RiverSide, p: Vec2): boolean {
  const r = SOURCE.rivers[side],
    polygon = [...r.topBorder, ...[...r.bottomBorder].reverse()];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}
export function riverWaypoint(side: RiverSide, index: number, b: Battlefield): Vec2 {
  return b.reachable(SOURCE.rivers[side].path[index], SOURCE.pathfindingRadius, 'blue');
}
export function riverHome(side: RiverSide, b: Battlefield): Vec2 {
  return b.reachable(
    SOURCE.camps.find((c) => c.id === `${side}-scuttler`)!.point,
    SOURCE.pathfindingRadius,
    'blue'
  );
}
export function shrinePoint(side: RiverSide, b: Battlefield): Vec2 {
  return b.reachable(SOURCE.rivers[side].center, 0, 'blue');
}
export function advanceRiverScuttlers(w: World): void {
  const state = w.scuttlers;
  if (!state) return;
  state.shrines = state.shrines.filter((s) => s.endTick > w.tick);
  state.speedBuffs = state.speedBuffs.filter(
    (s) => s.endTick > w.tick && !!w.unit(s.unitId) && w.alive(w.unit(s.unitId)!)
  );
  const spawn = state.pending;
  if (spawn && w.tick >= spawn.readyTick - P.leadupTicks) {
    for (const side of spawn.side === 'both' ? RIVER_SIDES : [spawn.side]) {
      const u = w.spawnMonster(
        riverHome(side, w.battlefield),
        { startTick: spawn.readyTick - P.leadupTicks, readyTick: spawn.readyTick },
        'scuttler'
      );
      u.monster.scuttle = {
        river: side,
        destination: SOURCE.rivers[side].initialOneBasedDestination - 1,
        direction: -1,
        nextThinkTick: spawn.readyTick,
        grazeUntil: null,
        fleeUntil: null,
        lastDamageTick: null,
      };
      const face = SOURCE.camps.find((c) => c.id === `${side}-scuttler`)!.facingPoint;
      u.facing = Math.atan2(face.x - u.x, face.y - u.y);
      state.unitIds[side] = u.id;
    }
    state.pending = null;
  }
}
export function grantRiverSpeed(w: World): void {
  const state = w.scuttlers;
  if (!state) return;
  for (const u of w.units) {
    if (u.kind !== 'champion' || !w.alive(u)) continue;
    if (
      !state.shrines.some(
        (s) =>
          s.team === u.team &&
          s.endTick > w.tick &&
          distance(u, shrinePoint(s.river, w.battlefield)) <= P.shrineSpeedRadius
      )
    )
      continue;
    const old = state.speedBuffs.find((s) => s.unitId === u.id);
    if (old) old.endTick = w.tick + P.shrineLingerTicks;
    else
      state.speedBuffs.push({
        unitId: u.id,
        team: u.team as 'blue' | 'red',
        endTick: w.tick + P.shrineLingerTicks,
      });
  }
}
export function selectedRiver(
  streakSide: RiverSide | null,
  streakCount: number,
  roll: number
): RiverSide {
  const threshold = streakCount >= 4 ? (streakSide === 'dragon' ? 25 : 75) : 50;
  return roll <= threshold ? 'dragon' : 'baron';
}
export function scuttlerKilled(w: World, u: Monster, killer: Unit): void {
  const state = w.scuttlers,
    side = u.monster.scuttle?.river;
  if (!state || !side || state.unitIds[side] !== u.id) return;
  state.unitIds[side] = null;
  state.initialDeaths = Math.min(2, state.initialDeaths + 1);
  if (killer.team !== 'neutral') {
    state.shrines = state.shrines.filter((s) => s.river !== side);
    state.shrines.push({
      river: side,
      team: killer.team,
      startTick: w.tick,
      endTick: w.tick + P.shrineTicks,
    });
  }
  const next = selectedRiver(
    state.streakSide,
    state.streakCount,
    Math.floor(w.random.next() * 100) + 1
  );
  state.streakCount = state.streakSide === next ? state.streakCount + 1 : 1;
  state.streakSide = next;
  if (state.initialDeaths === 2)
    state.pending = { side: next, readyTick: w.tick + P.respawnTicks, deathTick: w.tick };
}
export function advanceScuttler(w: World, u: Monster, move: (u: Unit, p: Vec2) => void): void {
  const s = u.monster.scuttle!;
  u.releaseTick = null;
  u.attackTarget = null;
  u.attackCycle = null;
  if (u.monster.spawn) return;
  const target = u.monster.targetId === null ? undefined : w.unit(u.monster.targetId);
  const fleeing =
    s.fleeUntil !== null &&
    s.fleeUntil > w.tick &&
    target &&
    w.alive(target) &&
    distance(u, target) <= P.sightRadius &&
    w.battlefield.lineOfSight(u, target);
  if (!fleeing) {
    s.fleeUntil = null;
    u.monster.targetId = null;
    u.monster.phase = 'idle';
  } else u.monster.phase = 'engaged';
  if (s.lastDamageTick !== null && w.tick >= s.lastDamageTick + P.regenDelayTicks)
    u.hp = Math.min(u.maxHp, u.hp + (u.maxHp * P.regenFractionPerSecond) / 60);
  if (s.grazeUntil !== null && (fleeing || w.tick >= s.grazeUntil)) s.grazeUntil = null;
  if (u.rootUntil > w.tick || u.stunUntil > w.tick) {
    w.setOrder(u, { type: 'idle' });
    return;
  }
  // Keep lifecycle deadlines current while Charm owns movement and suppresses decisions.
  if (u.charm) return;
  if (s.grazeUntil !== null) return;
  if (w.tick >= s.nextThinkTick) {
    s.nextThinkTick = w.tick + P.thinkTicks;
    if (fleeing) {
      const angle = Math.atan2(u.x - target.x, u.y - target.y);
      const candidates = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2]
        .map((a) =>
          w.battlefield.reachable(
            {
              x: u.x + Math.sin(angle + a) * P.fleeDistance,
              y: u.y + Math.cos(angle + a) * P.fleeDistance,
            },
            SOURCE.pathfindingRadius,
            'blue'
          )
        )
        .filter(
          (p) =>
            riverContains(s.river, p) &&
            w.battlefield.lineWalkable(u, p, SOURCE.pathfindingRadius, 'blue')
        );
      const fallback = SOURCE.rivers[s.river].path
        .map((_, i) => riverWaypoint(s.river, i, w.battlefield))
        .filter((p) => riverContains(s.river, p));
      const point = (candidates.length ? candidates : fallback).sort(
        (a, b) => distance(b, target) - distance(a, target)
      )[0];
      if (point) w.setOrder(u, { type: 'move', point });
    } else {
      const point = riverWaypoint(s.river, s.destination, w.battlefield);
      if (distance(u, point) < 45) {
        if (s.destination === 0) s.direction = 1;
        else if (s.destination === SOURCE.rivers[s.river].path.length - 1) s.direction = -1;
        s.destination += s.direction;
        s.grazeUntil = w.tick + P.grazeTicks;
        w.setOrder(u, { type: 'idle' });
        return;
      }
      w.setOrder(u, { type: 'move', point });
    }
  }
  if (u.order.type === 'move') {
    const before = { x: u.x, y: u.y };
    move(u, u.order.point);
    if (!riverContains(s.river, u)) {
      Object.assign(u, before);
      u.path = [];
      s.nextThinkTick = w.tick + 1;
    }
  }
}
