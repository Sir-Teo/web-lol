import { AHRI_BOT_POLICY } from '../content/ahri-bot-policy';
import { AHRI_Q_POLICY } from '../content/ahri-q-policy';
import { damageAfterResistance } from './damage-math';
import { distance, sweepCircle, type Vec2 } from './math';

export interface AhriWaveMinion extends Vec2 {
  id: number;
  radius: number;
  hp: number;
  magicResist: number;
  shield: number;
  claimed: boolean;
}
export interface AhriWaveObservation {
  actor: Vec2;
  minions: readonly AhriWaveMinion[];
  damage: number;
  mana: number;
  manaCost: number;
  reserve: number;
  farmAllowed: boolean;
  lastHitReady: boolean;
}
const P = AHRI_BOT_POLICY.waveClear;
const TAU = Math.PI * 2;
const wrap = (angle: number) => ((angle % TAU) + TAU) % TAU;

/** Bounded local aim policy over copied visible observations. Value counts only
 * the outward magic leg; a moving caster/target may prevent the return hit. */
export function ahriWaveClear(o: AhriWaveObservation): Vec2 | null {
  if (!o.farmAllowed || o.lastHitReady || o.mana - o.manaCost < o.reserve) return null;
  const range = AHRI_Q_POLICY.outwardDistance;
  const targets = o.minions
    .filter(
      (m) =>
        !m.claimed &&
        distance(o.actor, m) <= range + AHRI_Q_POLICY.collisionRadius + m.radius - P.aimMargin
    )
    .sort((a, b) => distance(o.actor, a) - distance(o.actor, b) || a.id - b.id)
    .slice(0, P.maximumCandidates);
  if (targets.length < P.minimumTargets) return null;
  const boundaries: number[] = [];
  const angles: number[] = [0];
  for (const m of targets) {
    const d = distance(o.actor, m);
    const radius = AHRI_Q_POLICY.collisionRadius + m.radius - P.aimMargin;
    const angle = Math.atan2(m.y - o.actor.y, m.x - o.actor.x);
    angles.push(wrap(angle));
    // A circle containing the origin is hit by every direction. Otherwise its
    // tangent cone is clipped by the finite segment's circular endpoint.
    if (d <= radius) continue;
    const half =
      d * d - radius * radius <= range * range
        ? Math.asin(Math.min(1, radius / d))
        : Math.acos(
            Math.max(-1, Math.min(1, (d * d + range * range - radius * radius) / (2 * d * range)))
          );
    boundaries.push(wrap(angle - half), wrap(angle + half));
  }
  boundaries.sort((a, b) => a - b);
  // Every open interval has a constant hit set. Midpoints cover shared
  // corridors that aiming at a minion center can miss, including wraparound.
  for (let i = 0; i < boundaries.length; i++) {
    const end = i + 1 < boundaries.length ? boundaries[i + 1] : boundaries[0] + TAU;
    angles.push(wrap((boundaries[i] + end) / 2));
  }
  let best: { point: Vec2; useful: number; kills: number; hits: number; angle: number } | null =
    null;
  for (const angle of angles) {
    const point = {
      x: o.actor.x + Math.cos(angle) * range,
      y: o.actor.y + Math.sin(angle) * range,
    };
    const hits = targets.filter(
      (m) =>
        sweepCircle(o.actor, point, m, AHRI_Q_POLICY.collisionRadius + m.radius - P.aimMargin) !==
        null
    );
    if (hits.length < P.minimumTargets) continue;
    const useful = hits.reduce(
      (sum, m) => sum + Math.min(m.hp + m.shield, damageAfterResistance(o.damage, m.magicResist)),
      0
    );
    if (useful < o.damage * P.valueMultiplier) continue;
    const kills = hits.filter(
      (m) => m.hp + m.shield <= damageAfterResistance(o.damage, m.magicResist)
    ).length;
    if (
      !best ||
      useful > best.useful + 1e-7 ||
      (Math.abs(useful - best.useful) <= 1e-7 &&
        (kills > best.kills ||
          (kills === best.kills &&
            (hits.length > best.hits || (hits.length === best.hits && angle < best.angle)))))
    )
      best = { point, useful, kills, hits: hits.length, angle };
  }
  return best?.point ?? null;
}
