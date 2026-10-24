import { LEONA_R_AUDIO as P } from '../content/leona-r-audio';
import type { SolarFlareVisual } from '../simulation/leona-r-visuals';
import type { Team } from '../simulation/types';
import type { SourceAudioState } from './finite-source-audio';
import { zenithPoseAt } from '../render/leona-zenith-history';

export const LEONA_R_AUDIO_KINDS = ['cast', 'area', 'impact'] as const;
export type LeonaRAudioKind = (typeof LEONA_R_AUDIO_KINDS)[number];
export interface LeonaRAudioRecord extends SolarFlareVisual {
  id: number;
}
export type LeonaRAudioState = SourceAudioState<LeonaRAudioKind>;
/** Indexed cosmetic variants; native global random/shuffle state is unknown. */
export function leonaRVariant(id: number, start: number, kind: LeonaRAudioKind) {
  let n =
    Math.imul(id, 0x85ebca6b) ^
    Math.imul(start, 0x9e3779b9) ^
    Math.imul(LEONA_R_AUDIO_KINDS.indexOf(kind) + 101, 0xc2b2ae35);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  return ((n ^ (n >>> 15)) >>> 0) % P[kind].variants.length;
}
/** Explicit local dispatch: accepted cast plus one area cue at the fixed point,
 * then one saved impact cue even on a miss. Green/red aliases share one cue;
 * neither their source hooks nor bank names establish native script timing.
 * No matching source stop was found; all three finite clips finish naturally. */
export function leonaRAudioStates(
  records: readonly LeonaRAudioRecord[],
  tick: number,
  team: Team = 'blue'
) {
  const states: LeonaRAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records) {
    const emit = (
      kind: LeonaRAudioKind,
      start: number,
      point: { x: number; y: number },
      audience: readonly Team[]
    ) => {
      if (!audience.includes(team)) return;
      const age = (tick - start) / 60,
        profile = P[kind],
        variant = leonaRVariant(r.id, r.startTick, kind),
        clip = profile.variants[variant],
        playbackRate = 2 ** (profile.pitchCents / 1200),
        remaining = clip.durationSeconds / playbackRate - age;
      if (age < 0 || remaining <= 0) return;
      states.push({
        key: `${r.id}:${r.startTick}:${kind}`,
        kind,
        variant,
        startTick: start,
        age,
        offset: age * playbackRate,
        playbackRate,
        remaining,
        envelope: 1,
        remainingIn: 0,
        fadeStartTick: null,
        stopAtTick: null,
        fadeIn: 0,
        fadeOutSeconds: 0,
        fadeOutAt: 0,
        fadeOutRemaining: 0,
        x: point.x,
        y: point.y,
      });
    };
    emit('cast', r.startTick, zenithPoseAt(r.frames, tick) ?? r.castFrame, r.castFrame.audience);
    emit('area', r.startTick, r.point, r.areaAudience);
    if (r.impact) emit('impact', r.impact.tick, r.point, r.impact.audience);
  }
  return states;
}
