import type { AhriEVisualHistory, EVisualPose } from '../simulation/ahri-e-visual-history';
import type { Team } from '../simulation/types';
import type { SurfaceGroup } from './source-particle-surfaces';

export type EVisualRole = 'cast' | 'flight' | 'hit' | 'buff';
export interface EVisualGroup extends SurfaceGroup {
  role: EVisualRole;
  system: 'Ahri_E_cas' | 'Ahri_E_mis' | 'Ahri_E_tar' | 'Ahri_E_buf' | '{44fc6ec4}';
  record: AhriEVisualHistory;
}
/** Local dispatch from saved gameplay facts. Cast acceptance is the local birth
 * clock; native animation frame conversion and script callbacks are not inferred.
 * Cast/hit systems retain their authored finite emitter windows. */
export function eVisualGroups(record: AhriEVisualHistory): EVisualGroup[] {
  const seed = record.sourceId ^ Math.imul(record.castTick, 0x9e3779b9);
  const group = (
    role: EVisualRole,
    system: EVisualGroup['system'],
    startTick: number,
    stopTick: number,
    salt: number
  ): EVisualGroup => ({
    key: record.sourceId + ':' + record.castTick + ':' + system,
    role,
    system,
    record,
    startTick,
    stopTick,
    seed: seed ^ salt,
    radius:
      role === 'cast'
        ? record.sourceRadius
        : role === 'flight'
          ? record.launch!.radius
          : record.hit!.targetRadius,
  });
  const groups = [group('cast', 'Ahri_E_cas', record.castTick, record.cancel?.tick ?? Infinity, 0)];
  if (record.launch)
    groups.push(
      group('flight', 'Ahri_E_mis', record.launch.tick, record.stop?.tick ?? Infinity, 0x85ebca6b)
    );
  if (record.hit) groups.push(group('hit', 'Ahri_E_tar', record.hit.tick, Infinity, 0xc2b2ae35));
  if (record.buff) {
    const stop = record.buff.stop?.tick ?? record.buff.control.endTick;
    groups.push(group('buff', 'Ahri_E_buf', record.buff.control.startTick, stop, 0x27d4eb2f));
    groups.push(group('buff', '{44fc6ec4}', record.buff.control.startTick, stop, 0x165667b1));
  }
  return groups;
}

interface Path {
  points: EVisualPose[];
  distances: Float64Array;
  sourceLast: EVisualPose | undefined;
  targetLast: EVisualPose | undefined;
  flightLast: AhriEVisualHistory['flightFrames'][number] | undefined;
  launch: AhriEVisualHistory['launch'];
  stop: AhriEVisualHistory['stop'];
  launchAudience: Team[] | undefined;
  stopAudience: Team[] | undefined;
}
const paths = new WeakMap<AhriEVisualHistory, Map<EVisualRole, Path>>();
function path(group: EVisualGroup): Path {
  const r = group.record;
  let roles = paths.get(r);
  if (!roles) {
    roles = new Map();
    paths.set(r, roles);
  }
  const sourceLast = group.role === 'cast' ? r.sourceFrames.at(-1) : undefined,
    targetLast = group.role === 'hit' || group.role === 'buff' ? r.targetFrames.at(-1) : undefined,
    flightLast = group.role === 'flight' ? r.flightFrames.at(-1) : undefined,
    old = roles.get(group.role);
  if (
    old &&
    old.sourceLast === sourceLast &&
    old.targetLast === targetLast &&
    old.flightLast === flightLast &&
    old.launch === r.launch &&
    old.stop === r.stop &&
    old.launchAudience === r.launch?.audience &&
    old.stopAudience === r.stop?.audience
  )
    return old;
  let points: EVisualPose[];
  if (group.role === 'cast') points = r.sourceFrames;
  else if (group.role !== 'flight') points = r.targetFrames;
  else {
    const launch = r.launch!;
    const facing = Math.atan2(launch.direction.x, launch.direction.y);
    points = [
      {
        tick: launch.tick - 1,
        point: launch.point,
        facing,
        radius: launch.radius,
        audience: launch.audience,
      },
      ...r.flightFrames.map((frame) => ({ ...frame, facing, radius: launch.radius })),
    ];
    if (r.stop && points.at(-1)!.tick < r.stop.tick)
      points.push({ ...r.stop, facing, radius: launch.radius });
  }
  const distances = new Float64Array(points.length);
  for (let i = 1; i < points.length; i++)
    distances[i] =
      distances[i - 1] +
      Math.hypot(
        points[i].point.x - points[i - 1].point.x,
        points[i].point.y - points[i - 1].point.y
      );
  const result = {
    points,
    distances,
    sourceLast,
    targetLast,
    flightLast,
    launch: r.launch,
    stop: r.stop,
    launchAudience: r.launch?.audience,
    stopAudience: r.stop?.audience,
  };
  roles.set(group.role, result);
  return result;
}
function sample(group: EVisualGroup, tick: number) {
  if (!Number.isFinite(tick)) return null;
  const p = path(group),
    { points } = p;
  if (!points.length) return null;
  const at = Math.max(points[0].tick, Math.min(points.at(-1)!.tick, tick));
  let low = 0,
    high = points.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].tick < at) low = middle + 1;
    else high = middle;
  }
  const b = points[low],
    index = Math.max(0, low - 1),
    a = points[index];
  return { p, a, b, index, fraction: a.tick === b.tick ? 0 : (at - a.tick) / (b.tick - a.tick) };
}
/** Body roots remain distinct from missile contacts. Ended target paths clamp
 * to their saved old-body endpoint, including after removal or respawn. */
export function eVisualPose(group: EVisualGroup, tick: number) {
  const s = sample(group, tick);
  if (!s) return null;
  const { a, b, fraction } = s,
    angle = Math.atan2(Math.sin(b.facing - a.facing), Math.cos(b.facing - a.facing));
  return {
    x: a.point.x + (b.point.x - a.point.x) * fraction,
    y: a.point.y + (b.point.y - a.point.y) * fraction,
    facing: fraction === 0 ? a.facing : fraction === 1 ? b.facing : a.facing + angle * fraction,
    radius: a.radius + (b.radius - a.radius) * fraction,
  };
}
/** Target-root effects use target visibility even for the caster's own team.
 * Interpolation cannot admit a birth across a hidden neighbour. */
export function eVisualKnown(group: EVisualGroup, tick: number, team: Team = 'blue') {
  const s = sample(group, tick);
  if (!s) return false;
  if (s.fraction === 0) return s.a.audience.includes(team);
  if (s.fraction === 1) return s.b.audience.includes(team);
  return s.a.audience.includes(team) && s.b.audience.includes(team);
}
export function eVisualDistance(group: EVisualGroup, tick: number) {
  const s = sample(group, tick);
  if (!s) return 0;
  return (
    s.p.distances[s.index] +
    Math.hypot(s.b.point.x - s.a.point.x, s.b.point.y - s.a.point.y) * s.fraction
  );
}
