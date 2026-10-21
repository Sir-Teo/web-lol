import { GAREN_W_AUDIO as P } from '../content/garen-w-audio';
import type { ChampionState } from '../simulation/types';

export type GarenWAudioKind = 'cast' | 'active' | 'end';
export interface GarenWAudioRecord extends NonNullable<ChampionState['garenWVisual']> {
  id: number;
  x: number;
  y: number;
  visible: boolean;
}
export interface GarenWAudioState {
  key: string;
  kind: GarenWAudioKind;
  variant: number;
  age: number;
  offset: number;
  fade: number;
  remainingFade: number | null;
  stopTick: number | null;
  x: number;
  y: number;
}
/** Indexed cosmetic choice, independent of simulation RNG/native shuffle state. */
export function garenWVariant(id: number, startTick: number, kind: GarenWAudioKind) {
  const salt = { cast: 8, active: 9, end: 10 }[kind];
  let n =
    Math.imul(id, 0x85ebca6b) ^ Math.imul(startTick, 0x9e3779b9) ^ Math.imul(salt, 0xc2b2ae35);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  return ((n ^ (n >>> 15)) >>> 0) % P[kind].variants.length;
}
/** Local dispatch: cast+loop at accepted W, loop stop at defense expiry/death/
 * match end, and ending one-shot only on natural expiry. Shield loss is separate.
 * WEM/decoder loop ends are already exclusive; do not add another sample. */
export function garenWAudioStates(records: readonly GarenWAudioRecord[], tick: number) {
  const states: GarenWAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records)
    for (const kind of ['cast', 'active', 'end'] as const) {
      if (!r.visible) continue;
      if (kind === 'end' && (r.stopTick === null || r.endReason !== 'expired')) continue;
      const variant = garenWVariant(r.id, r.startTick, kind),
        clip = P[kind].variants[variant],
        age = (tick - (kind === 'end' ? r.stopTick! : r.startTick)) / 60;
      if (age < 0 || (kind !== 'active' && age >= clip.durationSeconds)) continue;
      const stopTick = kind === 'active' ? r.stopTick : null;
      const sinceStop = stopTick === null ? -Infinity : (tick - stopTick) / 60;
      if (sinceStop >= P.active.stop.fadeSeconds) continue;
      const loop = clip.loop;
      const start = loop ? loop.start / clip.sampleRate : 0,
        end = loop ? loop.end / clip.sampleRate : 0;
      states.push({
        key: `${r.id}:${r.startTick}:${kind}`,
        kind,
        variant,
        age,
        offset: loop && age >= end ? start + ((age - start) % (end - start)) : age,
        fade: stopTick === null ? 1 : 1 - Math.max(0, sinceStop) / P.active.stop.fadeSeconds,
        remainingFade: stopTick === null ? null : P.active.stop.fadeSeconds - sinceStop,
        stopTick,
        x: r.x,
        y: r.y,
      });
    }
  return states;
}
