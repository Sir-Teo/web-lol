import data from '../content/masteryi-passive-trail-particles.json';
import { finiteTrailParticles } from './finite-trail-particles';
/** Separate complete profiles for the two authored Passive events. */
export function passiveTrailParticles(seed: number, time: number, profile?: number) {
  return finiteTrailParticles(data.profiles, seed, time, profile);
}
