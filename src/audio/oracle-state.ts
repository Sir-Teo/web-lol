import { ORACLE_AUDIO as P } from '../content/oracle-audio';
import { oracleChildTick } from '../content/oracle-presentation';
import type { OracleVisual } from '../simulation/types';

export type OracleAudioKind = 'intro' | 'loop' | 'end';
export interface OracleAudioRecord extends OracleVisual {
  id: number;
  x: number;
  y: number;
  visible: boolean;
  endVisible: boolean;
}
export interface OracleAudioState {
  key: string;
  kind: OracleAudioKind;
  offset: number;
  rate: number;
  stopTick: number | null;
  fadeProgress: number;
  remainingFade: number | null;
  x: number;
  y: number;
}
/** Stable cosmetic draw in the declared range, independent of simulation RNG.
 * This does not reconstruct the native Wwise random generator. */
export function oraclePitchCents(id: number, startTick: number, kind: OracleAudioKind) {
  const clip = P[kind];
  if (!clip.pitchRangeCents.length) return clip.pitchCents;
  let n =
    Math.imul(id, 0x85ebca6b) ^ Math.imul(startTick, 0x9e3779b9) ^ (kind === 'intro' ? 31 : 32);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  const draw = ((n ^ (n >>> 15)) >>> 0) / 0xffffffff;
  return (
    clip.pitchCents +
    clip.pitchRangeCents[0] +
    draw * (clip.pitchRangeCents[1] - clip.pitchRangeCents[0])
  );
}
/** Pinned wwiser bank-145 Exp1 interpretation; native fade mix is unverified. */
export function oracleStopFade(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  return 1 - ((t + 1) * t) / 2;
}
/** Local dispatch: both active layers at accepted activation, stop on saved stop,
 * ending at the declared Death child clock. No audio is inferred from detections.
 * The unidentified loop GameParameter is held at local value zero (0 dB). */
export function oracleAudioStates(records: readonly OracleAudioRecord[], tick: number) {
  const states: OracleAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records) {
    for (const kind of ['intro', 'loop', 'end'] as const) {
      const clip = P[kind];
      if (!(kind === 'end' ? r.endVisible : r.visible)) continue;
      const child = r.stopTick === null ? null : oracleChildTick(r.startTick, r.stopTick);
      if (kind === 'end' && child === null) continue;
      const age = (tick - (kind === 'end' ? child! : r.startTick)) / 60;
      const rate = 2 ** (oraclePitchCents(r.id, r.startTick, kind) / 1200);
      const position = age * rate;
      if (age < 0 || (!clip.loop && position >= clip.durationSeconds)) continue;
      const stopTick = kind === 'end' ? null : r.stopTick;
      const sinceStop = stopTick === null ? -Infinity : (tick - stopTick) / 60;
      const fadeSeconds = clip.stop?.fadeSeconds ?? 0;
      if (stopTick !== null && sinceStop >= fadeSeconds) continue;
      const anchor = kind === 'end' ? (r.childAnchor?.point ?? r) : r;
      states.push({
        key: `${r.id}:${r.startTick}:${kind}`,
        kind,
        offset: clip.loop ? position % clip.durationSeconds : position,
        rate,
        stopTick: sinceStop < 0 ? null : stopTick,
        fadeProgress: sinceStop < 0 ? 0 : sinceStop / fadeSeconds,
        remainingFade: sinceStop < 0 ? null : fadeSeconds - sinceStop,
        x: anchor.x,
        y: anchor.y,
      });
    }
  }
  return states;
}
