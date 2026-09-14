import type * as THREE from 'three';
import names from '../content/lux-hit-bones.json';
/** Resolve the spell's authored attachment name. Case-folding accommodates the
 * existing model exports; missing nodes stay explicit rather than substituting
 * a chest/centre guess. Callers own transforms, time sampling and fallback.
 */
export function luxHitBone(root: THREE.Object3D, critical: boolean): THREE.Object3D | undefined {
  const name = (critical ? names.critical : names.normal).toLowerCase();
  let match: THREE.Object3D | undefined;
  root.traverse((node) => {
    if (node.name.toLowerCase() === name) {
      if (match) throw new Error('Ambiguous Lux hit attachment');
      match = node;
    }
  });
  return match;
}
