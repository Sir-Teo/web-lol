import { BARON_BASIC_AUDIO as P } from '../content/baron-basic-audio';

export interface BaronBasicAudioRecord {
  id: number;
  launchTick: number;
  origin: { x: number; y: number };
  castVisible: boolean;
  impact: { startTick: number; point: { x: number; y: number }; visible: boolean } | null;
}
export interface BaronBasicAudioState {
  key: string;
  profileIndex: number;
  variant: number;
  pitchCents: number;
  rate: number;
  age: number;
  offset: number;
  x: number;
  y: number;
}

/** Stateless cosmetic draws, separated by profile and purpose. This is a local
 * saved-identity policy, not native Wwise shuffle, probability or random state. */
function draw(id: number, launchTick: number, profile: number, purpose: number) {
  let n = Math.imul(id, 0x85ebca6b) ^ Math.imul(launchTick, 0x9e3779b9);
  n ^= Math.imul(profile + 1, 0xc2b2ae35) ^ Math.imul(purpose + 1, 0x27d4eb2d);
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
}

/** Local preview dispatches candidate OnCast at saved projectile release.
 * Authored action delay follows that anchor. Native script dispatch is unknown.
 * Callers supply the saved cue audience, never infer it from current visibility. */
export function baronBasicAudioStates(records: readonly BaronBasicAudioRecord[], tick: number) {
  const states: BaronBasicAudioState[] = [];
  if (!Number.isFinite(tick)) return states;
  for (const r of records)
    for (const [profileIndex, p] of P.entries()) {
      const hit = p.phase === 'hit';
      if (hit ? !r.impact?.visible : !r.castVisible) continue;
      if (draw(r.id, r.launchTick, profileIndex, 0) >= p.probability) continue;
      const variant = Math.floor(draw(r.id, r.launchTick, profileIndex, 1) * p.variants.length),
        pitchCents =
          p.pitchCents +
          p.pitchRangeCents[0] +
          draw(r.id, r.launchTick, profileIndex, 2) * (p.pitchRangeCents[1] - p.pitchRangeCents[0]),
        rate = 2 ** (pitchCents / 1200),
        age = (tick - (hit ? r.impact!.startTick : r.launchTick)) / 60 - p.delaySeconds,
        offset = age * rate;
      if (age < 0 || offset >= p.variants[variant].durationSeconds) continue;
      const point = hit ? r.impact!.point : r.origin;
      states.push({
        key: `${r.id}:${r.launchTick}:${profileIndex}`,
        profileIndex,
        variant,
        pitchCents,
        rate,
        age,
        offset,
        x: point.x,
        y: point.y,
      });
    }
  return states;
}
