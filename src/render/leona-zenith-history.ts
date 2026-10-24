import type { ZenithPointFrame, ZenithVisual } from '../simulation/leona-e-visuals';
import type { LuxImpactFrame, Team } from '../simulation/types';
import type { ImpactRig } from '../content/impact-target';
import type { ZenithRole } from './leona-zenith-particles';

export type ZenithDrawFrame = ZenithPointFrame & Partial<LuxImpactFrame>;
export interface ZenithDrawGroup {
  key: string;
  role: ZenithRole;
  startTick: number;
  stopTick: number;
  radius: number;
  seed: number;
  rig: ImpactRig | null;
  frames: readonly ZenithDrawFrame[];
  audience: readonly Team[] | null;
}

/** Local phase routing, independent of live gameplay ownership. The source
 * declarations do not establish native script callbacks. Contact systems are
 * provisionally dispatched for every recorded eligible hit; audio is separate. */
export function zenithDrawGroups(sourceId: number, r: ZenithVisual): ZenithDrawGroup[] {
  const key = `${sourceId}:${r.startTick}`,
    seed = sourceId ^ Math.imul(r.startTick, 0x9e3779b9),
    groups: ZenithDrawGroup[] = [];
  if (r.flight) {
    const f = r.flight,
      facing = Math.atan2(r.direction.x, r.direction.y);
    groups.push({
      key: key + ':weapon',
      role: 'weapon',
      startTick: f.startTick,
      stopTick: f.stopTick ?? Infinity,
      radius: r.radius,
      seed,
      rig: null,
      // The pre-movement launch anchor is distinct from the first moving frame.
      frames: [
        { tick: f.startTick - 1, ...f.origin, facing, audience: f.audience },
        ...f.frames.map((p) => ({ ...p, facing })),
      ],
      audience: null,
    });
    for (const c of f.contacts) {
      const shared = {
        startTick: c.tick,
        stopTick: Infinity,
        radius: c.radius,
        seed: seed ^ Math.imul(c.targetId, 0x165667b1),
        rig: c.targetRig,
        frames: c.frames,
        audience: c.audience,
      };
      groups.push({ ...shared, key: `${key}:contact:${c.targetId}`, role: 'contact' });
      groups.push({
        ...shared,
        seed: shared.seed ^ 0x27d4eb2d,
        key: `${key}:sound:${c.targetId}`,
        role: 'sound',
      });
    }
  }
  if (r.dash) {
    const d = r.dash;
    groups.push({
      key: key + ':dash',
      role: 'dash',
      startTick: d.startTick,
      stopTick: d.stopTick ?? Infinity,
      radius: r.radius,
      seed: seed ^ 0x85ebca6b,
      rig: null,
      frames: r.frames,
      audience: d.startFrame.audience,
    });
  }
  if (r.arrival) {
    const a = r.arrival;
    groups.push({
      key: key + ':arrival',
      role: 'arrival',
      startTick: a.tick,
      stopTick: Infinity,
      radius: r.radius,
      seed: seed ^ 0xc2b2ae35,
      rig: 'leona-base',
      frames: a.frames,
      audience: r.dash!.stopFrame!.audience,
    });
  }
  return groups;
}

/** Finite events need their creation audience and each birth's historical
 * audience. A moving weapon may enter sight later without revealing old births.
 * Only finite events may borrow the frozen winning frame for delayed births. */
export function zenithBirthFrame(
  group: ZenithDrawGroup,
  bornTick: number,
  terminal: boolean,
  team: Team = 'blue'
): ZenithDrawFrame | null {
  if (group.audience !== null && !group.audience.includes(team)) return null;
  const tick = group.startTick + bornTick,
    first = group.frames[0],
    last = group.frames.at(-1)!;
  if (!first || !last) return null;
  let frame = group.frames[tick - first.tick];
  if (
    !frame &&
    terminal &&
    tick > last.tick &&
    group.audience !== null &&
    group.stopTick === Infinity
  )
    frame = last;
  return frame?.audience.includes(team) ? frame : null;
}

/** Bounded saved points interpolate placement and shortest-turn facing. Posed
 * contact/arrival frames retain detached animation clocks; no live unit is read. */
export function zenithPoseAt(frames: readonly ZenithDrawFrame[], tick: number) {
  if (!frames.length || !Number.isFinite(tick)) return null;
  const first = frames[0],
    last = frames.at(-1)!,
    at = Math.max(first.tick, Math.min(last.tick, tick)),
    i = Math.floor(at) - first.tick,
    before = frames[i],
    after = frames[Math.min(frames.length - 1, i + 1)],
    alpha = at - before.tick,
    timeline = before.animationTimeline ?? null;
  return {
    x: before.x + (after.x - before.x) * alpha,
    y: before.y + (after.y - before.y) * alpha,
    facing:
      before.facing +
      Math.atan2(Math.sin(after.facing - before.facing), Math.cos(after.facing - before.facing)) *
        alpha,
    timeline,
    poseTick: timeline && timeline.tick < before.tick ? timeline.tick : at,
  };
}

/** The complete flight path is retained independently of the rolling body
 * history, so a WAKE trail's odometer cannot reset after a long source seek. */
export function zenithPathDistance(group: ZenithDrawGroup, tick: number) {
  const frames = group.frames;
  if (!frames.length || tick <= frames[0].tick) return 0;
  let distance = 0;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1],
      b = frames[i],
      end = Math.min(tick, b.tick);
    distance += Math.hypot(b.x - a.x, b.y - a.y) * Math.max(0, (end - a.tick) / (b.tick - a.tick));
    if (tick <= b.tick) break;
  }
  return distance;
}
