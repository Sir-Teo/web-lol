import type { AhriWVisualHistory, WVisualAnchor } from '../simulation/ahri-w-visual-history';
import type { Team } from '../simulation/types';
import type { SurfaceGroup } from './source-particle-surfaces';

export type WVisualRole = 'orbit' | 'flight' | 'hit';
type Fire = AhriWVisualHistory['fires'][number];
export interface WVisualGroup extends SurfaceGroup {
  role: WVisualRole;
  record: AhriWVisualHistory;
  fire: Fire;
}
/** Local dispatch from observed gameplay phases. Unjoined cast/weapon systems
 * are deliberately absent; no animation event or script callback is inferred. */
export function wVisualGroups(record: AhriWVisualHistory): WVisualGroup[] {
  return record.fires.flatMap((fire) => {
    const seed =
      record.id ^ Math.imul(record.startTick, 0x9e3779b9) ^ Math.imul(fire.index + 1, 0x85ebca6b);
    const base = { record, fire, radius: 1 };
    const prefix = record.id + ':' + fire.index;
    const groups: WVisualGroup[] = [
      {
        ...base,
        key: prefix + ':orbit',
        seed,
        role: 'orbit',
        startTick: record.startTick,
        stopTick: fire.dispatch?.tick ?? fire.end?.tick ?? Infinity,
      },
    ];
    if (fire.dispatch)
      groups.push({
        ...base,
        key: prefix + ':flight',
        seed: seed ^ 0xc2b2ae35,
        role: 'flight',
        startTick: fire.dispatch.tick,
        stopTick: fire.end?.tick ?? Infinity,
      });
    // The hit resource's authored emitter windows control its finite births.
    // No phase stop is invented at the impact tick itself.
    if (fire.end?.reason === 'hit')
      groups.push({
        ...base,
        key: prefix + ':hit',
        seed: seed ^ 0x27d4eb2f,
        role: 'hit',
        startTick: fire.end.tick,
        stopTick: Infinity,
      });
    return groups;
  });
}

function anchors(group: WVisualGroup): WVisualAnchor[] {
  const { fire, role } = group;
  if (role === 'hit') return fire.end ? [fire.end] : [];
  const birth = role === 'flight' ? fire.dispatch : fire.birth;
  if (!birth) return [];
  const points: WVisualAnchor[] = [{ ...birth, tick: birth.tick - 1 }];
  points.push(...fire.frames.filter((frame) => frame.phase === role));
  // The dispatch anchor is the orbit's endpoint, not its already-moved flight
  // sample. A cancelled orbit may have no sample on its final tick.
  if (role === 'orbit' && fire.dispatch) points.push(fire.dispatch);
  else if (fire.end && points.at(-1)!.tick < fire.end.tick) points.push(fire.end);
  return points;
}

interface PathCache {
  frames: number;
  dispatch: Fire['dispatch'];
  end: Fire['end'];
  birthAudience: Team[];
  dispatchAudience: Team[] | undefined;
  points: WVisualAnchor[];
  distances: Float64Array;
}
const paths = new WeakMap<Fire, Map<WVisualRole, PathCache>>();
/** Historical positions are append-only. Weak keys release replaced Worlds;
 * current birth/dispatch audience replacement also invalidates copied anchors. */
function path(group: WVisualGroup): PathCache {
  const f = group.fire;
  let roles = paths.get(f);
  if (!roles) {
    roles = new Map();
    paths.set(f, roles);
  }
  const old = roles.get(group.role);
  if (
    old &&
    old.frames === f.frames.length &&
    old.dispatch === f.dispatch &&
    old.end === f.end &&
    old.birthAudience === f.birth.audience &&
    old.dispatchAudience === f.dispatch?.audience
  )
    return old;
  const points = anchors(group),
    distances = new Float64Array(points.length);
  for (let i = 1; i < points.length; i++)
    distances[i] =
      distances[i - 1] +
      Math.hypot(
        points[i].point.x - points[i - 1].point.x,
        points[i].point.y - points[i - 1].point.y
      );
  const result = {
    frames: f.frames.length,
    dispatch: f.dispatch,
    end: f.end,
    birthAudience: f.birth.audience,
    dispatchAudience: f.dispatch?.audience,
    points,
    distances,
  };
  roles.set(group.role, result);
  return result;
}

function sample(group: WVisualGroup, tick: number) {
  if (!Number.isFinite(tick)) return null;
  const { points, distances } = path(group);
  if (!points.length) return null;
  const at = Math.max(points[0].tick, Math.min(points.at(-1)!.tick, tick));
  let low = 0,
    high = points.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].tick < at) low = middle + 1;
    else high = middle;
  }
  const index = low;
  const b = points[index],
    a = points[Math.max(0, index - 1)];
  const fraction = a.tick === b.tick ? 0 : (at - a.tick) / (b.tick - a.tick);
  return { points, distances, a, b, fraction, index };
}

export function wVisualPose(group: WVisualGroup, tick: number) {
  const s = sample(group, tick);
  if (!s) return null;
  const { a, b, fraction } = s;
  const previous = s.points[Math.max(0, s.index - 1)];
  let dx = b.point.x - previous.point.x,
    dy = b.point.y - previous.point.y;
  if (group.role === 'hit') {
    const last = group.fire.frames.at(-1);
    const dispatch = group.fire.dispatch;
    const from =
      last && dispatch && last.tick === dispatch.tick
        ? dispatch.point
        : group.fire.frames.at(-2)?.point;
    if (last && from) {
      dx = last.point.x - from.x;
      dy = last.point.y - from.y;
    }
  }
  const facing = dx === 0 && dy === 0 ? group.record.facing : Math.PI / 2 - Math.atan2(dy, dx);
  return {
    x: a.point.x + (b.point.x - a.point.x) * fraction,
    y: a.point.y + (b.point.y - a.point.y) * fraction,
    facing,
  };
}

/** Own roots stay known. Enemy unbound births require both sampled neighbours,
 * including the independently retained dispatch/root visibility. */
export function wVisualKnown(group: WVisualGroup, tick: number, team: Team = 'blue') {
  if (!Number.isFinite(tick)) return false;
  if (team === group.record.team) return true;
  const s = sample(group, tick);
  if (!s) return false;
  if (s.fraction === 1) return s.b.audience.includes(team);
  if (s.fraction === 0) return s.a.audience.includes(team);
  return s.a.audience.includes(team) && s.b.audience.includes(team);
}

/** Immutable phase path distance from actual samples; particle retirement does
 * not reset the trail's texture odometer. Source coordinates remain unscaled. */
export function wVisualDistance(group: WVisualGroup, tick: number) {
  const s = sample(group, tick);
  if (!s) return 0;
  return (
    s.distances[Math.max(0, s.index - 1)] +
    Math.hypot(s.b.point.x - s.a.point.x, s.b.point.y - s.a.point.y) * s.fraction
  );
}
