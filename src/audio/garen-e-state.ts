import { GAREN_E_AUDIO as P } from '../content/garen-e-audio';
import { TICK_RATE } from '../content/rules';

export type GarenEAudioKind = 'cast' | 'active' | 'end' | 'hit';
export interface GarenEAudioRecord {
  id: number;
  startTick: number;
  stopTick: number | null;
  deadAt: number | null;
  x: number;
  y: number;
}
export interface GarenEAudioState {
  key: string;
  kind: GarenEAudioKind;
  variant: number;
  age: number;
  fade: number;
  remainingFade: number | null;
  stopTick: number | null;
  x: number;
  y: number;
}
/** Cosmetic indexed choice. Equal source weights/reset-on-play are retained;
 * native global shuffle/random state is unverified and never advances sim RNG. */
export function garenEVariant(id: number, startTick: number, kind: GarenEAudioKind) {
  const salt = { cast: 1, active: 2, end: 3, hit: 4 }[kind];
  let n =
    Math.imul(id, 0x85ebca6b) ^ Math.imul(startTick, 0x9e3779b9) ^ Math.imul(salt, 0xc2b2ae35);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  return ((n ^ (n >>> 15)) >>> 0) % P[kind].variants.length;
}
/** Local dispatch: cast+active at E start; ending at nonfatal E stop. A later
 * caster death applies the ending container's declared stop fade. All recordings
 * play once; neither container nor WEM declares a repeating loop. */
export function garenEAudioStates(records: readonly GarenEAudioRecord[], tick: number) {
  const states: GarenEAudioState[] = [];
  for (const r of records) {
    for (const kind of ['cast', 'active', 'end'] as const) {
      if (kind === 'end' && (r.stopTick === null || (r.deadAt !== null && r.deadAt <= r.stopTick)))
        continue;
      const start = kind === 'end' ? r.stopTick! : r.startTick;
      const age = (tick - start) / TICK_RATE;
      const variant = garenEVariant(r.id, r.startTick, kind);
      if (age < 0 || age >= P[kind].variants[variant].durationSeconds) continue;
      const stop = kind === 'active' ? r.stopTick : kind === 'end' ? r.deadAt : null;
      const fadeSeconds = kind === 'cast' ? 0 : P[kind].stop.fadeSeconds;
      const sinceStop = stop === null ? -Infinity : (tick - stop) / TICK_RATE;
      if (sinceStop >= fadeSeconds) continue;
      states.push({
        key: `${r.id}:${r.startTick}:${kind}`,
        kind,
        variant,
        age,
        fade: stop === null ? 1 : 1 - Math.max(0, sinceStop) / fadeSeconds,
        remainingFade: stop === null ? null : fadeSeconds - sinceStop,
        stopTick: stop,
        x: r.x,
        y: r.y,
      });
    }
  }
  return states;
}
