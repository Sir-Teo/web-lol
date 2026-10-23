import { LUX_E_AUDIO as P } from '../content/lux-e-audio';
import { LUX_E_SOURCE as E } from '../content/lux-e';
import type { LuxEAudioRecord } from '../simulation/lux-e-audio';
import type { Vec2 } from '../simulation/math';

export const LUX_E_AUDIO_KINDS = ['cast', 'flight', 'zone', 'zoneDelayed', 'hit'] as const;
export type LuxEAudioKind = (typeof LUX_E_AUDIO_KINDS)[number];
export interface LuxEAudioState extends Vec2 {
  key: string;
  kind: LuxEAudioKind;
  variant: number;
  offset: number;
  fade: number;
  remainingFade: number | null;
  stopTick: number | null;
}
/** Global saved ordinal cycles meet each source N-1 avoid-repeat window. The
 * initial order/PRNG and action dispatch are local, not native certification. */
export function luxEAudioStates(records: readonly LuxEAudioRecord[], tick: number) {
  const states: LuxEAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records)
    for (const kind of LUX_E_AUDIO_KINDS) {
      const phase =
        kind === 'cast'
          ? { tick: r.startTick, ordinal: r.castOrdinal }
          : kind === 'flight'
            ? r.launch
            : kind === 'hit'
              ? r.hit
              : r.arrival;
      if (!phase) continue;
      const profile = P[kind],
        birth = phase.tick + profile.delaySeconds * 60;
      const variant = (kind === 'zoneDelayed' ? 0 : phase.ordinal) % profile.variants.length;
      const offset = (tick - birth) / 60;
      if (offset < 0 || offset >= profile.variants[variant].durationSeconds) continue;
      const zone = kind === 'zone' || kind === 'zoneDelayed';
      // The source has no zone-stop action. Cutting both finite zone layers at
      // local detonation/cancellation is explicit policy, not an invented fade.
      if (zone && r.stopTick !== null && tick >= r.stopTick) continue;
      const stopTick = kind === 'flight' ? (r.arrival?.tick ?? r.stopTick) : null;
      if (stopTick !== null && stopTick <= birth) continue;
      const sinceStop = stopTick === null ? 0 : Math.max(0, (tick - stopTick) / 60);
      if (sinceStop >= P.flight.stop.fadeSeconds) continue;
      let point = kind === 'cast' ? r.point : r.aim;
      if (kind === 'flight' && r.launch) {
        const length = Math.hypot(r.aim.x - r.launch.origin.x, r.aim.y - r.launch.origin.y);
        const travel = Math.max(
          0,
          ((Math.min(tick, stopTick ?? tick) - r.launch.tick + 1) * E.movementSpeed) / 60
        );
        const f = length ? Math.min(1, travel / length) : 1;
        point = {
          x: r.launch.origin.x + (r.aim.x - r.launch.origin.x) * f,
          y: r.launch.origin.y + (r.aim.y - r.launch.origin.y) * f,
        };
      }
      if (kind === 'flight' && r.flightStopPoint) point = r.flightStopPoint;
      states.push({
        key: `${r.sourceId}:${r.startTick}:${kind}`,
        kind,
        variant,
        offset,
        stopTick,
        fade: 1 - sinceStop / P.flight.stop.fadeSeconds,
        remainingFade: stopTick === null ? null : P.flight.stop.fadeSeconds - sinceStop,
        ...point,
      });
    }
  return states;
}
