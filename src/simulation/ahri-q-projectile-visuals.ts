import { AHRI_Q_PROJECTILE_HISTORY_TICKS } from '../content/ahri-q-projectile-timing';
import type { AhriOrb } from './ahri-orbs';
import type { AhriOrbSegment } from './ahri-orb-motion';
import type { Vec2 } from './math';
import type { Team } from './types';

export type AhriQProjectileEndReason = 'caught' | 'expired' | 'lost-source' | 'match-end';
export interface AhriQProjectileVisual {
  id: number;
  sourceId: number;
  team: Team;
  launchTick: number;
  origin: Vec2;
  direction: Vec2;
  birthAudience: Team[];
  frames: {
    tick: number;
    x: number;
    y: number;
    facing: number;
    sourcePoint: Vec2;
    audience: Team[];
  }[];
  turn: { tick: number; point: Vec2; audience: Team[] } | null;
  end: { tick: number; point: Vec2; reason: AhriQProjectileEndReason } | null;
}
export interface ProjectileVisualWorld {
  tick: number;
  ahriQProjectileVisuals?: AhriQProjectileVisual[];
  pointVisible?(point: Vec2, team: Team): boolean;
}
const point = (p: Vec2): Vec2 => ({ x: p.x, y: p.y });
const audience = (w: ProjectileVisualWorld, p: Vec2, team: Team): Team[] =>
  (['blue', 'red'] as Team[]).filter((t) => t === team || w.pointVisible?.(p, t));
const record = (w: ProjectileVisualWorld, orb: AhriOrb) =>
  w.ahriQProjectileVisuals?.find((r) => r.id === orb.id);
/** Observer only: uses the existing projectile ID and allocates no World RNG. */
export function launchQProjectileVisual(w: ProjectileVisualWorld, orb: AhriOrb): void {
  w.ahriQProjectileVisuals?.push({
    id: orb.id,
    sourceId: orb.sourceId,
    team: orb.team,
    launchTick: orb.launchTick,
    origin: point(orb.origin),
    direction: point(orb.direction),
    birthAudience: audience(w, orb.origin, orb.team),
    frames: [],
    turn: null,
    end: null,
  });
}
export function moveQProjectileVisual(
  w: ProjectileVisualWorld,
  orb: AhriOrb,
  source: Vec2,
  segments: readonly AhriOrbSegment[]
): void {
  const r = record(w, orb);
  if (!r || r.end) return;
  const returning = segments.find((s) => s.leg === 'return');
  if (returning && !r.turn)
    r.turn = {
      tick: w.tick,
      point: point(returning.from),
      audience: audience(w, returning.from, r.team),
    };
  const segment = segments.at(-1);
  const dx = segment ? segment.to.x - segment.from.x : orb.direction.x;
  const dy = segment ? segment.to.y - segment.from.y : orb.direction.y;
  const previous = r.frames.at(-1);
  r.frames.push({
    tick: w.tick,
    x: orb.position.x,
    y: orb.position.y,
    facing:
      dx === 0 && dy === 0
        ? (previous?.facing ?? Math.atan2(orb.direction.y || 0, orb.direction.x || 0))
        : Math.atan2(dy || 0, dx || 0),
    sourcePoint: point(source),
    audience: audience(w, orb.position, r.team),
  });
}
export function finishQProjectileVisual(
  w: ProjectileVisualWorld,
  orb: AhriOrb,
  reason: AhriQProjectileEndReason
): void {
  const r = record(w, orb);
  if (r && !r.end) r.end = { tick: w.tick, point: point(orb.position), reason };
}
/** Refresh visibility after the step's visibility calculation, matching the
 * existing audio observer. Hidden births may become visible during flight. */
export function advanceQProjectileVisuals(w: ProjectileVisualWorld): void {
  for (const r of w.ahriQProjectileVisuals ?? []) {
    if (r.launchTick === w.tick) r.birthAudience = audience(w, r.origin, r.team);
    if (r.turn?.tick === w.tick) r.turn.audience = audience(w, r.turn.point, r.team);
    const frame = r.frames.at(-1);
    if (frame?.tick === w.tick) frame.audience = audience(w, frame, r.team);
  }
  if (w.ahriQProjectileVisuals)
    w.ahriQProjectileVisuals = w.ahriQProjectileVisuals.filter(
      (r) => !r.end || w.tick < r.end.tick + AHRI_Q_PROJECTILE_HISTORY_TICKS
    );
}
