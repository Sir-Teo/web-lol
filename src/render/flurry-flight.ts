import { clamp, lerp, type Vec2 } from '../simulation/math';
import type { Projectile } from '../simulation/types';

// Visual interpretation of the official Q demonstration, not native missile data.
// Keep this adapter separate from authoritative homing/collision calculations.
const SPREAD = [0, -0.06, 0.06, -0.1, 0.1] as const;

export function flurryFlight(
  p: Projectile,
  target: (Vec2 & { radius: number; previous?: Vec2 }) | undefined,
  alpha: number
) {
  const position = { x: lerp(p.previous.x, p.x, alpha), y: lerp(p.previous.y, p.y, alpha) };
  const straight = { ...position, facing: Math.atan2(p.direction.x, p.direction.y) };
  if (!p.empowered || p.type !== 'attack' || !p.origin || !target) return straight;
  const spread = SPREAD[p.flurryShot ?? 0] ?? 0;
  if (!spread) return straight;
  const travelled = Math.hypot(position.x - p.origin.x, position.y - p.origin.y);
  const targetPosition = target.previous
    ? { x: lerp(target.previous.x, target.x, alpha), y: lerp(target.previous.y, target.y, alpha) }
    : target;
  const remaining = Math.max(
    0,
    Math.hypot(targetPosition.x - position.x, targetPosition.y - position.y) -
      target.radius -
      p.radius
  );
  const length = travelled + remaining;
  if (length < 1 || remaining === 0) return straight;
  const phase = clamp(travelled / length, 0, 1);
  const amplitude = Math.min(length, 600) * spread;
  // Zero value AND slope at both ends avoids snapping back to straight facing.
  const wave = Math.sin(Math.PI * phase);
  const offset = amplitude * wave * wave;
  const slope = ((2 * amplitude * Math.PI) / length) * wave * Math.cos(Math.PI * phase);
  const normal = { x: -p.direction.y, y: p.direction.x };
  return {
    x: position.x + normal.x * offset,
    y: position.y + normal.y * offset,
    facing: Math.atan2(p.direction.x + normal.x * slope, p.direction.y + normal.y * slope),
  };
}
