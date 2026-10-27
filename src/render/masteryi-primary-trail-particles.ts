import data from '../content/masteryi-primary-trail-particles.json';
import { finiteTrailParticles } from './finite-trail-particles';
/** Complete selected primary systems; no gameplay RNG is consumed. */
export function primaryTrailParticles(seed: number, time: number, profile?: number) {
  return finiteTrailParticles(data.profiles, seed, time, profile);
}
