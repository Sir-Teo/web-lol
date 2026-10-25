import { LEONA_Q_AUDIO as P } from '../content/leona-q-audio';
import type { DaybreakVisual } from '../simulation/leona-q-visuals';
import type { Team } from '../simulation/types';
import type { SourceAudioState } from './finite-source-audio';
import { zenithPoseAt } from '../render/leona-zenith-history';

export const LEONA_Q_AUDIO_KINDS = ['cast', 'attack', 'hit', 'buff'] as const;
export type LeonaQAudioKind = (typeof LEONA_Q_AUDIO_KINDS)[number];
export interface LeonaQAudioRecord extends DaybreakVisual {
  id: number;
}
export type LeonaQAudioState = SourceAudioState<LeonaQAudioKind>;
/** Stable cosmetic choice. Native global shuffle history is unknown. */
export function leonaQVariant(id: number, start: number, kind: LeonaQAudioKind, attempt = 0) {
  let n =
    Math.imul(id, 0x85ebca6b) ^
    Math.imul(start, 0x9e3779b9) ^
    Math.imul(LEONA_Q_AUDIO_KINDS.indexOf(kind) + 107, 0xc2b2ae35) ^
    Math.imul(attempt, 0x165667b1);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  return ((n ^ (n >>> 15)) >>> 0) % P[kind].variants.length;
}
/** Local dispatch uses accepted activation, every saved committed attack start,
 * actual contact and buff termination. The buff loops the entire untouched
 * master because no decoded loop region was supplied. Native dispatch/phase
 * and listener/bus behavior are unobserved. Audiences are fixed at each start. */
export function leonaQAudioStates(
  records: readonly LeonaQAudioRecord[],
  tick: number,
  team: Team = 'blue'
) {
  const states: LeonaQAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records) {
    const root = zenithPoseAt(r.frames, tick) ?? r.frames[0];
    const emit = (
      kind: LeonaQAudioKind,
      start: number,
      point: { x: number; y: number },
      audience: readonly Team[],
      attempt = 0
    ) => {
      if (!audience.includes(team)) return;
      const p = P[kind],
        variant = leonaQVariant(r.id, r.startTick, kind, attempt),
        clip = p.variants[variant],
        age = (tick - start) / 60,
        playbackRate = 2 ** (p.pitchCents / 1200),
        stop = kind === 'buff' ? r.stopTick : null,
        fadeStartTick = stop === null ? null : stop + P.buff.stop.delaySeconds * 60,
        stopAtTick = fadeStartTick === null ? null : fadeStartTick + P.buff.stop.fadeSeconds * 60,
        remaining = Math.min(
          p.loop ? Infinity : clip.durationSeconds / playbackRate - age,
          stopAtTick === null ? Infinity : (stopAtTick - tick) / 60
        );
      if (age < 0 || remaining <= 0) return;
      const fadeInTarget =
          fadeStartTick === null || !p.fadeInSeconds
            ? 1
            : Math.min(1, Math.max(0, (fadeStartTick - start) / 60) / p.fadeInSeconds),
        fadingOut = fadeStartTick !== null && tick >= fadeStartTick,
        fadeIn = p.fadeInSeconds ? Math.min(1, age / p.fadeInSeconds) : 1,
        fadeOutRemaining = stopAtTick === null ? 0 : Math.max(0, (stopAtTick - tick) / 60),
        fadeOutSeconds = kind === 'buff' ? P.buff.stop.fadeSeconds : 0,
        remainingIn = fadingOut
          ? 0
          : Math.min(
              Math.max(0, p.fadeInSeconds - age),
              fadeStartTick === null ? Infinity : Math.max(0, (fadeStartTick - tick) / 60)
            );
      states.push({
        key: `${r.id}:${r.startTick}:${kind}${kind === 'attack' ? ':' + attempt : ''}`,
        kind,
        variant,
        startTick: start,
        age,
        playbackRate,
        offset: p.loop ? (age * playbackRate) % clip.durationSeconds : age * playbackRate,
        remaining,
        envelope: fadingOut
          ? fadeInTarget * Math.min(1, fadeOutRemaining / fadeOutSeconds)
          : fadeIn,
        remainingIn,
        fadeInTarget,
        fadeIn,
        fadeStartTick,
        stopAtTick,
        fadeOutSeconds,
        fadeOutAt: fadeStartTick === null ? 0 : Math.max(0, (fadeStartTick - tick) / 60),
        fadeOutRemaining,
        x: point.x,
        y: point.y,
      });
    };
    emit('cast', r.startTick, root, r.frames[0].audience);
    emit('buff', r.startTick, root, r.frames[0].audience);
    for (const start of r.attackStarts) {
      const frame = r.frames.find((f) => f.tick === start);
      if (frame) emit('attack', start, root, frame.audience, start);
    }
    if (r.impact)
      emit(
        'hit',
        r.impact.tick,
        zenithPoseAt(r.impact.frames, tick) ?? r.impact.frames[0],
        r.impact.audience
      );
  }
  return states.sort((a, b) => a.startTick - b.startTick || a.key.localeCompare(b.key));
}
