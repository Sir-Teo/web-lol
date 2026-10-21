import { GAREN_Q_AUDIO as P } from '../content/garen-q-audio';
import type { ChampionState } from '../simulation/types';

export const GAREN_Q_AUDIO_KINDS = ['cast', 'active', 'end', 'attack', 'attackDelayed'] as const;
export type GarenQAudioKind = (typeof GAREN_Q_AUDIO_KINDS)[number];
export interface GarenQAudioRecord extends Omit<ChampionState['garenQVisuals'][number], 'attacks'> {
  attacks: { startTick: number; releaseTick: number }[];
  id: number;
  x: number;
  y: number;
  visible: boolean;
}
export interface GarenQAudioState {
  key: string;
  kind: GarenQAudioKind;
  variant: number;
  age: number;
  offset: number;
  delay: number;
  fade: number;
  remainingFade: number | null;
  stopTick: number | null;
  x: number;
  y: number;
}
/** Indexed cosmetic selection; native shuffle state is not reconstructed. */
export function garenQVariant(id: number, startTick: number, kind: GarenQAudioKind) {
  const salt = GAREN_Q_AUDIO_KINDS.indexOf(kind) + 11;
  let n =
    Math.imul(id, 0x85ebca6b) ^ Math.imul(startTick, 0x9e3779b9) ^ Math.imul(salt, 0xc2b2ae35);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  return ((n ^ (n >>> 15)) >>> 0) % P[kind].variants.length;
}
export function garenQAudioKeys(records: readonly GarenQAudioRecord[]) {
  return records.flatMap((r) => [
    ...['cast', 'active', 'end'].map((kind) => `${r.id}:${r.startTick}:${kind}`),
    ...r.attacks.flatMap((a) =>
      ['attack', 'attackDelayed'].map((kind) => `${r.id}:${a.startTick}:${kind}`)
    ),
  ]);
}
/** Local dispatch: activation starts cast + one-shot active; consumption/expiry
 * adds ending. Death/match-end/recast stop the active without an ending cue.
 * Both attack actions start from commitment, independent of a successful hit.
 * Delay remains exact seconds, including scheduling a future bank action. */
export function garenQAudioStates(records: readonly GarenQAudioRecord[], tick: number) {
  const states: GarenQAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records) {
    if (!r.visible) continue;
    for (const kind of GAREN_Q_AUDIO_KINDS) {
      if (
        kind === 'end' &&
        (r.stopTick === null || !['consumed', 'expired'].includes(r.endReason!))
      )
        continue;
      const signals =
        kind === 'attack' || kind === 'attackDelayed'
          ? r.attacks.map((a) => a.startTick)
          : [kind === 'end' ? r.stopTick! : r.startTick];
      for (const signal of signals) {
        if (tick < signal) continue;
        const variant = garenQVariant(r.id, kind === 'end' ? r.startTick : signal, kind),
          clip = P[kind].variants[variant],
          age = (tick - signal) / 60 - P[kind].delaySeconds;
        if (age >= clip.durationSeconds) continue;
        const stopTick =
            kind === 'active' && r.stopTick !== null && tick >= r.stopTick ? r.stopTick : null,
          sinceStop = stopTick === null ? -Infinity : (tick - stopTick) / 60;
        if (sinceStop >= P.active.stop.fadeSeconds) continue;
        states.push({
          key: `${r.id}:${kind === 'end' ? r.startTick : signal}:${kind}`,
          kind,
          variant,
          age,
          offset: Math.max(0, age),
          delay: Math.max(0, -age),
          fade: stopTick === null ? 1 : 1 - Math.max(0, sinceStop) / P.active.stop.fadeSeconds,
          remainingFade: stopTick === null ? null : P.active.stop.fadeSeconds - sinceStop,
          stopTick,
          x: r.x,
          y: r.y,
        });
      }
    }
  }
  return states;
}
