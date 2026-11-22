import { AHRI_RECALL_AUDIO_TICKS as T } from '../content/ahri-recall-audio-timing';
import type { Vec2 } from './math';
import type { Team, Unit, SimEvent } from './types';
import type { World } from './world';
export interface AhriRecallAudioRecord {
  /** Existing accepted-channel message identity; no simulation identity allocation. */
  id: number;
  sourceId: number;
  team: Team;
  startTick: number;
  completeTick: number;
  origin: Vec2;
  audience: Team[];
  end: { tick: number; point: Vec2; reason: 'complete' | 'cancelled' | 'match-end' } | null;
}
export function beginAhriRecallAudio(w: World, u: Unit, event: SimEvent, completeTick: number) {
  if (u.champion !== 'ahri') return;
  w.ahriRecallAudio.push({
    id: event.id,
    sourceId: u.id,
    team: u.team as Team,
    startTick: w.tick,
    completeTick,
    origin: { x: u.x, y: u.y },
    audience: (['blue', 'red'] as Team[]).filter((t) => t === u.team || w.pointVisible(u, t)),
    end: null,
  });
}
export function finishAhriRecallAudio(
  w: World,
  sourceId: number,
  reason: NonNullable<AhriRecallAudioRecord['end']>['reason']
) {
  const u = w.unit(sourceId);
  if (!u || u.champion !== 'ahri') return;
  for (const r of w.ahriRecallAudio)
    if (r.sourceId === sourceId && !r.end)
      r.end = { tick: w.tick, point: { x: u.x, y: u.y }, reason };
}
export function ahriRecallAudioExpiry(r: AhriRecallAudioRecord) {
  return Math.min(
    r.startTick + T,
    r.end && r.end.reason !== 'complete' ? r.end.tick + 2 : Infinity
  );
}
export function advanceAhriRecallAudio(w: World) {
  w.ahriRecallAudio = w.ahriRecallAudio.filter((r) => w.tick < ahriRecallAudioExpiry(r));
}
