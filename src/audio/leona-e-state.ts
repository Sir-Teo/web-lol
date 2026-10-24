import { LEONA_E_AUDIO as P } from '../content/leona-e-audio';
import type { ZenithVisual } from '../simulation/leona-e-visuals';
import type { Team } from '../simulation/types';
import { zenithPoseAt } from '../render/leona-zenith-history';

export const LEONA_E_AUDIO_KINDS = [
  'cast',
  'arrival',
  'dash',
  'contact',
  'championContact',
  'flight',
] as const;
export type LeonaEAudioKind = (typeof LEONA_E_AUDIO_KINDS)[number];
export interface LeonaEAudioRecord extends ZenithVisual {
  id: number;
}
export interface LeonaEAudioState {
  key: string;
  kind: LeonaEAudioKind;
  variant: number;
  startTick: number;
  age: number;
  offset: number;
  playbackRate: number;
  remaining: number;
  envelope: number;
  remainingIn: number;
  fadeStartTick: number | null;
  stopAtTick: number | null;
  fadeIn: number;
  fadeOutSeconds: number;
  fadeOutAt: number;
  fadeOutRemaining: number;
  x: number;
  y: number;
}
/** Indexed local cosmetic variants; no native global shuffle sequence is inferred. */
export function leonaEVariant(id: number, start: number, kind: LeonaEAudioKind, target = 0) {
  let n =
    Math.imul(id, 0x85ebca6b) ^
    Math.imul(start, 0x9e3779b9) ^
    Math.imul(LEONA_E_AUDIO_KINDS.indexOf(kind) + 97, 0xc2b2ae35) ^
    Math.imul(target, 0x165667b1);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  return ((n ^ (n >>> 15)) >>> 0) % P[kind].variants.length;
}
/** Local dispatch: accepted cast, saved launch/dash, all generic contacts,
 * champion-only extra contact and successful arrival. Particle creation names
 * support contact/dash/arrival associations; native script callsites are unknown.
 * Phase termination applies the bank's distinct delay or linear fade. Cast and
 * contact one-shots have no invented stop or ending cue. */
export function leonaEAudioStates(
  records: readonly LeonaEAudioRecord[],
  tick: number,
  team: Team = 'blue'
) {
  const states: LeonaEAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records) {
    const root = zenithPoseAt(r.frames, tick) ?? r.castFrame;
    const emit = (
      kind: LeonaEAudioKind,
      start: number,
      point: { x: number; y: number },
      audience: readonly Team[],
      stop: number | null = null,
      target = 0
    ) => {
      if (!audience.includes(team)) return;
      const p = P[kind],
        age = (tick - start) / 60,
        variant = leonaEVariant(r.id, r.startTick, kind, target);
      const playbackRate = 2 ** (p.pitchCents / 1200),
        clip = p.variants[variant];
      const fadeStartTick =
        stop === null || p.stop === null ? null : stop + p.stop.delaySeconds * 60;
      const fadeOutSeconds = p.stop?.fadeSeconds ?? 0;
      const stopAtTick = fadeStartTick === null ? null : fadeStartTick + fadeOutSeconds * 60;
      const remaining = Math.min(
        clip.durationSeconds / playbackRate - age,
        stopAtTick === null ? Infinity : (stopAtTick - tick) / 60
      );
      if (age < 0 || remaining <= 0) return;
      const fadeIn = p.fadeInSeconds ? Math.min(1, age / p.fadeInSeconds) : 1;
      const fadeOutAt = fadeStartTick === null ? 0 : Math.max(0, (fadeStartTick - tick) / 60);
      const fadeOutRemaining = stopAtTick === null ? 0 : Math.max(0, (stopAtTick - tick) / 60);
      const fadeOut =
        fadeStartTick !== null && fadeOutSeconds > 0
          ? Math.min(1, fadeOutRemaining / fadeOutSeconds)
          : 1;
      states.push({
        key: `${r.id}:${r.startTick}:${kind}${target ? ':' + target : ''}`,
        kind,
        variant,
        startTick: start,
        age,
        offset: age * playbackRate,
        playbackRate,
        remaining,
        envelope: fadeIn * fadeOut,
        remainingIn: Math.max(0, p.fadeInSeconds - age),
        fadeIn,
        fadeStartTick,
        stopAtTick,
        fadeOutSeconds,
        fadeOutAt,
        fadeOutRemaining,
        x: point.x,
        y: point.y,
      });
    };
    emit('cast', r.startTick, root, r.castFrame.audience);
    if (r.flight) {
      const f = r.flight,
        at = Math.min(tick, f.stopTick ?? tick);
      const frames = [
        { tick: f.startTick - 1, ...f.origin, facing: 0, audience: f.audience },
        ...f.frames.map((p) => ({ ...p, facing: 0 })),
      ];
      emit('flight', f.startTick, zenithPoseAt(frames, at) ?? f.origin, f.audience, f.stopTick);
      for (const c of f.contacts) {
        const point = zenithPoseAt(c.frames, tick) ?? c.point;
        emit('contact', c.tick, c.point, c.audience, null, c.targetId);
        if (c.targetKind === 'champion')
          emit('championContact', c.tick, point, c.audience, null, c.targetId);
      }
    }
    if (r.dash) {
      const d = r.dash,
        point =
          zenithPoseAt(r.frames, Math.min(tick, d.stopTick ?? tick)) ?? d.stopFrame ?? d.startFrame;
      emit('dash', d.startTick, point, d.startFrame.audience, d.stopTick);
    }
    if (r.arrival && r.dash?.stopFrame?.audience.includes(team)) {
      const a = r.arrival;
      emit('arrival', a.tick, zenithPoseAt(a.frames, tick) ?? root, a.frames[0].audience);
    }
  }
  return states.sort((a, b) => a.startTick - b.startTick || a.key.localeCompare(b.key));
}
