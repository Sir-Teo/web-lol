import { Quaternion, Vector3 } from 'three';
import type { solarParticles } from './leona-solar-particles';
export type SolarParticle = ReturnType<typeof solarParticles>[number];

/** Explicit source-unit world placement after the caller applies birth/current
 * origin, bind and orientation routing. Orbit is about current draw origin;
 * authored world acceleration follows it unturned. No CPU attachment default. */
export function solarDrawPoint(
  particle: SolarParticle,
  integratedWorldPoint: readonly number[],
  currentWorldOrigin: readonly number[]
) {
  const origin = new Vector3().fromArray(currentWorldOrigin),
    turn = new Quaternion().fromArray(particle.orbitTurn);
  return new Vector3()
    .fromArray(integratedWorldPoint)
    .sub(origin)
    .applyQuaternion(turn)
    .add(origin)
    .add(new Vector3().fromArray(particle.accelerationOffset))
    .toArray();
}

/** Left-compose orbital rotation over an explicit direction/basis vector. Raw
 * particle travel and its speed/stretch remain unchanged. Camera projection is
 * a later primitive-specific operation, not an invented world normal. */
export function solarDrawDirection(particle: SolarParticle, direction: readonly number[]) {
  return new Vector3()
    .fromArray(direction)
    .applyQuaternion(new Quaternion().fromArray(particle.orbitTurn))
    .toArray();
}
