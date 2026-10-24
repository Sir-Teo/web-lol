import { Euler, Matrix4, Quaternion, MathUtils } from 'three';
import type { SolarParticle } from './leona-solar-frame';
import type { DecalFootprint } from './particle-decal-receivers';

/** Explicit identity-outer-frame reconstruction for the two nonlocal R
 * projectors. Exact2adda row-major basis[0]/[6] correspond to Three[0]/[2].
 * The source-X reflection is applied separately in the UV mapping. This is not
 * a recovered native16.18 CPU matrix, receiver-selection or height-center rule. */
export function solarProjectionFrame(
  particle: SolarParticle,
  center: readonly [number, number, number],
  projection: { mYRange: number; mFading: number }
) {
  const rotation = new Quaternion().setFromEuler(
      new Euler(
        MathUtils.degToRad(particle.rotation[0]),
        MathUtils.degToRad(particle.rotation[1]),
        MathUtils.degToRad(particle.rotation[2]),
        'YXZ'
      )
    ),
    basis = new Matrix4().makeRotationFromQuaternion(rotation).elements;
  let angle = Math.atan2(-Math.fround(basis[0]), Math.fround(basis[2]));
  if (angle < 0) angle += Math.PI * 2;
  const footprint: DecalFootprint = {
      center,
      halfWidth: particle.size[0] * 0.01,
      halfHeight: particle.size[2] * 0.01,
      turn: angle - Math.PI * 1.5,
      reflectX: true,
    },
    heightRange: [number, number, number] = [
      center[1],
      projection.mYRange * 0.01,
      projection.mFading * 0.01,
    ];
  if (
    ![...center, ...heightRange, footprint.halfWidth, footprint.halfHeight, footprint.turn].every(
      Number.isFinite
    ) ||
    footprint.halfWidth <= 0 ||
    footprint.halfHeight <= 0 ||
    heightRange[2] <= 0
  )
    throw RangeError('Invalid Solar projection frame');
  return { footprint, heightRange };
}
