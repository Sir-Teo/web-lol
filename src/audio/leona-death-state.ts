import { LEONA_DEATH_AUDIO as P } from '../content/leona-death-audio';
import type { LeonaDeathVisual } from '../simulation/leona-death-visuals';
import type { Team } from '../simulation/types';
import type { SourceAudioState } from './finite-source-audio';
export const LEONA_DEATH_AUDIO_KINDS = ['first', 'second'] as const;
export type LeonaDeathAudioKind = (typeof LEONA_DEATH_AUDIO_KINDS)[number];
export interface LeonaDeathAudioRecord extends LeonaDeathVisual {
  id: number;
}
/** Local death dispatch starts both authored direct-sound layers. The second
 * Play action is scheduled exactly in Web Audio; it is not a random alternative.
 * Fixed saved point/audience outlive the transient event and never read live
 * death coordinates or visibility to reconstruct an earlier birth. */
export function leonaDeathAudioStates(
  records: readonly LeonaDeathAudioRecord[],
  tick: number,
  team: Team = 'blue'
) {
  const states: SourceAudioState<LeonaDeathAudioKind>[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of [...records].sort((a, b) => a.startTick - b.startTick || a.id - b.id)) {
    if (tick < r.startTick || !r.audience.includes(team)) continue;
    for (const kind of LEONA_DEATH_AUDIO_KINDS) {
      const p = P[kind],
        start = r.startTick + p.delaySeconds * 60,
        age = (tick - start) / 60,
        playbackRate = 2 ** (p.pitchCents / 1200),
        remaining = p.variants[0].durationSeconds / playbackRate - age;
      if (remaining <= 0) continue;
      states.push({
        key: `${r.id}:${r.startTick}:${kind}`,
        kind,
        variant: 0,
        startTick: start,
        age,
        offset: Math.max(0, age * playbackRate),
        leadSeconds: Math.max(0, -age),
        playbackRate,
        remaining,
        envelope: 1,
        remainingIn: 0,
        fadeStartTick: null,
        stopAtTick: null,
        fadeIn: 1,
        fadeOutSeconds: 0,
        fadeOutAt: 0,
        fadeOutRemaining: 0,
        x: r.point.x,
        y: r.point.y,
      });
    }
  }
  return states.sort((a, b) => a.startTick - b.startTick);
}
