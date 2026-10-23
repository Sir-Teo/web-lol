import { GAREN_P_AUDIO as P } from '../content/garen-p-audio';
import type { ChampionState } from '../simulation/types';
export type GarenPAudioKind = 'onset' | 'active';
type Interval = ChampionState['garenPassiveVisuals'][number];
export interface GarenPAudioRecord extends Interval {
  id: number;
  x: number;
  y: number;
  visible: boolean;
}
export interface GarenPAudioState {
  key: string;
  kind: GarenPAudioKind;
  age: number;
  offset: number;
  envelope: number;
  remainingIn: number;
  remainingOut: number | null;
  stopTick: number | null;
  x: number;
  y: number;
}
/** Local dispatch starts both source actions on the saved recovery interval.
 * The onset finishes naturally; the active whole-file loop fades on stop.
 * A stop during fade-in starts at the gain reached at that original stop tick.
 * This overlaps no restarted ramps and does not infer native script timing. */
export function garenPAudioStates(
  records: readonly GarenPAudioRecord[],
  tick: number
): GarenPAudioState[] {
  if (!Number.isFinite(tick)) return [];
  return records.flatMap((r) => {
    if (!r.visible) return [];
    const age = (tick - r.startTick) / 60;
    if (age < 0) return [];
    const states: GarenPAudioState[] = [];
    if (age < P.onset.clip.durationSeconds)
      states.push({
        key: `${r.id}:${r.startTick}:onset`,
        kind: 'onset',
        age,
        offset: age,
        envelope: 1,
        remainingIn: 0,
        remainingOut: null,
        stopTick: null,
        x: r.x,
        y: r.y,
      });
    const sinceStop = r.stopTick === null ? -Infinity : (tick - r.stopTick) / 60;
    if (sinceStop >= P.active.stop.fadeSeconds) return states;
    const stopped = r.stopTick !== null && tick >= r.stopTick;
    const envelopeAtStop =
      r.stopTick === null
        ? 1
        : Math.min(1, Math.max(0, (r.stopTick - r.startTick) / 60) / P.active.fadeInSeconds);
    states.push({
      key: `${r.id}:${r.startTick}:active`,
      kind: 'active',
      age,
      offset: age % P.active.clip.durationSeconds,
      envelope: stopped
        ? envelopeAtStop * (1 - sinceStop / P.active.stop.fadeSeconds)
        : Math.min(1, age / P.active.fadeInSeconds),
      remainingIn: stopped ? 0 : Math.max(0, P.active.fadeInSeconds - age),
      remainingOut: stopped ? P.active.stop.fadeSeconds - sinceStop : null,
      stopTick: stopped ? r.stopTick : null,
      x: r.x,
      y: r.y,
    });
    return states;
  });
}
