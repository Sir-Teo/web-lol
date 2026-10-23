import { LUX_E_SOURCE as E } from '../content/lux-e';
import { LUX_E_AUDIO_TAIL_TICKS } from '../content/lux-e-audio-timing';
import type { Team } from './types';
import type { Vec2 } from './math';
import type { World } from './world';

export const LUX_E_AUDIO_ROLES = ['cast', 'flight', 'zone', 'hit'] as const;
export type LuxEAudioRole = (typeof LUX_E_AUDIO_ROLES)[number];
export interface LuxEAudioRecord {
  sourceId: number;
  team: Team;
  startTick: number;
  point: Vec2;
  aim: Vec2;
  castOrdinal: number;
  launch: { tick: number; origin: Vec2; zoneId: number; ordinal: number } | null;
  arrival: { tick: number; ordinal: number } | null;
  hit: { tick: number; ordinal: number } | null;
  stopTick: number | null;
  flightStopPoint: Vec2 | null;
}
export interface LuxEAudioHistory {
  counts: Record<LuxEAudioRole, number>;
  records: LuxEAudioRecord[];
}
export function newLuxEAudioHistory(): LuxEAudioHistory {
  return { counts: { cast: 0, flight: 0, zone: 0, hit: 0 }, records: [] };
}
/** Called after every completed simulation step, including victory early returns.
 * Captures accepted dispatches, never allocates entity IDs or consumes World RNG.
 * Delayed play actions cancelled before their deadline remain unborn. */
export function advanceLuxEAudio(world: World) {
  const history = world.luxEAudio;
  for (const r of history.records) {
    if (r.stopTick !== null) continue;
    const zone = world.singularities.find(
      (z) => z.sourceId === r.sourceId && z.launchTick === r.startTick + E.castSeconds * 60
    );
    if (zone) {
      r.launch ??= {
        tick: zone.launchTick,
        origin: { ...zone.origin },
        zoneId: zone.id,
        ordinal: history.counts.flight++,
      };
      if (zone.arrivalTick !== null)
        r.arrival ??= { tick: zone.arrivalTick, ordinal: history.counts.zone++ };
      if (zone.detonatedTick !== null) {
        r.hit = { tick: zone.detonatedTick, ordinal: history.counts.hit++ };
        r.stopTick = zone.detonatedTick;
      }
    } else {
      const pending = world.championState(r.sourceId)?.pendingCast;
      if (pending?.ability !== 'e' || pending.startTick !== r.startTick) r.stopTick = world.tick;
    }
  }
  history.records = history.records.filter(
    (r) => r.stopTick === null || world.tick < r.stopTick + LUX_E_AUDIO_TAIL_TICKS
  );
}
