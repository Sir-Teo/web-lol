import { LEONA_W_AUDIO as P } from '../content/leona-w-audio';
import type { EclipseVisual } from '../simulation/leona-w-visuals';

export type LeonaWAudioKind = 'cast' | 'initial' | 'extended' | 'hit' | 'miss';
export const LEONA_W_AUDIO_KINDS: readonly LeonaWAudioKind[] = [
  'cast',
  'initial',
  'extended',
  'hit',
  'miss',
];
export interface LeonaWAudioRecord extends EclipseVisual {
  id: number;
  /** Saved birth audience AND current point visibility, supplied by GameAudio. */
  castVisible: boolean;
  burstVisible: boolean;
}
export interface LeonaWAudioState {
  key: string;
  kind: LeonaWAudioKind;
  variant: number;
  age: number;
  offset: number;
  envelope: number;
  remainingIn: number;
  remaining: number;
  stopAtTick: number | null;
  x: number;
  y: number;
}
/** Indexed cosmetic selection; native shuffle/global random-stream parity is open. */
export function leonaWVariant(id: number, start: number, kind: LeonaWAudioKind) {
  let n =
    Math.imul(id, 0x85ebca6b) ^
    Math.imul(start, 0x9e3779b9) ^
    Math.imul(LEONA_W_AUDIO_KINDS.indexOf(kind) + 71, 0xc2b2ae35);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  return ((n ^ (n >>> 15)) >>> 0) % P[kind].variants.length;
}
/** Local event dispatch: cast+first buff at activation; hit/miss once at the
 * saved caster explosion; second buff only on a hit. Stop callbacks belong to
 * the originating phase, including early recasts/death/victory. The bank's stop
 * is a 500 ms delay, not a fade. No recording loops or invented ending cue.
 * Missing TransitionTime is bound locally to an immediate stop after the delay.
 */
export function leonaWAudioStates(records: readonly LeonaWAudioRecord[], tick: number) {
  const states: LeonaWAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records)
    for (const kind of LEONA_W_AUDIO_KINDS) {
      const burst = kind === 'extended' || kind === 'hit' || kind === 'miss',
        d = r.detonation;
      if (burst ? !d || !r.burstVisible : !r.castVisible) continue;
      if (kind === 'extended' && d!.result !== 'hit') continue;
      if ((kind === 'hit' || kind === 'miss') && d!.result !== kind) continue;
      const p = P[kind],
        start = burst ? d!.tick : r.startTick,
        age = (tick - start) / 60,
        variant = leonaWVariant(r.id, r.startTick, kind),
        clip = p.variants[variant];
      if (age < 0 || age >= clip.durationSeconds) continue;
      const stop =
          kind === 'initial' ? (d?.tick ?? r.stopTick) : kind === 'extended' ? r.stopTick : null,
        stopAtTick = stop === null || p.stop === null ? null : stop + p.stop.delaySeconds * 60,
        remaining = Math.min(
          clip.durationSeconds - age,
          stopAtTick === null ? Infinity : (stopAtTick - tick) / 60
        );
      if (remaining <= 0) continue;
      const point = kind === 'hit' || kind === 'miss' ? d!.point : r.frames.at(-1)!;
      states.push({
        key: `${r.id}:${r.startTick}:${kind}`,
        kind,
        variant,
        age,
        offset: age,
        envelope: p.fadeInSeconds ? Math.min(1, age / p.fadeInSeconds) : 1,
        remainingIn: Math.max(0, p.fadeInSeconds - age),
        remaining,
        stopAtTick,
        x: point.x,
        y: point.y,
      });
    }
  return states;
}
