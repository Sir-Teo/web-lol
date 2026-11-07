import type { Vec2 } from './math';
import type { Projectile, Team, Unit } from './types';

export interface EVisualPose {
  tick: number;
  point: Vec2;
  facing: number;
  radius: number;
  audience: Team[];
}
export interface EVisualFlightFrame {
  tick: number;
  previous: Vec2;
  point: Vec2;
  audience: Team[];
}
export type ECastCancelReason = 'death' | 'match-end' | 'no-launch' | 'source-removed';
export type EFlightEndReason = 'hit' | 'range' | 'match-end' | 'removed';
export type EBuffEndReason =
  'expired' | 'death' | 'replaced' | 'match-end' | 'control-ended' | 'removed';
export interface AhriEVisualHistory {
  sourceId: number;
  team: Team;
  rank: number;
  castTick: number;
  releaseTick: number;
  origin: Vec2;
  aim: Vec2;
  facing: number;
  sourceRadius: number;
  castAudience: Team[];
  cancel: { tick: number; reason: ECastCancelReason } | null;
  launch: {
    tick: number;
    projectileId: number;
    point: Vec2;
    direction: Vec2;
    speed: number;
    radius: number;
    range: number;
    audience: Team[];
  } | null;
  stop: { tick: number; point: Vec2; reason: EFlightEndReason; audience: Team[] } | null;
  hit: {
    tick: number;
    targetId: number;
    targetTeam: Unit['team'];
    point: Vec2;
    targetPoint: Vec2;
    targetFacing: number;
    targetRadius: number;
    audience: Team[];
    targetAudience: Team[];
  } | null;
  buff: {
    targetId: number;
    targetTeam: Unit['team'];
    control: NonNullable<Unit['charm']>;
    audience: Team[];
    stop: { tick: number; reason: EBuffEndReason } | null;
  } | null;
  sourceFrames: EVisualPose[];
  flightFrames: EVisualFlightFrame[];
  targetFrames: EVisualPose[];
  targetEnd: { tick: number; reason: 'death' | 'removed'; pose: EVisualPose } | null;
}
export interface EVisualObserverWorld {
  tick: number;
  winner?: Team | null;
  ahriEVisuals?: AhriEVisualHistory[];
  projectiles: Projectile[];
  unit(id: number): Unit | undefined;
  alive(unit: Unit): boolean;
  visible(unit: Unit, team: Team): boolean;
  pointVisible(point: Vec2, team: Team): boolean;
  championState(
    id: number
  ): { pendingCast: { ability: string; startTick: number } | null } | undefined;
}
const teams: Team[] = ['blue', 'red'];
const point = (value: Vec2): Vec2 => ({ x: value.x, y: value.y });
const pointAudience = (world: EVisualObserverWorld, value: Vec2, owner: Team) =>
  teams.filter((team) => team === owner || world.pointVisible(value, team));
const actorAudience = (world: EVisualObserverWorld, unit: Unit) =>
  teams.filter((team) => world.visible(unit, team));
function pose(world: EVisualObserverWorld, unit: Unit): EVisualPose {
  return {
    tick: world.tick,
    point: point(unit),
    facing: unit.facing,
    radius: unit.radius,
    audience: actorAudience(world, unit),
  };
}
/** Replacing a current-tick observation never rewrites an earlier frame object. */
function append<T extends { tick: number }>(frames: T[], frame: T) {
  const last = frames.at(-1);
  if (last && (frame.tick < last.tick || frame.tick > last.tick + 1))
    throw Error('Nonconsecutive Charm visual observation');
  if (last?.tick === frame.tick) frames[frames.length - 1] = frame;
  else frames.push(frame);
}
function flightRecord(world: EVisualObserverWorld, projectile: Projectile) {
  const record = world.ahriEVisuals?.find((r) => r.launch?.projectileId === projectile.id);
  if (
    record &&
    (projectile.type !== 'charm' ||
      projectile.source !== record.sourceId ||
      projectile.team !== record.team)
  )
    throw Error('Invalid Charm visual projectile identity');
  return record;
}
function targetPose(world: EVisualObserverWorld, record: AhriEVisualHistory, target?: Unit) {
  if (record.targetEnd) return;
  target ??= record.hit ? world.unit(record.hit.targetId) : undefined;
  if (target) append(record.targetFrames, pose(world, target));
}
export function beginEVisualHistory(
  world: EVisualObserverWorld,
  source: Unit,
  aim: Vec2,
  rank: number,
  releaseTick: number
): void {
  if (!world.ahriEVisuals) return;
  if (
    source.champion !== 'ahri' ||
    source.team === 'neutral' ||
    !Number.isInteger(rank) ||
    rank < 1 ||
    rank > 5 ||
    !Number.isSafeInteger(releaseTick) ||
    releaseTick < world.tick ||
    world.ahriEVisuals.some((r) => r.sourceId === source.id && r.castTick === world.tick)
  )
    throw Error('Invalid or duplicate Charm visual cast');
  world.ahriEVisuals.push({
    sourceId: source.id,
    team: source.team,
    rank,
    castTick: world.tick,
    releaseTick,
    origin: point(source),
    aim: point(aim),
    facing: source.facing,
    sourceRadius: source.radius,
    castAudience: actorAudience(world, source),
    cancel: null,
    launch: null,
    stop: null,
    hit: null,
    buff: null,
    sourceFrames: [pose(world, source)],
    flightFrames: [],
    targetFrames: [],
    targetEnd: null,
  });
}
export function cancelEVisualCast(
  world: EVisualObserverWorld,
  sourceId: number,
  reason: ECastCancelReason
) {
  for (const record of world.ahriEVisuals ?? [])
    if (record.sourceId === sourceId && !record.launch && !record.cancel)
      record.cancel = { tick: world.tick, reason };
}
export function launchEVisualHistory(
  world: EVisualObserverWorld,
  castTick: number,
  projectile: Projectile
) {
  const record = world.ahriEVisuals?.find(
    (r) => r.sourceId === projectile.source && r.castTick === castTick
  );
  if (!record) return;
  if (
    projectile.type !== 'charm' ||
    !projectile.origin ||
    record.cancel ||
    projectile.charmRank !== record.rank ||
    (record.launch && record.launch.projectileId !== projectile.id)
  )
    throw Error('Invalid Charm visual launch');
  if (record.launch) return;
  record.launch = {
    tick: world.tick,
    projectileId: projectile.id,
    point: point(projectile.origin),
    direction: point(projectile.direction),
    speed: projectile.speed,
    radius: projectile.radius,
    range: projectile.remaining,
    audience: pointAudience(world, projectile.origin, record.team),
  };
}
export function sampleEVisualFlight(
  world: EVisualObserverWorld,
  projectile: Projectile,
  value: Vec2 = projectile
) {
  const record = flightRecord(world, projectile);
  if (!record || record.stop) return;
  append(record.flightFrames, {
    tick: world.tick,
    previous: point(projectile.previous),
    point: point(value),
    audience: pointAudience(world, value, record.team),
  });
}
/** Contact is observed before damage; terminal removal does not invent a moved frame. */
export function endEVisualFlight(
  world: EVisualObserverWorld,
  projectile: Projectile,
  value: Vec2,
  reason: EFlightEndReason,
  target?: Unit
) {
  const record = flightRecord(world, projectile);
  if (!record || record.stop) return;
  if ((reason === 'hit') !== !!target) throw Error('Charm visual hit/target mismatch');
  if (reason === 'hit' || reason === 'range') sampleEVisualFlight(world, projectile, value);
  record.stop = {
    tick: world.tick,
    point: point(value),
    reason,
    audience: pointAudience(world, value, record.team),
  };
  if (target) {
    record.hit = {
      tick: world.tick,
      targetId: target.id,
      targetTeam: target.team,
      point: point(value),
      targetPoint: point(target),
      targetFacing: target.facing,
      targetRadius: target.radius,
      audience: pointAudience(world, value, record.team),
      targetAudience: actorAudience(world, target),
    };
    targetPose(world, record, target);
  }
}
function stopBuff(world: EVisualObserverWorld, record: AhriEVisualHistory, reason: EBuffEndReason) {
  if (!record.buff || record.buff.stop) return;
  if (reason === 'replaced' && world.tick >= record.buff.control.endTick) reason = 'expired';
  record.buff.stop = { tick: world.tick, reason };
  targetPose(world, record);
}
/** Call before the existing replacement/death API clears its current control. */
export function endEVisualBuffForTarget(
  world: EVisualObserverWorld,
  target: Unit,
  reason: EBuffEndReason
) {
  for (const record of world.ahriEVisuals ?? [])
    if (record.buff?.targetId === target.id) stopBuff(world, record, reason);
}
/** Call only after the existing applyCharm returned true. Copies its actual sampled control. */
export function attachEVisualBuff(
  world: EVisualObserverWorld,
  projectile: Projectile,
  target: Unit
) {
  const record = flightRecord(world, projectile);
  if (!record || !target.charm) return;
  if (record.buff) return;
  if (
    record.stop?.reason !== 'hit' ||
    record.hit?.targetId !== target.id ||
    target.charm.sourceId !== record.sourceId ||
    target.charm.rank !== record.rank ||
    target.charm.startTick !== world.tick
  )
    throw Error('Unlinked Charm visual control');
  endEVisualBuffForTarget(world, target, 'replaced');
  record.buff = {
    targetId: target.id,
    targetTeam: target.team,
    control: { ...target.charm },
    audience: actorAudience(world, target),
    stop: null,
  };
  targetPose(world, record, target);
}
function sameControl(a: NonNullable<Unit['charm']>, b: Unit['charm']) {
  return (
    b !== null &&
    a.sourceId === b.sourceId &&
    a.rank === b.rank &&
    a.startTick === b.startTick &&
    a.endTick === b.endTick &&
    a.tenacityApplied === b.tenacityApplied
  );
}
function endTarget(
  world: EVisualObserverWorld,
  record: AhriEVisualHistory,
  reason: 'death' | 'removed',
  target?: Unit
) {
  if (record.targetEnd) return;
  if (target) targetPose(world, record, target);
  const last = record.targetFrames.at(-1);
  if (!last) throw Error('Missing Charm visual target root');
  record.targetEnd = {
    tick: world.tick,
    reason,
    pose: { ...last, point: point(last.point), audience: [...last.audience] },
  };
  stopBuff(world, record, reason);
}
/** Preserve the old body's ending even if the same unit later respawns. */
export function endEVisualTarget(
  world: EVisualObserverWorld,
  target: Unit,
  reason: 'death' | 'removed'
) {
  for (const record of world.ahriEVisuals ?? [])
    if (record.hit?.targetId === target.id) endTarget(world, record, reason, target);
}
export function advanceEVisualHistory(world: EVisualObserverWorld) {
  for (const record of world.ahriEVisuals ?? []) {
    const source = world.unit(record.sourceId);
    if (source) append(record.sourceFrames, pose(world, source));
    if (!record.launch && !record.cancel) {
      const pending = world.championState(record.sourceId)?.pendingCast;
      if (pending?.ability !== 'e' || pending.startTick !== record.castTick)
        record.cancel = {
          tick: world.tick,
          reason: world.winner
            ? 'match-end'
            : !source
              ? 'source-removed'
              : !world.alive(source)
                ? 'death'
                : 'no-launch',
        };
    }
    if (record.launch && !record.stop) {
      const projectile = world.projectiles.find(
        (p) => p.id === record.launch!.projectileId && p.type === 'charm'
      );
      if (projectile) sampleEVisualFlight(world, projectile);
      else
        record.stop = {
          tick: world.tick,
          point: point(record.flightFrames.at(-1)?.point ?? record.launch.point),
          reason: world.winner ? 'match-end' : 'removed',
          audience: pointAudience(
            world,
            record.flightFrames.at(-1)?.point ?? record.launch.point,
            record.team
          ),
        };
    }
    if (record.hit && !record.targetEnd) {
      const target = world.unit(record.hit.targetId);
      if (!target) endTarget(world, record, 'removed');
      else if (!world.alive(target)) endTarget(world, record, 'death', target);
      else targetPose(world, record, target);
    }
    if (record.buff && !record.buff.stop) {
      const target = world.unit(record.buff.targetId);
      if (world.winner) stopBuff(world, record, 'match-end');
      else if (!target) stopBuff(world, record, 'removed');
      else if (!world.alive(target)) stopBuff(world, record, 'death');
      else if (!sameControl(record.buff.control, target.charm))
        stopBuff(
          world,
          record,
          world.tick >= record.buff.control.endTick
            ? 'expired'
            : target.charm
              ? 'replaced'
              : 'control-ended'
        );
    }
  }
}
export function refreshEVisualAudience(world: EVisualObserverWorld) {
  for (const record of world.ahriEVisuals ?? []) {
    const source = world.unit(record.sourceId);
    if (source && record.castTick === world.tick)
      record.castAudience = actorAudience(world, source);
    if (record.launch?.tick === world.tick)
      record.launch.audience = pointAudience(world, record.launch.point, record.team);
    if (record.stop?.tick === world.tick)
      record.stop.audience = pointAudience(world, record.stop.point, record.team);
    if (record.hit?.tick === world.tick) {
      record.hit.audience = pointAudience(world, record.hit.point, record.team);
      const target = world.unit(record.hit.targetId);
      if (target) record.hit.targetAudience = actorAudience(world, target);
    }
    if (record.targetEnd?.pose.tick === world.tick) {
      const target = record.hit && world.unit(record.hit.targetId);
      if (target)
        record.targetEnd.pose = {
          ...record.targetEnd.pose,
          audience: actorAudience(world, target),
        };
    }
    if (record.buff?.control.startTick === world.tick) {
      const target = world.unit(record.buff.targetId);
      if (target) record.buff.audience = actorAudience(world, target);
    }
    for (const [frames, actor] of [
      [record.sourceFrames, source],
      [record.targetFrames, record.hit ? world.unit(record.hit.targetId) : undefined],
    ] as const) {
      const last = frames.at(-1);
      if (last?.tick === world.tick && actor)
        frames[frames.length - 1] = { ...last, audience: actorAudience(world, actor) };
    }
    const last = record.flightFrames.at(-1);
    if (last?.tick === world.tick)
      record.flightFrames[record.flightFrames.length - 1] = {
        ...last,
        audience: pointAudience(world, last.point, record.team),
      };
  }
}
export function finishAllEVisualHistory(world: EVisualObserverWorld) {
  for (const record of world.ahriEVisuals ?? []) {
    if (!record.launch && !record.cancel) record.cancel = { tick: world.tick, reason: 'match-end' };
    if (record.launch && !record.stop) {
      const p = world.projectiles.find((p) => p.id === record.launch!.projectileId);
      const value = p ?? record.flightFrames.at(-1)?.point ?? record.launch.point;
      record.stop = {
        tick: world.tick,
        point: point(value),
        reason: 'match-end',
        audience: pointAudience(world, value, record.team),
      };
    }
    stopBuff(world, record, 'match-end');
  }
}
export function eVisualEndTick(record: AhriEVisualHistory) {
  if (
    (!record.launch && !record.cancel) ||
    (record.launch && !record.stop) ||
    (record.buff && !record.buff.stop)
  )
    return Infinity;
  return Math.max(
    record.castTick,
    record.cancel?.tick ?? 0,
    record.stop?.tick ?? 0,
    record.hit?.tick ?? 0,
    record.buff?.stop?.tick ?? 0
  );
}
export function pruneEVisualHistory(world: EVisualObserverWorld, retentionTicks: number) {
  if (!Number.isSafeInteger(retentionTicks) || retentionTicks <= 0)
    throw Error('Invalid Charm visual retention');
  if (world.ahriEVisuals)
    world.ahriEVisuals = world.ahriEVisuals.filter(
      (r) => world.tick < eVisualEndTick(r) + retentionTicks
    );
}
