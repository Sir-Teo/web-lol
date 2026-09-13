import { HAWKSHOT_ECHO as E } from '../content/hawkshot-echo';
import type { ScoutFlight } from '../simulation/types';

/** Bound particles follow the emitter horizontally, dropping locally over their own lifetime. */
export function echoParticles(flight: ScoutFlight, seconds: number) {
  const start = (flight.launchTick - 1) / 60;
  const stop = flight.arrivalTick === undefined ? Infinity : flight.arrivalTick / 60;
  const from = Math.max(0, Math.ceil((seconds - E.lifetime - start) * E.rate));
  const to = Math.floor((Math.min(seconds, stop) - start) * E.rate);
  const distance = Math.min(
    flight.distance ?? Infinity,
    Math.max(0, seconds - start) * flight.speed
  );
  const particles = [];
  for (let index = from; index <= to; index++) {
    const birth = start + index / E.rate;
    const age = seconds - birth;
    if (birth >= stop || age < 0 || age >= E.lifetime) continue;
    particles.push({
      index,
      age,
      x: flight.origin.x + flight.direction.x * distance,
      y: flight.origin.y + flight.direction.y * distance,
      lift: E.velocity[1] * age * 0.01,
      alpha: E.alpha * (1 - age / E.lifetime),
    });
  }
  return particles;
}
