import { LUX_BINDING_FLIGHT_AUDIO as profile } from '../content/lux-binding-flight-audio';
import { TICK_RATE } from '../content/rules';
import type { BindingFlightStop, Projectile } from '../simulation/types';

export interface BindingFlightAudioState {
  id: number;
  variant: 0 | 1;
  age: number;
  stopTick: number;
  fade: number;
  remainingFade: number;
  x: number;
  y: number;
}
/** Caller supplies visible records. Source clips play once, never expanded to fill the fade. */
export function bindingFlightAudioStates(
  projectiles: Projectile[],
  stops: BindingFlightStop[],
  tick: number
) {
  const states: BindingFlightAudioState[] = [];
  const add = (
    id: number,
    variant: 0 | 1,
    launchTick: number,
    stopTick: number,
    point: { x: number; y: number }
  ) => {
    const age = (tick - launchTick) / TICK_RATE;
    const sinceStop = (tick - stopTick) / TICK_RATE;
    if (
      age < 0 ||
      age >= profile.variants[variant].durationSeconds ||
      sinceStop >= profile.fadeSeconds
    )
      return;
    states.push({
      id,
      variant,
      age,
      stopTick,
      ...point,
      fade: 1 - Math.max(0, sinceStop) / profile.fadeSeconds,
      remainingFade: profile.fadeSeconds - sinceStop,
    });
  };
  for (const p of projectiles) {
    if (p.type !== 'binding' || p.launchTick === undefined || p.bindingAudioVariant === undefined)
      continue;
    const remainingTicks = Math.max(0, Math.ceil(((p.remaining - 1e-8) * TICK_RATE) / p.speed));
    add(p.id, p.bindingAudioVariant, p.launchTick, tick + remainingTicks, { x: p.x, y: p.y });
  }
  for (const s of stops) add(s.id, s.variant, s.launchTick, s.stopTick, s.point);
  return states;
}
