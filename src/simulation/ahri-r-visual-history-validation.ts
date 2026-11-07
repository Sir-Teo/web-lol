import { AHRI_R } from '../content/ahri-r';
import { AHRI_R_POLICY as POLICY } from '../content/ahri-r-policy';
import {
  AHRI_R_VISUAL_HISTORY_TICKS as RETAIN,
  AHRI_R_VISUAL_POSE_TICKS as POSES,
  ahriRSourcePoseTicks,
} from '../content/ahri-r-visual-timing';
import { MOBILE_CLIP_DURATIONS, type MobileRig } from '../content/mobile-clip-durations';
import { validAnimationTimeline } from './animation-timeline';
import { direction, distance, type Vec2 } from './math';
import type { Team, Unit } from './types';
import {
  rVisualBurstEndTick,
  rVisualEndTick,
  type AhriRVisualHistory,
  type RVisualPose,
  type RVisualActorEnd,
} from './ahri-r-visual-history';
const same = (a: Vec2, b: Vec2) => distance(a, b) <= 1e-6;
const finite = (p: Vec2) => Number.isFinite(p.x) && Number.isFinite(p.y);
/** Validate owned observations without consulting a current Unit to reconstruct history. */
export function validateRVisualMotion(r: AhriRVisualHistory, now: number) {
  const check = (ok: boolean) => {
    if (!ok) throw Error('Invalid R visual motion history');
  };
  const clock = (t: number) => Number.isSafeInteger(t) && t >= r.startTick && t <= now;
  const audience = (a: Team[], owner?: Unit['team']) => {
    check(a.join() === (['blue', 'red'] as const).filter((t) => a.includes(t)).join());
    check(!owner || owner === 'neutral' || a.includes(owner));
  };
  const pose = (p: RVisualPose, rig: MobileRig | null, owner: Unit['team']) => {
    check(
      clock(p.tick) &&
        finite(p.point) &&
        Number.isFinite(p.facing) &&
        Number.isFinite(p.radius) &&
        p.radius > 0
    );
    check(
      validAnimationTimeline(
        p.animationTimeline,
        rig ? MOBILE_CLIP_DURATIONS[rig] : undefined,
        p.tick
      )
    );
    check(p.animationTimeline === null || p.animationTimeline.tick >= p.tick - 1);
    audience(p.audience, owner);
  };
  const poses = (
    frames: RVisualPose[],
    start: number,
    end: number,
    rig: MobileRig | null,
    owner: Unit['team'],
    retention = POSES
  ) => {
    check(frames.length === end - start + 1 && frames.length > 0 && frames.length <= retention + 1);
    frames.forEach((p, i) => {
      check(p.tick === start + i);
      pose(p, rig, owner);
    });
  };
  const actorEnd = (
    end: RVisualActorEnd,
    frames: RVisualPose[],
    rig: MobileRig | null,
    owner: Unit['team']
  ) => {
    check(clock(end.tick) && end.pose.tick <= end.tick && end.pose.tick >= end.tick - 1);
    pose(end.pose, rig, owner);
    check(JSON.stringify(end.pose) === JSON.stringify(frames.at(-1)));
  };
  check(Number.isSafeInteger(r.startTick) && r.startTick >= 1 && r.startTick <= now);
  check(
    r.initialWindowEndTick === r.startTick + POLICY.recastWindowTicks &&
      r.initialRemainingCasts === AHRI_R.maxCasts - 1
  );
  check(r.windowEndTick >= r.initialWindowEndTick);
  pose(r.birthPose, 'ahri-base', r.team);
  check(r.birthPose.tick === r.startTick);
  if (r.sourceEnd) actorEnd(r.sourceEnd, r.sourceFrames, 'ahri-base', r.team);
  const sourceLast = r.sourceEnd?.pose.tick ?? now;
  const sourceRetention = ahriRSourcePoseTicks(
    r.startTick,
    r.end?.tick ?? r.sourceEnd?.tick ?? null,
    now
  );
  poses(
    r.sourceFrames,
    Math.max(r.startTick, sourceLast - sourceRetention),
    sourceLast,
    'ahri-base',
    r.team,
    sourceRetention
  );
  if (r.end) {
    check(clock(r.end.tick) && same(r.end.point, r.end.pose.point));
    audience(r.end.audience, r.team);
    pose(r.end.pose, 'ahri-base', r.team);
    check(r.end.pose.tick <= r.end.tick && r.end.pose.tick >= r.end.tick - 1);
    check(r.remainingCasts === 0);
    if (r.end.reason === 'expired') check(r.end.tick === r.windowEndTick);
    else check(r.end.tick <= r.windowEndTick);
    if (r.end.reason === 'death')
      check(r.sourceEnd?.reason === 'death' && r.sourceEnd.tick === r.end.tick);
  } else check(now < r.windowEndTick && !r.sourceEnd);
  let previousChange: AhriRVisualHistory['changes'][number] | undefined,
    lastCast = -Infinity;
  const resetIds = new Set<number>();
  check(r.changes.length > 0);
  for (const c of r.changes) {
    check(clock(c.tick) && c.pose.tick === c.tick && c.windowEndTick >= r.initialWindowEndTick);
    pose(c.pose, 'ahri-base', r.team);
    if (previousChange) check(c.tick >= previousChange.tick);
    if (c.kind === 'cast') {
      check(
        c.burstIndex !== null && c.reset === null && c.tick >= lastCast + POLICY.recastLockoutTicks
      );
      lastCast = c.tick;
      if (previousChange)
        check(
          c.remainingCasts === previousChange.remainingCasts - 1 &&
            c.windowEndTick === previousChange.windowEndTick
        );
      const b = r.bursts.find((b) => b.index === c.burstIndex);
      if (b)
        check(b.startTick === c.tick && JSON.stringify(b.sourcePose) === JSON.stringify(c.pose));
      else check(c.tick <= now - POSES);
    } else {
      const e = c.reset;
      check(e !== null && c.burstIndex === null);
      check(!resetIds.has(e!.essenceId) && e!.consumeTick === c.tick && e!.spawnTick <= c.tick);
      resetIds.add(e!.essenceId);
      check(c.remainingCasts === e!.remaining && c.windowEndTick === e!.endTick);
      check(
        e!.endTick ===
          Math.max(
            e!.previousEndTick,
            c.tick + Math.round(AHRI_R.passiveDurationExtensionSeconds * 60)
          )
      );
      check(e!.remaining === Math.min(AHRI_R.maxCasts, e!.previousRemaining + AHRI_R.resetCasts));
      if (previousChange)
        check(
          e!.previousRemaining === previousChange.remainingCasts &&
            e!.previousEndTick === previousChange.windowEndTick
        );
    }
    if (c.tick === r.startTick)
      check(
        c.kind === 'cast' &&
          c.burstIndex === 0 &&
          c.remainingCasts === r.initialRemainingCasts &&
          c.windowEndTick === r.initialWindowEndTick
      );
    previousChange = c;
  }
  check(
    r.windowEndTick === previousChange!.windowEndTick &&
      (r.end !== null || r.remainingCasts === previousChange!.remainingCasts)
  );
  if (r.changes.length > 1) check(r.changes[1].tick >= now - POSES);
  let previousBurst = -1,
    previousBurstTick = -Infinity;
  for (const b of r.bursts) {
    check(
      b.index > previousBurst &&
        clock(b.startTick) &&
        b.startTick >= previousBurstTick + POLICY.recastLockoutTicks
    );
    previousBurst = b.index;
    previousBurstTick = b.startTick;
    check(
      Number.isInteger(b.rank) &&
        b.rank >= 1 &&
        b.rank <= 3 &&
        finite(b.origin) &&
        finite(b.destination)
    );
    const total = distance(b.origin, b.destination),
      dir = direction(b.origin, b.destination),
      duration = Math.ceil((total - POLICY.arrivalEpsilon) / (AHRI_R.baseDashSpeed / 60));
    check(
      total > 0 &&
        total <= AHRI_R.dashDistance + 1e-6 &&
        b.sourcePose.tick === b.startTick &&
        same(b.sourcePose.point, b.origin)
    );
    check(Math.abs(b.sourcePose.facing - Math.atan2(dir.x, dir.y)) <= 1e-12);
    pose(b.sourcePose, 'ahri-base', r.team);
    if (b.index === 0)
      check(
        b.startTick === r.startTick && JSON.stringify(b.sourcePose) === JSON.stringify(r.birthPose)
      );
    check(b.dashFrames.length > 0 && b.dashFrames.length <= duration);
    let point = b.origin;
    for (const [i, f] of b.dashFrames.entries()) {
      check(
        f.tick === b.startTick + i && clock(f.tick) && finite(f.point) && same(f.previous, point)
      );
      audience(f.audience, r.team);
      const endFrame = b.dashEnd && f.tick === b.dashEnd.tick && b.dashEnd.reason !== 'arrived';
      if (endFrame) check(same(f.point, b.dashEnd!.point));
      else {
        const travel = Math.min(total, ((f.tick - b.startTick + 1) * AHRI_R.baseDashSpeed) / 60);
        const expected =
          travel === total
            ? b.destination
            : { x: b.origin.x + dir.x * travel, y: b.origin.y + dir.y * travel };
        check(same(f.point, expected));
      }
      point = f.point;
    }
    const dashLast = b.dashFrames.at(-1)!;
    if (b.dashEnd) {
      const end = b.dashEnd;
      check(clock(end.tick) && end.tick >= b.startTick && end.tick <= b.startTick + duration - 1);
      check(same(end.point, point) && dashLast.tick <= end.tick && dashLast.tick >= end.tick - 1);
      audience(end.audience, r.team);
      check((end.reason === 'control') === (end.control !== null));
      if (end.control)
        check(
          Math.max(end.control.rootUntil, end.control.stunUntil, end.control.charmUntil) > end.tick
        );
      if (end.reason === 'arrived')
        check(end.tick === b.startTick + duration - 1 && same(end.point, b.destination));
      if (end.reason === 'death') check(r.sourceEnd?.tick === end.tick);
      if (end.reason !== 'match-end') check(dashLast.tick === end.tick);
    } else check(dashLast.tick === now && now < b.startTick + duration);
    const targets = new Set<number>();
    for (const [index, p] of b.bolts.entries()) {
      check(
        p.index === index &&
          !targets.has(p.targetId) &&
          p.birth.tick === b.startTick &&
          same(p.birth.point, b.origin)
      );
      targets.add(p.targetId);
      audience(p.birth.audience, r.team);
      check(p.frames.length <= POLICY.maximumBoltTicks + 1);
      let position = p.birth.point;
      for (const [i, f] of p.frames.entries()) {
        check(
          f.tick === b.startTick + i &&
            clock(f.tick) &&
            finite(f.point) &&
            same(f.previous, position)
        );
        audience(f.audience, r.team);
        const travel = distance(f.point, f.previous),
          step = AHRI_R.missile.speed / 60;
        if (p.end && f.tick === p.end.tick && ['lost-target', 'expired'].includes(p.end.reason))
          check(travel === 0);
        else if (p.end && f.tick === p.end.tick && p.end.reason === 'hit')
          check(travel <= step + 1e-6);
        else check(Math.abs(travel - step) <= 1e-6);
        position = f.point;
      }
      if (p.end) {
        check(
          clock(p.end.tick) &&
            p.end.tick >= b.startTick &&
            p.end.tick <= b.startTick + POLICY.maximumBoltTicks &&
            same(p.end.point, position)
        );
        audience(p.end.audience, r.team);
        if (p.end.reason === 'expired') check(p.end.tick === b.startTick + POLICY.maximumBoltTicks);
        if (p.end.reason === 'match-end')
          check((p.frames.at(-1)?.tick ?? b.startTick) >= p.end.tick - 1);
        else check(p.frames.at(-1)?.tick === p.end.tick);
      } else check(p.frames.at(-1)?.tick === now && now < b.startTick + POLICY.maximumBoltTicks);
      check((p.end?.reason === 'hit') === (p.hit !== null));
      if (p.hit) {
        check(p.hit.pose.tick === p.end!.tick && same(p.hit.pose.point, p.end!.point));
        pose(p.hit.pose, p.hit.targetRig, p.hit.targetTeam);
        if (p.targetEnd) actorEnd(p.targetEnd, p.targetFrames, p.hit.targetRig, p.hit.targetTeam);
        const last = p.targetEnd?.pose.tick ?? Math.min(now, p.hit.pose.tick + RETAIN);
        poses(p.targetFrames, p.hit.pose.tick, last, p.hit.targetRig, p.hit.targetTeam);
        if (p.targetEnd)
          check(
            p.targetEnd.tick >= p.hit.pose.tick && p.targetEnd.tick <= p.hit.pose.tick + RETAIN
          );
      } else check(p.targetFrames.length === 0 && p.targetEnd === null);
    }
    check(now < rVisualBurstEndTick(b) + RETAIN);
  }
  check(now < rVisualEndTick(r) + RETAIN);
}
