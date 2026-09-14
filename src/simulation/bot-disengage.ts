import { direction, distance, type Vec2 } from './math';

/** Local tactical policy, not a reconstruction of Riot's bot implementation.
 * Callers must provide only living, team-visible opponents. No hidden world state
 * or opponent commands are available to this planner. */
export interface Combatant extends Vec2 {
  hp: number;
  maxHp: number;
  damage: number;
  attackPeriod: number;
}

function strength(unit: Combatant): number {
  // Health remaining and sustained attack power provide a conservative baseline.
  // This deliberately does not pretend to evaluate unobserved enemy cooldowns.
  return (
    (Math.sqrt(Math.max(0, unit.hp) / Math.max(1, unit.maxHp)) * Math.max(1, unit.damage)) /
    Math.max(1, unit.attackPeriod)
  );
}

export function botDisengagePoint(
  actor: Combatant,
  allies: readonly Combatant[],
  enemies: readonly Combatant[],
  home: Vec2,
  safe: (point: Vec2) => boolean
): Vec2 | null {
  const threats = enemies.filter((e) => distance(actor, e) <= 1000);
  if (threats.length < 2) return null;
  const support = allies.filter((a) => distance(actor, a) <= 850);
  const friendly = strength(actor) + support.reduce((sum, a) => sum + strength(a), 0);
  const hostile = threats.reduce((sum, e) => sum + strength(e), 0);
  if (hostile <= friendly * 1.55) return null;

  const centroid = threats.reduce((point, e) => ({ x: point.x + e.x, y: point.y + e.y }), {
    x: 0,
    y: 0,
  });
  centroid.x /= threats.length;
  centroid.y /= threats.length;
  let away = direction(centroid, actor);
  if (away.x === 0 && away.y === 0) away = direction(actor, home);
  const base = Math.atan2(away.y, away.x);
  const clearance = (point: Vec2) => Math.min(...threats.map((e) => distance(point, e)));
  const current = clearance(actor);
  let best: Vec2 | null = null,
    bestScore = -Infinity;
  // Sample a full circle to handle flanks and walls. Require actual improvement
  // against the nearest threat, rather than escaping one enemy into another.
  for (let i = 0; i < 16; i++) {
    const angle = base + (i * Math.PI) / 8;
    const point = { x: actor.x + Math.cos(angle) * 300, y: actor.y + Math.sin(angle) * 300 };
    const separation = clearance(point);
    if (separation < current + 80 || !safe(point)) continue;
    const score = separation - distance(point, home) * 0.08;
    if (score > bestScore) {
      best = point;
      bestScore = score;
    }
  }
  return best;
}
