import { LUX_BOT_POLICY } from '../content/lux-bot-policy';
import { LUX_E_SOURCE } from '../content/lux-e';
import { LUX_E_POLICY } from '../content/lux-e-policy';
import { damageAfterResistance } from './damage-math';
import { distance, type Vec2 } from './math';

const P = LUX_BOT_POLICY.waveClear;
export interface WaveMinion extends Vec2 {
  id: number;
  radius: number;
  hp: number;
  magicResist: number;
  shield: number;
  claimed: boolean;
  baseThreat: boolean;
  super: boolean;
}
export interface WaveObservation {
  actor: Vec2;
  minions: readonly WaveMinion[];
  damage: number;
  mana: number;
  manaCost: number;
  reserve: number;
  farmAllowed: boolean;
  lastHitReady: boolean;
  zone: (Vec2 & { arrived: boolean; requested: boolean }) | null;
}
interface Circle extends Vec2 {
  radius: number;
}
function intersections(a: Circle, b: Circle): Vec2[] {
  const d = distance(a, b);
  if (d < 1e-8 || d > a.radius + b.radius + 1e-6 || d < Math.abs(a.radius - b.radius) - 1e-6)
    return [];
  const along = (a.radius * a.radius - b.radius * b.radius + d * d) / (2 * d);
  const height = Math.sqrt(Math.max(0, a.radius * a.radius - along * along));
  const dx = (b.x - a.x) / d,
    dy = (b.y - a.y) / d;
  const root = { x: a.x + dx * along, y: a.y + dy * along };
  return [
    { x: root.x - dy * height, y: root.y + dx * height },
    { x: root.x + dy * height, y: root.y - dx * height },
  ];
}
/** Only copied, visible minion observations enter this policy. It never receives
 * opponent orders, pending spawns, hidden health or a World reference. */
export function luxWaveClear(o: WaveObservation): Vec2 | null {
  if (o.zone && (!o.zone.arrived || o.zone.requested)) return null;
  if (!o.zone && o.mana < o.manaCost) return null;
  const minions = o.minions.filter(
    (m) =>
      !m.claimed &&
      distance(m, o.zone ?? o.actor) <=
        (o.zone ? 0 : LUX_E_SOURCE.castRange) + LUX_E_POLICY.radius + m.radius - P.aimMargin
  );
  const pressure = minions.filter((m) => m.baseThreat);
  const possibleEmergency = pressure.length >= P.emergencyTargets || pressure.some((m) => m.super);
  if (!o.farmAllowed && !possibleEmergency) return null;
  if (minions.length < (o.zone ? 1 : P.minimumTargets) && !possibleEmergency) return null;
  if (!o.zone && !possibleEmergency && (o.lastHitReady || o.mana - o.manaCost < o.reserve))
    return null;
  const evaluate = (point: Vec2) => {
    const hits = minions.filter(
      (m) => distance(m, point) <= LUX_E_POLICY.radius + m.radius - P.aimMargin + 1e-6
    );
    const urgent = hits.filter((m) => m.baseThreat);
    const emergency = urgent.length >= P.emergencyTargets || urgent.some((m) => m.super);
    if (!o.farmAllowed && !emergency) return null;
    if (hits.length < (o.zone ? 1 : P.minimumTargets) && !emergency) return null;
    if (!o.zone && !emergency && (o.lastHitReady || o.mana - o.manaCost < o.reserve)) return null;
    const useful = hits.reduce(
      (sum, m) => sum + Math.min(m.hp + m.shield, damageAfterResistance(o.damage, m.magicResist)),
      0
    );
    if (
      useful <
      o.damage *
        (o.zone
          ? P.recastValueMultiplier
          : emergency
            ? P.emergencyValueMultiplier
            : P.valueMultiplier)
    )
      return null;
    const kills = hits.filter(
      (m) => m.hp + m.shield <= damageAfterResistance(o.damage, m.magicResist)
    ).length;
    return {
      point: { x: point.x, y: point.y },
      score: [Number(emergency), useful, kills, hits.length, -distance(o.actor, point)],
    };
  };
  if (o.zone) return evaluate(o.zone)?.point ?? null;
  const targets = minions
    .filter((m) => distance(o.actor, m) <= LUX_E_SOURCE.castRange + LUX_E_POLICY.radius + m.radius)
    .sort((a, b) => distance(o.actor, a) - distance(o.actor, b) || a.id - b.id)
    .slice(0, P.maximumCandidates);
  if (!targets.length) return null;
  const castCircle = { ...o.actor, radius: LUX_E_SOURCE.castRange };
  // Disk intersections cover shared edges that aiming at a single unit misses.
  // The fixed candidate cap bounds planning cost when several waves accumulate.
  const circles = targets.map((m) => ({
    ...m,
    radius: LUX_E_POLICY.radius + m.radius - P.aimMargin,
  }));
  const points: Vec2[] = [{ ...o.actor }];
  for (const [i, circle] of circles.entries()) {
    const d = distance(o.actor, circle),
      fraction = d ? Math.min(1, LUX_E_SOURCE.castRange / d) : 1;
    points.push({
      x: o.actor.x + (circle.x - o.actor.x) * fraction,
      y: o.actor.y + (circle.y - o.actor.y) * fraction,
    });
    points.push(...intersections(castCircle, circle));
    for (let j = 0; j < i; j++) points.push(...intersections(circle, circles[j]));
  }
  let best: ReturnType<typeof evaluate> = null;
  for (const point of points) {
    if (distance(o.actor, point) > LUX_E_SOURCE.castRange + 1e-6) continue;
    const candidate = evaluate(point);
    if (!candidate) continue;
    let better = !best;
    if (best) {
      for (let i = 0; i < candidate.score.length; i++) {
        const diff = candidate.score[i] - best.score[i];
        if (Math.abs(diff) > 1e-7) {
          better = diff > 0;
          break;
        }
        if (i === candidate.score.length - 1)
          better = point.x < best.point.x || (point.x === best.point.x && point.y < best.point.y);
      }
    }
    if (better) best = candidate;
  }
  return best?.point ?? null;
}
