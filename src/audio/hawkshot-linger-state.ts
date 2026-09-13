import { HAWKSHOT_LINGER_AUDIO } from '../content/hawkshot-linger-audio';
import { TICK_RATE } from '../content/rules';
import type { ScoutVisual } from '../simulation/types';

/** Exp1 interpolation from pinned wwiser bnode_rtpc.py, applied to amplitude.
 * Native action fade mixing/domain remains unverified; not a linear fade.
 */
export function lingerFade(progress: number): number {
  const t = Math.max(0, Math.min(1, progress));
  return 1 - 0.5 * t * (t + 1);
}
export function lingerAudioState(effect: ScoutVisual, tick: number, duration: number) {
  const age = (tick - effect.flight.arrivalTick) / TICK_RATE;
  const stopAge = (effect.stopTick - effect.flight.arrivalTick) / TICK_RATE;
  const endAge = stopAge + HAWKSHOT_LINGER_AUDIO.fadeSeconds;
  if (age < 0 || age >= endAge || duration <= 0) return null;
  return {
    offset: age % duration,
    age,
    stopAge,
    endAge,
    fade: lingerFade((age - stopAge) / HAWKSHOT_LINGER_AUDIO.fadeSeconds),
  };
}
