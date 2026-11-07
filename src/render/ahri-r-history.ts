import type {
  AhriRVisualHistory,
  RVisualBolt,
  RVisualBurst,
  RVisualPose,
} from '../simulation/ahri-r-visual-history';
import type { Team } from '../simulation/types';
import type { SurfaceGroup } from './source-particle-surfaces';

export interface RVisualGroup extends SurfaceGroup {
  role: 'flight' | 'hit';
  system: 'Ahri_R_mis_02' | 'Ahri_R_Tar';
  record: AhriRVisualHistory;
  burst: RVisualBurst;
  bolt: RVisualBolt;
}
/** Local dispatch from observed bolt births and pre-damage contacts. Native
 * spell references identify these two systems; script callback timing is not
 * inferred. Persistent counter/skin producers and unjoined systems are absent. */
export function rVisualGroups(record: AhriRVisualHistory): RVisualGroup[] {
  return record.bursts.flatMap((burst) =>
    burst.bolts.flatMap((bolt) => {
      const prefix = `${record.id}:${burst.index}:${bolt.index}`;
      const seed =
        record.id ^
        Math.imul(burst.startTick, 0x9e3779b9) ^
        Math.imul(burst.index + 1, 0x85ebca6b) ^
        Math.imul(bolt.index + 1, 0xc2b2ae35);
      const groups: RVisualGroup[] = [
        {
          key: prefix + ':flight',
          role: 'flight',
          system: 'Ahri_R_mis_02',
          record,
          burst,
          bolt,
          startTick: bolt.birth.tick,
          stopTick: bolt.end?.tick ?? Infinity,
          // Local 100-unit bound-object default, independent of collision size.
          radius: 50,
          seed,
        },
      ];
      if (bolt.hit)
        groups.push({
          key: prefix + ':hit',
          role: 'hit',
          system: 'Ahri_R_Tar',
          record,
          burst,
          bolt,
          startTick: bolt.hit.pose.tick,
          // Authored finite emission windows control contact births.
          stopTick: Infinity,
          radius: bolt.hit.pose.radius,
          seed: seed ^ 0x27d4eb2f,
        });
      return groups;
    })
  );
}
interface Path {
  points: RVisualPose[];
  distances: Float64Array;
  last: RVisualBolt['frames'][number] | RVisualPose | undefined;
  lastAudience: Team[] | undefined;
  birthAudience: Team[];
  endAudience: Team[] | undefined;
  end: RVisualBolt['end'];
  hit: RVisualBolt['hit'];
  targetEnd: RVisualBolt['targetEnd'];
}
const paths = new WeakMap<RVisualBolt, Map<RVisualGroup['role'], Path>>();
function path(group: RVisualGroup): Path {
  const { bolt, role } = group;
  let roles = paths.get(bolt);
  if (!roles) paths.set(bolt, (roles = new Map()));
  const last = role === 'flight' ? bolt.frames.at(-1) : bolt.targetFrames.at(-1);
  const old = roles.get(role);
  if (
    old &&
    old.last === last &&
    old.lastAudience === last?.audience &&
    old.birthAudience === bolt.birth.audience &&
    old.endAudience === bolt.end?.audience &&
    old.end === bolt.end &&
    old.hit === bolt.hit &&
    old.targetEnd === bolt.targetEnd
  )
    return old;
  let points: RVisualPose[];
  if (role === 'hit') points = bolt.targetFrames;
  else {
    const facing = group.burst.sourcePose.facing;
    points = [
      {
        ...bolt.birth,
        tick: bolt.birth.tick - 1,
        facing,
        radius: 50,
        animationTimeline: null,
      },
      ...bolt.frames.map((frame) => ({
        ...frame,
        facing,
        radius: 50,
        animationTimeline: null,
      })),
    ];
    // A terminal cast can end before its first movement update. Add its actual
    // ending anchor without manufacturing a flight frame or travelled distance.
    if (bolt.end && points.at(-1)!.tick < bolt.end.tick)
      points.push({ ...bolt.end, facing, radius: 50, animationTimeline: null });
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
    last,
    lastAudience: last?.audience,
    birthAudience: bolt.birth.audience,
    endAudience: bolt.end?.audience,
    end: bolt.end,
    hit: bolt.hit,
    targetEnd: bolt.targetEnd,
  };
  roles.set(role, result);
  return result;
}
function sample(group: RVisualGroup, tick: number) {
  if (!Number.isFinite(tick)) return null;
  const p = path(group);
  // Contact birth uses the separately owned pre-damage pose, even if a lethal
  // callback replaced that tick's rolling target frame with its death pose.
  if (group.role === 'hit' && tick <= group.bolt.hit!.pose.tick) {
    const pose = group.bolt.hit!.pose;
    return { p, a: pose, b: pose, index: 0, fraction: 0 };
  }
  const { points } = p;
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
export function rVisualPose(group: RVisualGroup, tick: number) {
  const s = sample(group, tick);
  if (!s) return null;
  const { a, b, fraction } = s;
  const dx = b.point.x - a.point.x,
    dy = b.point.y - a.point.y;
  const angle = Math.atan2(Math.sin(b.facing - a.facing), Math.cos(b.facing - a.facing));
  return {
    x: a.point.x + dx * fraction,
    y: a.point.y + dy * fraction,
    facing:
      group.role === 'flight' && (dx !== 0 || dy !== 0)
        ? Math.atan2(dx, dy)
        : fraction === 0
          ? a.facing
          : fraction === 1
            ? b.facing
            : a.facing + angle * fraction,
    radius: a.radius + (b.radius - a.radius) * fraction,
  };
}
/** Hidden neighbouring observations cannot admit an interpolated birth. Hit
 * roots use the target's audience, independently of the caster's ownership. */
export function rVisualKnown(group: RVisualGroup, tick: number, team: Team = 'blue') {
  const s = sample(group, tick);
  if (!s) return false;
  if (s.fraction === 0) return s.a.audience.includes(team);
  if (s.fraction === 1) return s.b.audience.includes(team);
  return s.a.audience.includes(team) && s.b.audience.includes(team);
}
export function rVisualDistance(group: RVisualGroup, tick: number) {
  const s = sample(group, tick);
  if (!s) return 0;
  return (
    s.p.distances[s.index] +
    Math.hypot(s.b.point.x - s.a.point.x, s.b.point.y - s.a.point.y) * s.fraction
  );
}
export function rVisualAnimation(group: RVisualGroup, tick: number) {
  if (group.role === 'flight') return null;
  const s = sample(group, tick);
  if (!s) return null;
  return {
    at: s.a.tick + (s.b.tick - s.a.tick) * s.fraction,
    timeline: (s.fraction === 0 ? s.a : s.b).animationTimeline,
    rig: group.bolt.hit!.targetRig,
  };
}
