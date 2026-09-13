import { HAWKSHOT_FLIGHT_AUDIO } from '../content/hawkshot-flight-audio';
import { TICK_RATE } from '../content/rules';
import type { Projectile, ScoutVisual } from '../simulation/types';

export interface FlightAudioState {
  id: number;
  age: number;
  stopAge: number;
  endAge: number;
  fade: number;
  variant: number;
}
/** Stable local cosmetic choice; native shuffle scope/state remains unverified. */
export function flightVariant(id: number): number {
  let hash = Math.imul(id ^ 0x51ed270b, 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return ((hash ^ (hash >>> 16)) >>> 0) % HAWKSHOT_FLIGHT_AUDIO.variants.length;
}
export function flightAudioStates(
  projectiles: Projectile[],
  effects: ScoutVisual[],
  tick: number
): FlightAudioState[] {
  const states: FlightAudioState[] = [];
  const add = (id: number, launchTick: number, arrivalTick: number) => {
    const age = (tick - launchTick) / TICK_RATE;
    const stopAge = (arrivalTick - launchTick) / TICK_RATE;
    const endTick = arrivalTick + Math.ceil(HAWKSHOT_FLIGHT_AUDIO.fadeSeconds * TICK_RATE);
    const endAge = (endTick - launchTick) / TICK_RATE;
    if (age < 0 || tick >= endTick) return;
    states.push({
      id,
      age,
      stopAge,
      endAge,
      variant: flightVariant(id),
      fade: 1 - Math.max(0, age - stopAge) / HAWKSHOT_FLIGHT_AUDIO.fadeSeconds,
    });
  };
  for (const p of projectiles) {
    if (p.type !== 'hawkshot' || p.launchTick === undefined) continue;
    // Hawkshot moves unobstructed at fixed speed; match the simulation's
    // remaining-distance epsilon when predicting the exact arrival tick.
    const steps = Math.max(0, Math.ceil(((p.remaining - 1e-8) * TICK_RATE) / p.speed));
    add(p.id, p.launchTick, tick + steps);
  }
  for (const e of effects) add(e.flight.id, e.flight.launchTick, e.flight.arrivalTick);
  return states;
}
