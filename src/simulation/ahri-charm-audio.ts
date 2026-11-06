import {
  AHRI_CHARM_CAST_TICKS as CAST,
  AHRI_CHARM_FLIGHT_TICKS as FLIGHT,
  AHRI_CHARM_HIT_TICKS as HIT,
  AHRI_CHARM_STOP_FADE_TICKS as FADE,
} from '../content/ahri-charm-audio-timing';
import type { Team, Projectile } from './types';
import type { Vec2 } from './math';
import type { World } from './world';

export interface AhriCharmAudioRecord {
  sourceId: number;
  team: Team;
  castTick: number;
  origin: Vec2;
  castAudience: Team[];
  cancelTick: number | null;
  launch: { tick: number; id: number; point: Vec2; currentPoint: Vec2; audience: Team[] } | null;
  stop: { tick: number; point: Vec2; reason: 'hit' | 'range' | 'match-end' } | null;
  hit: { tick: number; point: Vec2; targetId: number; audience: Team[] } | null;
}
const teams: Team[] = ['blue', 'red'];
export function charmAudience(world: World, point: Vec2, team: Team): Team[] {
  return teams.filter((t) => t === team || world.pointVisible(point, t));
}
export function charmAudioExpiry(r: AhriCharmAudioRecord): number {
  if (r.launch && !r.stop) return Infinity;
  return Math.max(
    r.castTick + CAST,
    r.launch ? Math.min(r.launch.tick + FLIGHT, r.stop!.tick + FADE) : 0,
    r.hit ? r.hit.tick + HIT : 0
  );
}
export function cancelCharmWindup(world: World, sourceId: number) {
  for (const r of world.ahriCharmAudio)
    if (r.sourceId === sourceId && !r.launch && r.cancelTick === null) r.cancelTick = world.tick;
}
export function stopCharmAudio(world: World, p: Projectile, point: Vec2, targetId?: number) {
  const r = world.ahriCharmAudio.find((r) => r.launch?.id === p.id);
  if (!r || r.stop) return;
  r.launch!.currentPoint = { x: point.x, y: point.y };
  r.stop = {
    tick: world.tick,
    point: { x: point.x, y: point.y },
    reason: targetId !== undefined ? 'hit' : world.winner ? 'match-end' : 'range',
  };
  if (targetId !== undefined)
    r.hit = {
      tick: world.tick,
      point: { x: point.x, y: point.y },
      targetId,
      audience: charmAudience(world, point, r.team),
    };
}
/** Presentation only: no World random draws, IDs or combat mutations. */
export function advanceCharmAudio(world: World) {
  for (const r of world.ahriCharmAudio) {
    if (!r.launch) {
      const pending = world.championState(r.sourceId)?.pendingCast;
      if (r.cancelTick === null && (pending?.ability !== 'e' || pending.startTick !== r.castTick))
        r.cancelTick = world.tick;
      continue;
    }
    const p = world.projectiles.find((p) => p.id === r.launch!.id);
    if (p && !r.stop) r.launch.currentPoint = { x: p.x, y: p.y };
    if (!p && !r.stop)
      r.stop = {
        tick: world.tick,
        point: { ...r.launch.currentPoint },
        reason: world.winner ? 'match-end' : 'range',
      };
    if (r.launch.tick === world.tick)
      r.launch.audience = charmAudience(world, r.launch.point, r.team);
    if (r.hit?.tick === world.tick) r.hit.audience = charmAudience(world, r.hit.point, r.team);
  }
  world.ahriCharmAudio = world.ahriCharmAudio.filter((r) => world.tick < charmAudioExpiry(r));
}
