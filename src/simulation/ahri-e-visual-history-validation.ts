import { AHRI_E } from '../content/ahri-e';
import { AHRI_E_POLICY } from '../content/ahri-e-policy';
import { GAREN_W } from '../content/garen-w';
import { DT, TICK_RATE } from '../content/rules';
import { direction, distance, sweepCircle, type Vec2 } from './math';
import type { Team, Unit } from './types';
import type { AhriEVisualHistory, EVisualPose } from './ahri-e-visual-history';

/** Replay retained linear flight and control clocks. Live entities, audio and
 * global identities are checked separately at World restore. */
export function validateEVisualMotion(record: AhriEVisualHistory, tick: number) {
  const check = (ok: boolean): void => {
    if (!ok) throw Error('Invalid E visual motion history');
  };
  const finite = (p: Vec2) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const same = (a: Vec2, b: Vec2) => finite(a) && finite(b) && distance(a, b) <= 1e-6;
  const clock = (value: number) =>
    Number.isSafeInteger(value) && value >= record.castTick && value <= tick;
  const audience = (value: Team[], owner?: Unit['team']) => {
    check(Array.isArray(value));
    const canonical = (['blue', 'red'] as const).filter((team) => value.includes(team));
    check(
      value.join() === canonical.join() && (!owner || owner === 'neutral' || value.includes(owner))
    );
  };
  const poses = (frames: EVisualPose[], start: number, owner: Unit['team']) => {
    check(frames.length > 0 && frames.length <= 512);
    for (const [index, frame] of frames.entries()) {
      check(
        frame.tick === start + index &&
          clock(frame.tick) &&
          finite(frame.point) &&
          Number.isFinite(frame.facing) &&
          Number.isFinite(frame.radius) &&
          frame.radius > 0
      );
      audience(frame.audience, owner);
    }
  };
  check(Number.isSafeInteger(record.castTick) && record.castTick >= 1 && record.castTick <= tick);
  check(Number.isInteger(record.rank) && record.rank >= 1 && record.rank <= 5);
  check(record.releaseTick === record.castTick + AHRI_E_POLICY.windupTicks);
  check(
    finite(record.origin) &&
      finite(record.aim) &&
      Number.isFinite(record.facing) &&
      Number.isFinite(record.sourceRadius) &&
      record.sourceRadius > 0
  );
  const acceptedDirection = direction(record.origin, record.aim);
  check(
    Math.hypot(acceptedDirection.x, acceptedDirection.y) > 0 &&
      Math.abs(record.facing - Math.atan2(acceptedDirection.x, acceptedDirection.y)) <= 1e-12
  );
  audience(record.castAudience, record.team);
  poses(record.sourceFrames, record.castTick, record.team);
  if (!record.launch) {
    check(
      !record.stop &&
        !record.hit &&
        !record.buff &&
        record.flightFrames.length === 0 &&
        record.targetFrames.length === 0
    );
    if (record.cancel) {
      check(clock(record.cancel.tick) && record.cancel.tick <= record.releaseTick);
      if (record.cancel.reason === 'no-launch') check(record.cancel.tick === record.releaseTick);
    } else check(tick < record.releaseTick);
    return { point: null, previous: null, remaining: null };
  }
  const launch = record.launch;
  check(!record.cancel && clock(launch.tick) && launch.tick === record.releaseTick);
  check(
    Number.isSafeInteger(launch.projectileId) &&
      launch.projectileId > 0 &&
      finite(launch.point) &&
      finite(launch.direction)
  );
  check(
    same(launch.direction, direction(launch.point, record.aim)) &&
      Math.abs(Math.hypot(launch.direction.x, launch.direction.y) - 1) <= 1e-9
  );
  check(
    launch.speed === AHRI_E.missile.speed &&
      launch.radius === AHRI_E_POLICY.radius &&
      launch.range === AHRI_E_POLICY.range
  );
  audience(launch.audience, record.team);
  check(record.flightFrames.length <= Math.ceil(launch.range / (launch.speed * DT)));
  let position = launch.point,
    previous = launch.point,
    remaining: number = launch.range;
  for (const [index, frame] of record.flightFrames.entries()) {
    check(
      frame.tick === launch.tick + index &&
        clock(frame.tick) &&
        finite(frame.previous) &&
        finite(frame.point)
    );
    audience(frame.audience, record.team);
    check(
      same(frame.previous, position) &&
        remaining > 1e-8 &&
        (!record.stop || frame.tick <= record.stop.tick)
    );
    previous = position;
    const travel = Math.min(launch.speed * DT, remaining);
    const end = {
      x: position.x + launch.direction.x * travel,
      y: position.y + launch.direction.y * travel,
    };
    if (record.stop?.reason === 'hit' && frame.tick === record.stop.tick) {
      const hit = record.hit;
      check(!!hit);
      const fraction =
        hit && sweepCircle(position, end, hit.targetPoint, launch.radius + hit.targetRadius);
      check(fraction !== null && fraction !== undefined);
      check(
        same(frame.point, {
          x: position.x + (end.x - position.x) * fraction!,
          y: position.y + (end.y - position.y) * fraction!,
        })
      );
    } else {
      check(same(frame.point, end));
      remaining = Math.max(0, remaining - travel);
    }
    position = frame.point;
  }
  const last = record.flightFrames.at(-1);
  if (!record.stop) {
    check(
      last?.tick === tick &&
        remaining > 1e-8 &&
        !record.hit &&
        !record.buff &&
        record.targetFrames.length === 0
    );
    return { point: position, previous, remaining };
  }
  const stop = record.stop;
  check(clock(stop.tick) && stop.tick >= launch.tick && same(stop.point, position));
  audience(stop.audience, record.team);
  if (stop.reason === 'range' || stop.reason === 'hit') check(last?.tick === stop.tick);
  else
    check(
      stop.tick >= (last?.tick ?? launch.tick) && stop.tick <= (last?.tick ?? launch.tick - 1) + 1
    );
  if (stop.reason === 'range') check(remaining <= 1e-8);
  if (stop.reason === 'removed') check(remaining > 1e-8);
  if (stop.reason !== 'hit') {
    check(!record.hit && !record.buff && record.targetFrames.length === 0);
    return { point: position, previous, remaining };
  }
  const hit = record.hit;
  check(!!hit);
  if (!hit) throw Error('Missing E visual hit');
  check(
    hit.tick === stop.tick &&
      same(hit.point, stop.point) &&
      finite(hit.targetPoint) &&
      Number.isSafeInteger(hit.targetId) &&
      hit.targetId > 0 &&
      hit.targetId !== record.sourceId &&
      hit.targetTeam !== record.team &&
      Number.isFinite(hit.targetFacing) &&
      Number.isFinite(hit.targetRadius) &&
      hit.targetRadius > 0
  );
  audience(hit.audience, record.team);
  audience(hit.targetAudience, hit.targetTeam);
  poses(record.targetFrames, hit.tick, hit.targetTeam);
  if (record.buff) {
    const buff = record.buff,
      control = buff.control;
    check(
      buff.targetId === hit.targetId &&
        buff.targetTeam === hit.targetTeam &&
        control.sourceId === record.sourceId &&
        control.rank === record.rank &&
        control.startTick === hit.tick
    );
    const duration = Math.round(AHRI_E.charmSecondsByRank[record.rank - 1] * TICK_RATE);
    const sampled = control.tenacityApplied
      ? Math.min(
          duration,
          Math.max(
            Math.round(0.3 * TICK_RATE),
            Math.round(duration * (1 - GAREN_W.upfrontTenacity))
          )
        )
      : duration;
    check(Number.isSafeInteger(control.endTick) && control.endTick === control.startTick + sampled);
    audience(buff.audience, buff.targetTeam);
    if (buff.stop) {
      check(
        clock(buff.stop.tick) &&
          buff.stop.tick >= control.startTick &&
          buff.stop.tick <= control.endTick
      );
      if (buff.stop.reason === 'expired') check(buff.stop.tick === control.endTick);
      if (buff.stop.reason === 'replaced' || buff.stop.reason === 'control-ended')
        check(buff.stop.tick < control.endTick);
    } else check(tick < control.endTick);
  }
  return { point: position, previous, remaining };
}
