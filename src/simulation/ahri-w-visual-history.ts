import type { FoxFire, FoxFireCast } from './ahri-fox-fires';
import type { Vec2 } from './math';
import type { Team } from './types';

export interface WVisualAnchor {
  tick: number;
  point: Vec2;
  audience: Team[];
}
export interface AhriWVisualHistory {
  id: number;
  sourceId: number;
  team: Team;
  startTick: number;
  releaseTick: number;
  facing: number;
  origin: Vec2;
  fires: {
    index: number;
    birth: WVisualAnchor;
    dispatch: (WVisualAnchor & { targetId: number; sourcePoint: Vec2 }) | null;
    end: (WVisualAnchor & { reason: NonNullable<FoxFire['stopReason']> | 'match-end' }) | null;
    frames: (WVisualAnchor & {
      phase: 'orbit' | 'flight';
      sourcePoint: Vec2;
      targetPoint: Vec2 | null;
    })[];
  }[];
}
export interface WVisualObserverWorld {
  tick: number;
  ahriWVisuals?: AhriWVisualHistory[];
  pointVisible?(point: Vec2, team: Team): boolean;
}
const copy = (p: Vec2): Vec2 => ({ x: p.x, y: p.y });
function anchor(w: WVisualObserverWorld, p: Vec2, owner: Team): WVisualAnchor {
  return {
    tick: w.tick,
    point: copy(p),
    audience: (['blue', 'red'] as Team[]).filter(
      (team) => team === owner || w.pointVisible?.(p, team)
    ),
  };
}
const record = (w: WVisualObserverWorld, cast: FoxFireCast) =>
  w.ahriWVisuals?.find((r) => r.id === cast.id);

/** Pure optional observer. No identity, random stream or gameplay mutation. */
export function beginWVisualHistory(w: WVisualObserverWorld, cast: FoxFireCast, source: Vec2) {
  if (!w.ahriWVisuals) return;
  if (record(w, cast)) throw new Error('Duplicate W visual cast');
  w.ahriWVisuals.push({
    id: cast.id,
    sourceId: cast.sourceId,
    team: cast.team,
    startTick: cast.startTick,
    releaseTick: cast.releaseTick,
    facing: cast.facing,
    origin: copy(source),
    fires: cast.fires.map((f) => ({
      index: f.index,
      birth: anchor(w, f.position, cast.team),
      dispatch: null,
      end: null,
      frames: [],
    })),
  });
}
/** Call before same-tick flight movement, preserving the actual birth root. */
export function dispatchWVisualHistory(
  w: WVisualObserverWorld,
  cast: FoxFireCast,
  fire: FoxFire,
  source: Vec2
) {
  const f = record(w, cast)?.fires.find((f) => f.index === fire.index);
  if (!f || f.end || f.dispatch) return;
  if (fire.targetId === null) throw new Error('W visual dispatch requires a committed target');
  f.dispatch = {
    ...anchor(w, fire.position, cast.team),
    targetId: fire.targetId,
    sourcePoint: copy(source),
  };
}
/** Call after motion and before damage callbacks can cancel other orbits. */
export function sampleWVisualHistory(
  w: WVisualObserverWorld,
  cast: FoxFireCast,
  fire: FoxFire,
  source: Vec2,
  target?: Vec2
) {
  const f = record(w, cast)?.fires.find((f) => f.index === fire.index);
  if (!f || f.end || fire.phase === 'spent') return;
  if (fire.phase === 'flight' && !target)
    throw new Error('W visual flight requires a target point');
  const previous = f.frames.at(-1);
  if (previous && previous.tick !== w.tick - 1)
    throw new Error('W visual frames require consecutive ticks');
  f.frames.push({
    ...anchor(w, fire.position, cast.team),
    phase: fire.phase,
    sourcePoint: copy(source),
    targetPoint: fire.phase === 'flight' ? copy(target!) : null,
  });
}
/** Terminal anchors are immutable, including repeated cancellation callbacks. */
export function endWVisualHistory(
  w: WVisualObserverWorld,
  cast: FoxFireCast,
  fire: FoxFire,
  reason: NonNullable<FoxFire['stopReason']> | 'match-end'
) {
  const f = record(w, cast)?.fires.find((f) => f.index === fire.index);
  if (f && !f.end) f.end = { ...anchor(w, fire.position, cast.team), reason };
}

/** Visibility refresh follows the normal sight calculation; no fog is inferred. */
export function refreshWVisualAudience(w: WVisualObserverWorld) {
  for (const r of w.ahriWVisuals ?? [])
    for (const f of r.fires)
      for (const a of [f.birth, f.dispatch, f.end, f.frames.at(-1)])
        if (a?.tick === w.tick) a.audience = anchor(w, a.point, r.team).audience;
}

/** Retention is supplied by the eventual renderer policy. Never remove an
 * active cast merely because one of its fires has already ended. */
export function pruneWVisualHistory(w: WVisualObserverWorld, retentionTicks: number) {
  if (!Number.isSafeInteger(retentionTicks) || retentionTicks < 1)
    throw new RangeError('Invalid W visual retention');
  if (!w.ahriWVisuals) return;
  w.ahriWVisuals = w.ahriWVisuals.filter((r) => {
    if (!r.fires.length || r.fires.some((f) => !f.end)) return true;
    const lastEnd = Math.max(...r.fires.map((f) => f.end!.tick));
    return w.tick < lastEnd + retentionTicks;
  });
}
