import { AHRI_Q_POLICY } from '../content/ahri-q-policy';
import { AHRI_E_POLICY } from '../content/ahri-e-policy';
import { direction, distance, type Vec2 } from '../simulation/math';

/** Local gameplay guide: Q/E show their simulated full-range width; R shows the
 * corrected landing footprint. Native targeter geometry remains unverified. */
export function ahriAimGeometry(
  ability: 'q' | 'e' | 'r',
  source: Vec2,
  aim: Vec2,
  landing: Vec2 | null = null,
  bodyRadius = 65
): Vec2[] {
  if (!distance(source, aim)) return [];
  if (ability === 'r') {
    if (!landing) return [];
    return [
      { x: source.x, y: source.y },
      ...Array.from({ length: 33 }, (_, i) => ({
        x: landing.x + Math.cos((i * Math.PI * 2) / 32) * bodyRadius,
        y: landing.y + Math.sin((i * Math.PI * 2) / 32) * bodyRadius,
      })),
      { x: source.x, y: source.y },
    ];
  }
  const dir = direction(source, aim),
    radius = ability === 'q' ? AHRI_Q_POLICY.collisionRadius : AHRI_E_POLICY.radius,
    range = ability === 'q' ? AHRI_Q_POLICY.outwardDistance : AHRI_E_POLICY.range;
  return [
    [0, -radius],
    [range, -radius],
    [range, radius],
    [0, radius],
    [0, -radius],
  ].map(([along, across]) => ({
    x: source.x + dir.x * along - dir.y * across,
    y: source.y + dir.y * along + dir.x * across,
  }));
}
