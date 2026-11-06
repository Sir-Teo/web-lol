import { AHRI_CHARM_AUDIO as P, AHRI_CHARM_STOP as STOP } from '../content/ahri-charm-audio';
import type { AhriCharmAudioRecord } from '../simulation/ahri-charm-audio';
import type { Team } from '../simulation/types';
import type { Vec2 } from '../simulation/math';
import { wwise145Fade } from './wwise145-fade';

export interface CharmAudioState extends Vec2 {
  key: string;
  profileIndex: number;
  variant: number;
  offset: number;
  stopAge: number | null;
  endAge: number;
}
/** Stateless local variant policy. Native shuffle/global bus are unverified. */
export function charmVariant(sourceId: number, castTick: number, profile: number) {
  let n =
    Math.imul(sourceId, 0x85ebca6b) ^
    Math.imul(castTick, 0x9e3779b9) ^
    Math.imul(profile + 1, 0xc2b2ae35);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  return ((n ^ (n >>> 15)) >>> 0) % P[profile].variants.length;
}
/** Evaluate the original envelope domain, including a stop during fade-in.
 * Seeking never restarts the source curve at the seek point. */
export function charmEnvelope(state: CharmAudioState, age = state.offset): number {
  const fadeIn = P[state.profileIndex].transitionSeconds;
  const incoming = (t: number) => (fadeIn ? wwise145Fade(4, t / fadeIn, 0, 1) : 1);
  if (state.stopAge === null || age < state.stopAge) return incoming(age);
  return wwise145Fade(6, (age - state.stopAge) / STOP.fadeSeconds, incoming(state.stopAge), 0);
}
export function charmAudioStates(
  records: readonly AhriCharmAudioRecord[],
  tick: number,
  team: Team,
  visible: (point: Vec2) => boolean,
  casterPoint: (id: number) => Vec2 | undefined
) {
  const states: CharmAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records)
    for (const [profileIndex, profile] of P.entries()) {
      const phase =
        profile.phase === 'cast'
          ? { tick: r.castTick, audience: r.castAudience }
          : profile.phase === 'flight'
            ? r.launch
            : r.hit;
      if (!phase || !phase.audience.includes(team)) continue;
      const point =
        profile.phase === 'cast'
          ? (casterPoint(r.sourceId) ?? r.origin)
          : profile.phase === 'flight'
            ? r.launch!.currentPoint
            : r.hit!.point;
      if (r.team !== team && !visible(point)) continue;
      const variant = charmVariant(r.sourceId, r.castTick, profileIndex);
      const stopAge = profile.phase === 'flight' && r.stop ? (r.stop.tick - phase.tick) / 60 : null;
      const endAge = Math.min(
        profile.variants[variant].durationSeconds,
        stopAge === null ? Infinity : stopAge + STOP.fadeSeconds
      );
      const offset = (tick - phase.tick) / 60;
      if (offset < 0 || offset >= endAge) continue;
      states.push({
        key: `${r.sourceId}:${r.castTick}:${profileIndex}`,
        profileIndex,
        variant,
        offset,
        stopAge,
        endAge,
        x: point.x,
        y: point.y,
      });
    }
  return states;
}

export interface CharmEnvelopeEvent {
  kind: 'set' | 'linear';
  age: number;
  value: number;
}
/** Preserve Linear's exact endpoint. Only Exp1 needs piecewise interpolation;
 * 127 equal segments bound its normalized amplitude error below 0.000008. */
export function charmEnvelopeEvents(state: CharmAudioState): CharmEnvelopeEvent[] {
  const start = state.offset,
    end = state.endAge;
  if (![start, end].every(Number.isFinite) || start < 0 || end <= start)
    throw new RangeError('Invalid finite Charm envelope span');
  const events: CharmEnvelopeEvent[] = [{ kind: 'set', age: start, value: charmEnvelope(state) }];
  const rampEnd = Math.min(P[state.profileIndex].transitionSeconds, state.stopAge ?? Infinity, end);
  if (start < rampEnd)
    events.push({ kind: 'linear', age: rampEnd, value: charmEnvelope(state, rampEnd) });
  if (state.stopAge === null || state.stopAge >= end) return events;
  const begin = Math.max(start, state.stopAge);
  if (begin > Math.max(start, rampEnd))
    events.push({ kind: 'set', age: begin, value: charmEnvelope(state, begin) });
  for (let i = 1; i <= 127; i++) {
    const age = begin + ((end - begin) * i) / 127;
    events.push({ kind: 'linear', age, value: charmEnvelope(state, age) });
  }
  return events;
}
