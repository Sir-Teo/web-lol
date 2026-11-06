import { AHRI_Q } from '../content/ahri-q';
import { AHRI_ORB_AUDIO_TICKS as T } from '../content/ahri-orb-audio-timing';
import type { AhriOrb } from './ahri-orbs';
import type { AhriOrbSegment } from './ahri-orb-motion';
import type { Team } from './types';
import type { Vec2 } from './math';
import type { World } from './world';

export interface AhriOrbAudioRecord {
  sourceId: number;
  team: Team;
  castTick: number;
  origin: Vec2;
  aim: Vec2;
  castAudience: Team[];
  cancelTick: number | null;
  launch: {
    id: number;
    tick: number;
    origin: Vec2;
    direction: Vec2;
    currentPoint: Vec2;
    audience: Team[];
  } | null;
  turn: { tick: number; point: Vec2; currentPoint: Vec2; audience: Team[] } | null;
  end: {
    tick: number;
    point: Vec2;
    reason: 'caught' | 'expired' | 'lost-source' | 'match-end';
    audience: Team[];
  } | null;
  hits: {
    tick: number;
    point: Vec2;
    targetId: number;
    leg: 'outward' | 'return';
    audience: Team[];
  }[];
}
export interface OrbAudioWorld {
  tick: number;
  ahriOrbAudio?: AhriOrbAudioRecord[];
  pointVisible?(point: Vec2, team: Team): boolean;
}
const point = (p: Vec2): Vec2 => ({ x: p.x, y: p.y });
const audience = (w: OrbAudioWorld, p: Vec2, team: Team): Team[] =>
  (['blue', 'red'] as Team[]).filter((t) => t === team || w.pointVisible?.(p, t));
const record = (w: OrbAudioWorld, id: number) => w.ahriOrbAudio?.find((r) => r.launch?.id === id);

export function launchOrbAudio(w: OrbAudioWorld, orb: AhriOrb) {
  const r = w.ahriOrbAudio?.find(
    (r) =>
      r.sourceId === orb.sourceId &&
      !r.launch &&
      r.cancelTick === null &&
      r.castTick + Math.round(AHRI_Q.castSeconds * 60) === w.tick
  );
  if (r)
    r.launch = {
      id: orb.id,
      tick: w.tick,
      origin: point(orb.origin),
      direction: point(orb.direction),
      currentPoint: point(orb.position),
      audience: audience(w, orb.origin, r.team),
    };
}
export function moveOrbAudio(w: OrbAudioWorld, orb: AhriOrb, segments: readonly AhriOrbSegment[]) {
  const r = record(w, orb.id);
  if (!r || r.end) return;
  for (const segment of segments) {
    if (segment.leg === 'outward') r.launch!.currentPoint = point(segment.to);
    else {
      if (!r.turn) {
        r.turn = {
          tick: w.tick,
          point: point(segment.from),
          currentPoint: point(segment.to),
          audience: audience(w, segment.from, r.team),
        };
        r.launch!.currentPoint = point(segment.from);
      }
      r.turn.currentPoint = point(segment.to);
    }
  }
}
export function hitOrbAudio(
  w: OrbAudioWorld,
  orb: AhriOrb,
  leg: 'outward' | 'return',
  targetId: number,
  p: Vec2
) {
  const r = record(w, orb.id);
  if (r && !r.end)
    r.hits.push({ tick: w.tick, point: point(p), targetId, leg, audience: audience(w, p, r.team) });
}
export function finishOrbAudio(
  w: OrbAudioWorld,
  orb: AhriOrb,
  reason: NonNullable<AhriOrbAudioRecord['end']>['reason']
) {
  const r = record(w, orb.id);
  if (!r || r.end) return;
  const endpoint = point(orb.position);
  if (r.turn) r.turn.currentPoint = endpoint;
  else r.launch!.currentPoint = endpoint;
  r.end = { tick: w.tick, point: endpoint, reason, audience: audience(w, endpoint, r.team) };
}
export function cancelOrbWindup(w: OrbAudioWorld, sourceId: number) {
  for (const r of w.ahriOrbAudio ?? [])
    if (r.sourceId === sourceId && !r.launch && r.cancelTick === null) r.cancelTick = w.tick;
}
export function orbAudioExpiry(r: AhriOrbAudioRecord) {
  if (r.launch && !r.end) return Infinity;
  let expiry = r.castTick + T.cast;
  const outStop = r.turn?.tick ?? r.end?.tick;
  if (r.launch)
    expiry = Math.max(expiry, Math.min(r.launch.tick + T.outward, outStop! + T.stopOutward));
  if (r.turn)
    expiry = Math.max(expiry, Math.min(r.turn.tick + T.return, r.end!.tick + T.stopReturn));
  if (r.end?.reason === 'caught') expiry = Math.max(expiry, r.end.tick + T.deactivate);
  for (const h of r.hits)
    expiry = Math.max(expiry, h.tick + (h.leg === 'outward' ? T.hitOutward : T.hitReturn));
  return expiry;
}
/** Audio dispatch history only; no gameplay IDs, clocks, damage or RNG changes. */
export function advanceOrbAudio(w: World) {
  if (!w.ahriOrbAudio.length) return;
  for (const r of w.ahriOrbAudio) {
    if (!r.launch) {
      const pending = w.championState(r.sourceId)?.pendingCast;
      if (r.cancelTick === null && (pending?.ability !== 'q' || pending.startTick !== r.castTick))
        r.cancelTick = w.tick;
      continue;
    }
    if (!r.end && !w.ahriOrbs.some((orb) => orb.id === r.launch!.id)) {
      const endpoint = point(r.turn?.currentPoint ?? r.launch.currentPoint);
      r.end = {
        tick: w.tick,
        point: endpoint,
        reason: w.winner ? 'match-end' : 'expired',
        audience: audience(w, endpoint, r.team),
      };
    }
    if (r.launch.tick === w.tick) r.launch.audience = audience(w, r.launch.origin, r.team);
    if (r.turn?.tick === w.tick) r.turn.audience = audience(w, r.turn.point, r.team);
    if (r.end?.tick === w.tick) r.end.audience = audience(w, r.end.point, r.team);
    for (let i = r.hits.length - 1; i >= 0 && r.hits[i].tick === w.tick; i--)
      r.hits[i].audience = audience(w, r.hits[i].point, r.team);
  }
  w.ahriOrbAudio = w.ahriOrbAudio.filter((r) => w.tick < orbAudioExpiry(r));
}
