import { sourceParticleBasis } from './source-particle-spin';

const identity = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

/** Spin, then native post rotation, then the supplied world basis. Other
 * own-basis factors (local orientation, orbit and travel aim) are not included.
 * Each multiplication writes float32 before the next source-reader stage. */
export function sourceParticlePostRotation(
  rotation: ArrayLike<number>,
  postRotate: ArrayLike<number> | null,
  worldBasis: ArrayLike<number> = identity
): Float32Array {
  if (
    worldBasis.length !== 9 ||
    !Array.from(worldBasis).every((v) => Number.isFinite(v) && Number.isFinite(Math.fround(v)))
  )
    throw RangeError('Invalid source particle world basis');
  const multiply = (a: Float32Array, b: Float32Array) => {
    const result = new Float32Array(9);
    for (let row = 0; row < 3; row++)
      for (let column = 0; column < 3; column++)
        result[row * 3 + column] =
          a[row * 3] * b[column] + a[row * 3 + 1] * b[3 + column] + a[row * 3 + 2] * b[6 + column];
    return result;
  };
  let basis = sourceParticleBasis(rotation);
  if (postRotate !== null) basis = multiply(sourceParticleBasis(postRotate), basis);
  return multiply(Float32Array.from(worldBasis), basis);
}
