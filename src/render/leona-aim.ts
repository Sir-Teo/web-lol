import { LEONA_SPELLS } from '../content/leona-spells';
import { LEONA_COMBAT_POLICY } from '../content/leona-combat-policy';
import type { Vec2 } from '../simulation/math';

/** World-space preview of the local simulation's collision geometry. */
export function leonaAimGeometry(ability: 'e' | 'r', origin: Vec2, point: Vec2) {
  const angle = Math.atan2(point.y - origin.y, point.x - origin.x),
    dx = Math.cos(angle),
    dy = Math.sin(angle);
  if (ability === 'e') {
    const width = LEONA_COMBAT_POLICY.zenithRadius,
      reach = LEONA_SPELLS.e.missile.castRange;
    return {
      outline: [
        [0, -width],
        [reach, -width],
        [reach, width],
        [0, width],
        [0, -width],
      ].map(([along, across]) => ({
        x: origin.x + dx * along - dy * across,
        y: origin.y + dy * along + dx * across,
      })),
      center: [] as Vec2[],
    };
  }
  const length = Math.min(
      LEONA_SPELLS.r.castRange,
      Math.hypot(point.x - origin.x, point.y - origin.y)
    ),
    center = { x: origin.x + dx * length, y: origin.y + dy * length },
    circle = (radius: number) =>
      Array.from({ length: 33 }, (_, i) => ({
        x: center.x + Math.cos((i * Math.PI) / 16) * radius,
        y: center.y + Math.sin((i * Math.PI) / 16) * radius,
      }));
  return {
    outline: circle(LEONA_SPELLS.r.authoredOuterRadius),
    center: circle(LEONA_SPELLS.r.authoredInnerRadius),
  };
}
