import { AHRI_ATTACK_AUDIO_TICKS as T } from '../content/ahri-attack-audio-timing';
import type { Team, Unit, Projectile } from './types';
import type { Vec2 } from './math';
import type { World } from './world';
export interface AhriAttackAudioRecord {
  sourceId: number;
  targetId: number;
  team: Team;
  startTick: number;
  releaseTick: number;
  critical: boolean;
  origin: Vec2;
  audience: Team[];
  cancel: { tick: number; reason: 'cancelled' | 'death' | 'match-end' } | null;
  launch: {
    id: number;
    tick: number;
    origin: Vec2;
    currentPoint: Vec2;
    audience: Team[];
    end: {
      tick: number;
      point: Vec2;
      reason: 'hit' | 'lost-target' | 'range' | 'match-end';
      audience: Team[];
    } | null;
  } | null;
}
const xy = (p: Vec2): Vec2 => ({ x: p.x, y: p.y });
const audience = (w: World, p: Vec2, team: Team): Team[] =>
  (['blue', 'red'] as Team[]).filter((t) => t === team || w.pointVisible(p, t));
/** Presentation observer only: existing windup/projectile identities, no IDs/RNG. */
export function beginAhriAttackAudio(w: World, u: Unit, target: Unit) {
  if (u.champion !== 'ahri') return;
  w.ahriAttackAudio.push({
    sourceId: u.id,
    targetId: target.id,
    team: u.team as Team,
    startTick: w.tick,
    releaseTick: u.releaseTick!,
    critical: !!u.attackCycle?.critical,
    origin: xy(u),
    audience: audience(w, u, u.team as Team),
    cancel: null,
    launch: null,
  });
}
export function cancelAhriAttackAudio(w: World, u: Unit) {
  for (const r of w.ahriAttackAudio)
    if (r.sourceId === u.id && !r.launch && !r.cancel)
      r.cancel = {
        tick: w.tick,
        reason: w.winner ? 'match-end' : !w.alive(u) ? 'death' : 'cancelled',
      };
}
export function launchAhriAttackAudio(w: World, u: Unit, p: Projectile) {
  if (u.champion !== 'ahri') return;
  const r = w.ahriAttackAudio.find(
    (r) => r.sourceId === u.id && r.startTick === u.attackCycle?.startTick
  );
  if (!r || r.launch || r.cancel) throw Error('Missing accepted Ahri attack audio windup');
  r.launch = {
    id: p.id,
    tick: w.tick,
    origin: xy(p),
    currentPoint: xy(p),
    audience: audience(w, p, r.team),
    end: null,
  };
}
export function finishAhriAttackAudio(
  w: World,
  p: Projectile,
  point: Vec2,
  reason: NonNullable<NonNullable<AhriAttackAudioRecord['launch']>['end']>['reason']
) {
  if (p.type !== 'attack') return;
  const r = w.ahriAttackAudio.find((r) => r.launch?.id === p.id);
  if (!r?.launch || r.launch.end) return;
  r.launch.currentPoint = xy(point);
  r.launch.end = { tick: w.tick, point: xy(point), reason, audience: audience(w, point, r.team) };
}
export function finishAllAhriAttackAudio(w: World) {
  for (const r of w.ahriAttackAudio) {
    if (!r.launch && !r.cancel) r.cancel = { tick: w.tick, reason: 'match-end' };
    if (r.launch && !r.launch.end) {
      const p = w.projectiles.find((p) => p.id === r.launch!.id);
      const point = p ?? r.launch.currentPoint;
      r.launch.currentPoint = xy(point);
      r.launch.end = {
        tick: w.tick,
        point: xy(point),
        reason: 'match-end',
        audience: audience(w, point, r.team),
      };
    }
  }
}
export function ahriAttackAudioExpiry(r: AhriAttackAudioRecord): number {
  if ((!r.launch && !r.cancel) || (r.launch && !r.launch.end)) return Infinity;
  return Math.max(
    r.startTick + T.cast,
    r.launch ? Math.min(r.launch.tick + T.launch, r.launch.end!.tick + T.launchStop) : 0,
    r.launch?.end?.reason === 'hit' ? r.launch.end.tick + T.hit : 0
  );
}
export function advanceAhriAttackAudio(w: World) {
  for (const r of w.ahriAttackAudio) {
    if (!r.launch && !r.cancel) {
      const source = w.unit(r.sourceId);
      if (
        !source ||
        source.attackCycle?.startTick !== r.startTick ||
        source.releaseTick !== r.releaseTick
      )
        r.cancel = {
          tick: w.tick,
          reason: w.winner ? 'match-end' : !source || !w.alive(source) ? 'death' : 'cancelled',
        };
    }
    if (r.launch && !r.launch.end) {
      const p = w.projectiles.find((p) => p.id === r.launch!.id);
      if (p) r.launch.currentPoint = xy(p);
    }
    if (r.startTick === w.tick) r.audience = audience(w, r.origin, r.team);
    if (r.launch?.tick === w.tick) r.launch.audience = audience(w, r.launch.origin, r.team);
    if (r.launch?.end?.tick === w.tick)
      r.launch.end.audience = audience(w, r.launch.end.point, r.team);
  }
  w.ahriAttackAudio = w.ahriAttackAudio.filter((r) => w.tick < ahriAttackAudioExpiry(r));
}
