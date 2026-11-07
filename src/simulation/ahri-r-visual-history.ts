import type { Vec2 } from './math';
import type { Team, Unit } from './types';
import type { SpiritRush, SpiritBurst, SpiritBolt, SpiritReset } from './ahri-spirit-rush';
import { cloneAnimationTimeline, type AnimationTimeline } from './animation-timeline';
import { mobileRig, type MobileRig } from '../content/mobile-clip-durations';
import {
  AHRI_R_VISUAL_HISTORY_TICKS as RETAIN,
  AHRI_R_VISUAL_POSE_TICKS as POSES,
  ahriRSourcePoseTicks,
} from '../content/ahri-r-visual-timing';

export interface RVisualPose {
  tick: number;
  point: Vec2;
  facing: number;
  radius: number;
  audience: Team[];
  animationTimeline: AnimationTimeline | null;
}
export interface RVisualAnchor {
  tick: number;
  point: Vec2;
  audience: Team[];
}
export interface RVisualFrame extends RVisualAnchor {
  previous: Vec2;
}
export interface RVisualActorEnd {
  tick: number;
  reason: 'death' | 'removed';
  pose: RVisualPose;
}
export interface RVisualBolt {
  index: number;
  targetId: number;
  birth: RVisualAnchor;
  frames: RVisualFrame[];
  end: (RVisualAnchor & { reason: NonNullable<SpiritBolt['stopReason']> | 'match-end' }) | null;
  hit: { targetTeam: Unit['team']; targetRig: MobileRig | null; pose: RVisualPose } | null;
  targetFrames: RVisualPose[];
  targetEnd: RVisualActorEnd | null;
}
export interface RVisualBurst {
  index: number;
  rank: number;
  startTick: number;
  origin: Vec2;
  destination: Vec2;
  sourcePose: RVisualPose;
  dashFrames: RVisualFrame[];
  dashEnd:
    | (RVisualAnchor & {
        reason: NonNullable<SpiritBurst['stopReason']> | 'match-end';
        control: SpiritBurst['control'];
      })
    | null;
  bolts: RVisualBolt[];
}
export interface RVisualChange {
  tick: number;
  kind: 'cast' | 'essence';
  remainingCasts: number;
  windowEndTick: number;
  burstIndex: number | null;
  reset: SpiritReset | null;
  pose: RVisualPose;
}
export interface AhriRVisualHistory {
  id: number;
  sourceId: number;
  team: Team;
  startTick: number;
  initialWindowEndTick: number;
  initialRemainingCasts: number;
  windowEndTick: number;
  remainingCasts: number;
  birthPose: RVisualPose;
  end: (RVisualAnchor & { reason: 'expired' | 'death' | 'match-end'; pose: RVisualPose }) | null;
  sourceFrames: RVisualPose[];
  sourceEnd: RVisualActorEnd | null;
  changes: RVisualChange[];
  bursts: RVisualBurst[];
}
export interface RVisualObserverWorld {
  tick: number;
  winner?: Team | null;
  ahriRVisuals?: AhriRVisualHistory[];
  unit?(id: number): Unit | undefined;
  visible?(unit: Unit, team: Team): boolean;
  pointVisible?(point: Vec2, team: Team): boolean;
}
const teams: Team[] = ['blue', 'red'];
const xy = (p: Vec2): Vec2 => ({ x: p.x, y: p.y });
const pointAudience = (w: RVisualObserverWorld, p: Vec2, owner: Team) =>
  teams.filter((t) => t === owner || w.pointVisible?.(p, t));
const actorAudience = (w: RVisualObserverWorld, u: Unit) => {
  if (!w.visible) throw Error('R visual observer requires actor visibility');
  return teams.filter((t) => u.team === t || w.visible!(u, t));
};
function pose(w: RVisualObserverWorld, u: Unit): RVisualPose {
  return {
    tick: w.tick,
    point: xy(u),
    facing: u.facing,
    radius: u.radius,
    audience: actorAudience(w, u),
    animationTimeline: cloneAnimationTimeline(u.animationTimeline),
  };
}
const clonePose = (p: RVisualPose): RVisualPose => ({
  ...p,
  point: xy(p.point),
  audience: [...p.audience],
  animationTimeline: cloneAnimationTimeline(p.animationTimeline),
});
const anchor = (w: RVisualObserverWorld, p: Vec2, owner: Team): RVisualAnchor => ({
  tick: w.tick,
  point: xy(p),
  audience: pointAudience(w, p, owner),
});
function append<T extends { tick: number }>(frames: T[], frame: T) {
  const previous = frames.at(-1);
  if (previous && (frame.tick < previous.tick || frame.tick > previous.tick + 1))
    throw Error('Nonconsecutive Spirit Rush visual observation');
  if (previous?.tick === frame.tick) frames[frames.length - 1] = frame;
  else frames.push(frame);
}
function appendPose(frames: RVisualPose[], p: RVisualPose, retention = POSES) {
  append(frames, p);
  while (frames.length && frames[0].tick < p.tick - retention) frames.shift();
}
const sourcePoseTicks = (r: AhriRVisualHistory, tick: number) =>
  ahriRSourcePoseTicks(r.startTick, r.end?.tick ?? r.sourceEnd?.tick ?? null, tick);
const record = (w: RVisualObserverWorld, rush: SpiritRush) =>
  w.ahriRVisuals?.find((r) => r.id === rush.id);
const burstRecord = (w: RVisualObserverWorld, rush: SpiritRush, burst: SpiritBurst) =>
  record(w, rush)?.bursts.find((b) => b.index === burst.index);
function observeChange(
  w: RVisualObserverWorld,
  r: AhriRVisualHistory,
  rush: SpiritRush,
  source: Unit,
  kind: RVisualChange['kind'],
  burst: SpiritBurst | null,
  reset: SpiritReset | null
) {
  r.windowEndTick = rush.endTick;
  r.remainingCasts = rush.remainingCasts;
  r.changes.push({
    tick: w.tick,
    kind,
    remainingCasts: rush.remainingCasts,
    windowEndTick: rush.endTick,
    burstIndex: burst?.index ?? null,
    reset: reset ? { ...reset } : null,
    pose: pose(w, source),
  });
}
/** Called after the accepted cast's existing facing/state changes, before dash motion.
 * Every identity, rank, endpoint and counter is borrowed from actual gameplay. */
export function beginRVisualHistory(
  w: RVisualObserverWorld,
  rush: SpiritRush,
  burst: SpiritBurst,
  source: Unit
) {
  if (!w.ahriRVisuals) return;
  if (
    source.champion !== 'ahri' ||
    source.id !== rush.sourceId ||
    source.team !== rush.team ||
    burst.startTick !== w.tick ||
    rush.stopTick !== null ||
    rush.bursts[burst.index] !== burst
  )
    throw Error('Invalid Spirit Rush visual cast');
  let r = record(w, rush);
  if (!r) {
    if (burst.index !== 0 || rush.startTick !== w.tick)
      throw Error('Missing initial R visual cast');
    r = {
      id: rush.id,
      sourceId: source.id,
      team: rush.team,
      startTick: rush.startTick,
      initialWindowEndTick: rush.endTick,
      initialRemainingCasts: rush.remainingCasts,
      windowEndTick: rush.endTick,
      remainingCasts: rush.remainingCasts,
      birthPose: pose(w, source),
      end: null,
      sourceFrames: [],
      sourceEnd: null,
      changes: [],
      bursts: [],
    };
    w.ahriRVisuals.push(r);
  }
  if (r.end || r.bursts.some((b) => b.index === burst.index))
    throw Error('Duplicate or ended R visual cast');
  appendPose(r.sourceFrames, pose(w, source), sourcePoseTicks(r, w.tick));
  observeChange(w, r, rush, source, 'cast', burst, null);
  r.bursts.push({
    index: burst.index,
    rank: burst.rank,
    startTick: burst.startTick,
    origin: xy(burst.origin),
    destination: xy(burst.destination),
    sourcePose: pose(w, source),
    dashFrames: [{ ...anchor(w, burst.origin, rush.team), previous: xy(burst.origin) }],
    dashEnd: null,
    bolts: burst.bolts.map((b) => ({
      index: b.index,
      targetId: b.targetId,
      birth: anchor(w, b.position, rush.team),
      frames: [],
      end: null,
      hit: null,
      targetFrames: [],
      targetEnd: null,
    })),
  });
}
/** Actual reset facts remain distinct from an inferred native buff counter. */
export function observeRVisualReset(w: RVisualObserverWorld, rush: SpiritRush, reset: SpiritReset) {
  const r = record(w, rush);
  if (!r) return;
  const source = w.unit?.(rush.sourceId);
  if (
    !source ||
    reset.consumeTick !== w.tick ||
    rush.resets.at(-1) !== reset ||
    r.end ||
    r.changes.some((c) => c.reset?.essenceId === reset.essenceId)
  )
    throw Error('Invalid R visual reset');
  observeChange(w, r, rush, source, 'essence', null, reset);
}
export function sampleRVisualDash(
  w: RVisualObserverWorld,
  rush: SpiritRush,
  burst: SpiritBurst,
  source: Unit
) {
  const b = burstRecord(w, rush, burst);
  if (!b || b.dashEnd) return;
  const last = b.dashFrames.at(-1)!;
  append(b.dashFrames, {
    ...anchor(w, source, rush.team),
    previous: xy(last.tick === w.tick ? last.previous : last.point),
  });
}
/** Stop points precede Flash's teleport; no teleport segment is invented. */
export function endRVisualDash(
  w: RVisualObserverWorld,
  rush: SpiritRush,
  burst: SpiritBurst,
  source: Unit
) {
  const b = burstRecord(w, rush, burst);
  if (!b || b.dashEnd) return;
  if (burst.stopTick !== w.tick || !burst.stopReason || !burst.stopPoint)
    throw Error('Unstopped R visual dash');
  sampleRVisualDash(w, rush, burst, source);
  b.dashEnd = {
    ...anchor(w, burst.stopPoint, rush.team),
    reason: burst.stopReason,
    control: burst.control ? { ...burst.control } : null,
  };
}
export function sampleRVisualBolt(
  w: RVisualObserverWorld,
  rush: SpiritRush,
  burst: SpiritBurst,
  bolt: SpiritBolt
) {
  const b = burstRecord(w, rush, burst)?.bolts.find((b) => b.index === bolt.index);
  if (!b || b.end) return;
  append(b.frames, { ...anchor(w, bolt.position, rush.team), previous: xy(bolt.previous) });
}
/** Observe contact before damage callbacks change the target or retire other contexts. */
export function endRVisualBolt(
  w: RVisualObserverWorld,
  rush: SpiritRush,
  burst: SpiritBurst,
  bolt: SpiritBolt,
  target?: Unit
) {
  const b = burstRecord(w, rush, burst)?.bolts.find((b) => b.index === bolt.index);
  if (!b || b.end) return;
  if (
    bolt.stopTick !== w.tick ||
    !bolt.stopReason ||
    (bolt.stopReason === 'hit') !== !!target ||
    (target && target.id !== bolt.targetId)
  )
    throw Error('Invalid R visual bolt ending');
  sampleRVisualBolt(w, rush, burst, bolt);
  b.end = { ...anchor(w, bolt.position, rush.team), reason: bolt.stopReason };
  if (target) {
    b.hit = { targetTeam: target.team, targetRig: mobileRig(target), pose: pose(w, target) };
    appendPose(b.targetFrames, pose(w, target));
  }
}
function endActor(
  w: RVisualObserverWorld,
  frames: RVisualPose[],
  unit: Unit | undefined,
  reason: RVisualActorEnd['reason']
): RVisualActorEnd {
  if (unit) appendPose(frames, pose(w, unit));
  const last = frames.at(-1);
  if (!last) throw Error('Missing R visual actor ending root');
  return { tick: w.tick, reason, pose: clonePose(last) };
}
export function endRVisualTarget(
  w: RVisualObserverWorld,
  target: Unit,
  reason: RVisualActorEnd['reason']
) {
  for (const r of w.ahriRVisuals ?? [])
    for (const burst of r.bursts)
      for (const bolt of burst.bolts)
        if (
          bolt.hit &&
          bolt.targetId === target.id &&
          !bolt.targetEnd &&
          w.tick <= bolt.hit.pose.tick + RETAIN
        )
          bolt.targetEnd = endActor(w, bolt.targetFrames, target, reason);
}
export function endRVisualWindow(w: RVisualObserverWorld, rush: SpiritRush) {
  const r = record(w, rush);
  if (!r || r.end) return;
  if (rush.stopTick === null || !rush.stopReason) throw Error('Unstopped R visual window');
  const source = w.unit?.(rush.sourceId);
  r.windowEndTick = rush.endTick;
  r.remainingCasts = rush.remainingCasts;
  r.end = {
    ...anchor(w, source ?? r.sourceFrames.at(-1)!.point, r.team),
    tick: rush.stopTick,
    reason: rush.stopReason,
    pose: source ? pose(w, source) : clonePose(r.sourceFrames.at(-1)!),
  };
  if (rush.stopReason === 'death' && !r.sourceEnd)
    r.sourceEnd = endActor(w, r.sourceFrames, source, 'death');
}
/** Only actor observations are refreshed here; path/dispatch facts require their actual hooks. */
export function advanceRVisualHistory(w: RVisualObserverWorld) {
  for (const r of w.ahriRVisuals ?? []) {
    const source = w.unit?.(r.sourceId);
    if (!r.sourceEnd) {
      if (!source) r.sourceEnd = endActor(w, r.sourceFrames, undefined, 'removed');
      else if (source.hp <= 0) r.sourceEnd = endActor(w, r.sourceFrames, source, 'death');
      else appendPose(r.sourceFrames, pose(w, source), sourcePoseTicks(r, w.tick));
    }
    for (const burst of r.bursts)
      for (const bolt of burst.bolts) {
        if (!bolt.hit || bolt.targetEnd || w.tick > bolt.hit.pose.tick + RETAIN) continue;
        const target = w.unit?.(bolt.targetId);
        if (!target) bolt.targetEnd = endActor(w, bolt.targetFrames, undefined, 'removed');
        else if (target.hp <= 0) bolt.targetEnd = endActor(w, bolt.targetFrames, target, 'death');
        else appendPose(bolt.targetFrames, pose(w, target));
      }
  }
}
/** Normal sight refresh changes current observations, never old birth/root data. */
export function refreshRVisualAudience(w: RVisualObserverWorld) {
  const refreshPose = (frames: RVisualPose[], unit: Unit | undefined) => {
    const last = frames.at(-1);
    if (last?.tick === w.tick && unit)
      frames[frames.length - 1] = { ...last, audience: actorAudience(w, unit) };
  };
  const refreshAnchor = (a: RVisualAnchor | null, owner: Team) => {
    if (a?.tick === w.tick) a.audience = pointAudience(w, a.point, owner);
  };
  for (const r of w.ahriRVisuals ?? []) {
    refreshPose(r.sourceFrames, r.sourceEnd ? undefined : w.unit?.(r.sourceId));
    refreshAnchor(r.end, r.team);
    for (const burst of r.bursts) {
      refreshAnchor(burst.dashFrames.at(-1) ?? null, r.team);
      refreshAnchor(burst.dashEnd, r.team);
      for (const bolt of burst.bolts) {
        refreshAnchor(bolt.birth, r.team);
        refreshAnchor(bolt.frames.at(-1) ?? null, r.team);
        refreshAnchor(bolt.end, r.team);
        refreshPose(bolt.targetFrames, bolt.targetEnd ? undefined : w.unit?.(bolt.targetId));
      }
    }
  }
}
/** Match settlement adds anchors without manufacturing an unexecuted movement frame. */
export function finishAllRVisualHistory(w: RVisualObserverWorld) {
  for (const r of w.ahriRVisuals ?? []) {
    const source = w.unit?.(r.sourceId);
    if (!r.end) {
      r.end = {
        ...anchor(w, source ?? r.sourceFrames.at(-1)!.point, r.team),
        reason: 'match-end',
        pose: source ? pose(w, source) : clonePose(r.sourceFrames.at(-1)!),
      };
      r.remainingCasts = 0;
    }
    for (const burst of r.bursts) {
      burst.dashEnd ??= {
        ...anchor(w, source ?? burst.dashFrames.at(-1)!.point, r.team),
        reason: 'match-end',
        control: null,
      };
      for (const bolt of burst.bolts)
        if (!bolt.end)
          bolt.end = {
            ...anchor(w, bolt.frames.at(-1)?.point ?? bolt.birth.point, r.team),
            reason: 'match-end',
          };
    }
  }
}
export function rVisualBurstEndTick(burst: RVisualBurst): number {
  if (!burst.dashEnd || burst.bolts.some((b) => !b.end)) return Infinity;
  return Math.max(burst.dashEnd.tick, ...burst.bolts.map((b) => b.end!.tick));
}
export function rVisualEndTick(r: AhriRVisualHistory): number {
  return r.end ? Math.max(r.end.tick, ...r.bursts.map(rVisualBurstEndTick)) : Infinity;
}
/** Keep a charge epoch's birth pose even when it predates the rolling path.
 * Old completed bursts expire independently of an extended live window. */
export function pruneRVisualHistory(w: RVisualObserverWorld) {
  if (!w.ahriRVisuals) return;
  for (const r of w.ahriRVisuals) {
    const last = r.sourceFrames.at(-1)!;
    const retention = sourcePoseTicks(r, w.tick);
    while (r.sourceFrames[0].tick < last.tick - retention) r.sourceFrames.shift();
    r.bursts = r.bursts.filter((b) => w.tick < rVisualBurstEndTick(b) + RETAIN);
    let remove = 0;
    while (remove + 1 < r.changes.length && r.changes[remove + 1].tick < w.tick - POSES) remove++;
    if (remove) r.changes.splice(0, remove);
  }
  w.ahriRVisuals = w.ahriRVisuals.filter((r) => w.tick < rVisualEndTick(r) + RETAIN);
}
