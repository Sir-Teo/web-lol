import { AHRI_Q } from '../content/ahri-q';
import { AHRI_Q_POLICY } from '../content/ahri-q-policy';
import { DT } from '../content/rules';
import { direction, distance, type Vec2 } from './math';

export interface AccelerationProfile {
  initialSpeed: number;
  minimumSpeed: number;
  maximumSpeed: number;
  acceleration: number;
}

function valid(profile: AccelerationProfile, value: number): void {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    ![profile.initialSpeed, profile.minimumSpeed, profile.maximumSpeed, profile.acceleration].every(
      Number.isFinite
    ) ||
    profile.minimumSpeed <= 0 ||
    profile.minimumSpeed > profile.initialSpeed ||
    profile.initialSpeed > profile.maximumSpeed
  )
    throw new RangeError('Invalid accelerating movement parameters');
}

/** Analytic integral of clamped speed. This is the local integration policy. */
export function acceleratingMotion(seconds: number, profile: AccelerationProfile) {
  valid(profile, seconds);
  const {
    initialSpeed: initial,
    minimumSpeed: minimum,
    maximumSpeed: maximum,
    acceleration,
  } = profile;
  if (acceleration === 0) return { speed: initial, distance: initial * seconds };
  const limit = acceleration > 0 ? maximum : minimum;
  const clampedAt = (limit - initial) / acceleration;
  const acceleratingSeconds = Math.min(seconds, clampedAt);
  return {
    speed: Math.max(minimum, Math.min(maximum, initial + acceleration * seconds)),
    distance:
      initial * acceleratingSeconds +
      (acceleration * acceleratingSeconds ** 2) / 2 +
      limit * (seconds - acceleratingSeconds),
  };
}

export function acceleratingTravelSeconds(travel: number, profile: AccelerationProfile): number {
  valid(profile, travel);
  const {
    initialSpeed: initial,
    minimumSpeed: minimum,
    maximumSpeed: maximum,
    acceleration,
  } = profile;
  if (acceleration === 0) return travel / initial;
  const limit = acceleration > 0 ? maximum : minimum;
  const clampedAt = (limit - initial) / acceleration;
  const clampDistance = ((initial + limit) * clampedAt) / 2;
  if (travel > clampDistance) return clampedAt + (travel - clampDistance) / limit;
  // Stable quadratic root, including very short travel and negative acceleration.
  return (2 * travel) / (initial + Math.sqrt(initial ** 2 + 2 * acceleration * travel));
}

export const AHRI_Q_OUTWARD_SECONDS = acceleratingTravelSeconds(
  AHRI_Q_POLICY.outwardDistance,
  AHRI_Q.outward
);

export interface AhriOrbMotion {
  origin: Vec2;
  direction: Vec2;
  position: Vec2;
  previous: Vec2;
  launchTick: number;
  lastTick: number;
}
export interface AhriOrbSegment {
  leg: 'outward' | 'return';
  from: Vec2;
  to: Vec2;
}

export function createAhriOrbMotion(origin: Vec2, aim: Vec2, launchTick: number): AhriOrbMotion {
  if (
    !Number.isSafeInteger(launchTick) ||
    launchTick < 1 ||
    ![origin.x, origin.y, aim.x, aim.y].every(Number.isFinite) ||
    distance(origin, aim) === 0
  )
    throw new RangeError('Invalid Ahri orb launch');
  const start = { x: origin.x, y: origin.y };
  return {
    origin: { ...start },
    direction: direction(origin, aim),
    position: { ...start },
    previous: { ...start },
    launchTick,
    lastTick: launchTick - 1,
  };
}

/** Advance one fixed tick toward the caster's current point. The turn tick
 * emits two independent swept segments and spends only its remaining time on
 * return. Arrival clamps to the caster center; terrain is handled by policy. */
export function advanceAhriOrbMotion(motion: AhriOrbMotion, tick: number, caster: Vec2) {
  if (tick !== motion.lastTick + 1 || ![caster.x, caster.y].every(Number.isFinite))
    throw new RangeError('Ahri orb requires consecutive finite fixed-step inputs');
  const previous = { ...motion.position };
  const segments: AhriOrbSegment[] = [];
  const ageBefore = (tick - motion.launchTick) * DT,
    ageAfter = ageBefore + DT;
  let position = { ...motion.position };
  if (ageBefore < AHRI_Q_OUTWARD_SECONDS) {
    const travel = Math.min(
      AHRI_Q_POLICY.outwardDistance,
      acceleratingMotion(Math.min(ageAfter, AHRI_Q_OUTWARD_SECONDS), AHRI_Q.outward).distance
    );
    const to = {
      x: motion.origin.x + motion.direction.x * travel,
      y: motion.origin.y + motion.direction.y * travel,
    };
    segments.push({ leg: 'outward', from: position, to });
    position = to;
  }
  let finished = false;
  if (ageAfter > AHRI_Q_OUTWARD_SECONDS) {
    const returnBefore = Math.max(0, ageBefore - AHRI_Q_OUTWARD_SECONDS);
    const returnAfter = ageAfter - AHRI_Q_OUTWARD_SECONDS;
    const travel =
      acceleratingMotion(returnAfter, AHRI_Q.returning).distance -
      acceleratingMotion(returnBefore, AHRI_Q.returning).distance;
    const remaining = distance(position, caster);
    const delta = direction(position, caster);
    finished = remaining <= travel;
    const to = finished
      ? { x: caster.x, y: caster.y }
      : { x: position.x + delta.x * travel, y: position.y + delta.y * travel };
    segments.push({ leg: 'return', from: position, to });
    position = to;
  }
  return { motion: { ...motion, position, previous, lastTick: tick }, segments, finished };
}
