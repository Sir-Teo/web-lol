import { LEONA_SUNLIGHT_AUDIO as P } from '../content/leona-sunlight-audio';
import type { SunlightVisual } from '../simulation/sunlight-visuals';
import type { Team } from '../simulation/types';
import type { SourceAudioState } from './finite-source-audio';
import { zenithPoseAt } from '../render/leona-zenith-history';

/** Indexed cosmetic choice; native global shuffle history remains unobserved. */
export function leonaSunlightVariant(id: number, start: number) {
  let n = Math.imul(id, 0x85ebca6b) ^ Math.imul(start, 0x9e3779b9) ^ 0x1e0a139;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  return ((n ^ (n >>> 15)) >>> 0) % P.hit.variants.length;
}
/** Local dispatch follows accepted ally consumption, including a lethal proc.
 * The saved cosmetic serial separates same-tick hits without gameplay RNG/IDs.
 * Fixed birth audience prevents later reveal from exposing a hidden consumption.
 * Native event caller, shuffle, voice inheritance and listener/bus mix are unknown. */
export function leonaSunlightAudioStates(
  records: readonly SunlightVisual[],
  tick: number,
  team: Team = 'blue'
) {
  const states: SourceAudioState<'hit'>[] = [];
  if (!Number.isFinite(tick)) return states;
  // Same-tick serial order gives deterministic local oldest-first cap admission.
  for (const r of [...records].sort((a, b) => a.startTick - b.startTick || a.id - b.id)) {
    if (!r.audience.includes(team)) continue;
    const variant = leonaSunlightVariant(r.id, r.startTick),
      clip = P.hit.variants[variant],
      age = (tick - r.startTick) / 60,
      playbackRate = 2 ** (P.hit.pitchCents / 1200),
      remaining = clip.durationSeconds / playbackRate - age;
    if (age < 0 || remaining <= 0) continue;
    const point = zenithPoseAt(r.frames, tick) ?? r.frames[0];
    states.push({
      key: `${r.id}:${r.startTick}:hit`,
      kind: 'hit',
      variant,
      startTick: r.startTick,
      age,
      offset: age * playbackRate,
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
      x: point.x,
      y: point.y,
    });
  }
  return states;
}
