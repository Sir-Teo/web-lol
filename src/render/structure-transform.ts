import { Matrix4 } from 'three';
/** Authored map transform for structure geometry already converted to world units. */
export function structureModelMatrix(source: readonly number[]): Matrix4 {
  return new Matrix4()
    .fromArray(source)
    .premultiply(new Matrix4().makeScale(0.01, 0.01, -0.01))
    .premultiply(new Matrix4().makeTranslation(-74.25, 0, 74.25))
    .multiply(new Matrix4().makeScale(100, 100, 100));
}
