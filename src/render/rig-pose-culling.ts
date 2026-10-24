import * as THREE from 'three';
import { animationCullingSphere } from './animation-bounds';

interface RigBounds {
  sphere: THREE.Sphere;
  meshes: THREE.SkinnedMesh[];
  sampled: boolean;
  sleeping: boolean;
  bones: { node: THREE.Bone; local: boolean; world: boolean }[];
}

/** Unlike Sphere.applyMatrix4's maximum column length, this operator-norm
 * bound also covers authored shear and rotated nonuniform ancestor scales. */
function transformSphere(sphere: THREE.Sphere, matrix: THREE.Matrix4): THREE.Sphere {
  const m = matrix.elements;
  const row = Math.max(
    Math.abs(m[0]) + Math.abs(m[4]) + Math.abs(m[8]),
    Math.abs(m[1]) + Math.abs(m[5]) + Math.abs(m[9]),
    Math.abs(m[2]) + Math.abs(m[6]) + Math.abs(m[10])
  );
  const column = Math.max(
    Math.abs(m[0]) + Math.abs(m[1]) + Math.abs(m[2]),
    Math.abs(m[4]) + Math.abs(m[5]) + Math.abs(m[6]),
    Math.abs(m[8]) + Math.abs(m[9]) + Math.abs(m[10])
  );
  sphere.center.applyMatrix4(matrix);
  sphere.radius *= Math.sqrt(row * column);
  return sphere;
}

/** Pose work can sleep only when the complete animation envelope misses both
 * the display camera and GameView's directional shadow camera. Callers must
 * keep rigs with live bone attachments awake. Unsupported rigs stay awake. */
export class RigPoseCulling {
  private readonly camera = new THREE.Frustum();
  private readonly shadow = new THREE.Frustum();
  private readonly projection = new THREE.Matrix4();
  private readonly inverse = new THREE.Matrix4();
  private readonly relative = new THREE.Matrix4();
  private readonly sphere = new THREE.Sphere();
  private readonly rigs = new WeakMap<THREE.Object3D, RigBounds | null>();
  private hasShadow = false;

  beginFrame(camera: THREE.Camera, sun?: THREE.DirectionalLight): void {
    this.camera.setFromProjectionMatrix(
      this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    );
    this.hasShadow = !!sun;
    if (sun) {
      sun.updateWorldMatrix(true, false);
      sun.target.updateWorldMatrix(true, false);
      sun.shadow.updateMatrices(sun);
      this.shadow.copy(sun.shadow.getFrustum());
    }
  }

  canSkip(root: THREE.Object3D): boolean {
    let rig = this.rigs.get(root);
    if (rig === undefined) {
      // Supported animation bounds guarantee that mesh-to-rig paths are static.
      // Include hidden meshes too, so spawn/destruction submesh swaps are covered.
      root.matrixWorldNeedsUpdate = true;
      root.updateWorldMatrix(true, true);
      this.inverse.copy(root.matrixWorld).invert();
      const sphere = new THREE.Sphere().makeEmpty();
      const meshes: THREE.SkinnedMesh[] = [];
      const bones: RigBounds['bones'] = [];
      const renderAncestors = new Set<THREE.Object3D>();
      let supported = true;
      root.traverse((node) => {
        if (node instanceof THREE.Bone)
          bones.push({ node, local: node.matrixAutoUpdate, world: node.matrixWorldAutoUpdate });
        if (
          node instanceof THREE.Line ||
          node instanceof THREE.Points ||
          node instanceof THREE.Sprite
        )
          supported = false;
        if (!(node instanceof THREE.Mesh)) return;
        for (let parent = node.parent; parent && parent !== root; parent = parent.parent)
          renderAncestors.add(parent);
        if (!(node instanceof THREE.SkinnedMesh) || node.userData.animationBounds !== true) {
          supported = false;
          return;
        }
        const bound = animationCullingSphere(node);
        if (!bound) {
          supported = false;
          return;
        }
        meshes.push(node);
        this.relative.multiplyMatrices(this.inverse, node.matrixWorld);
        sphere.union(transformSphere(this.sphere.copy(bound), this.relative));
      });
      // Cover numerical error in matrix conversion and the union operation.
      sphere.radius = sphere.radius * 1.0000001 + 0.00001;
      rig =
        supported && meshes.length
          ? {
              sphere,
              meshes,
              sampled: false,
              sleeping: false,
              // Keep mesh placement current for ordinary camera/shadow culling.
              // Only private skeletal branches can freeze their world matrices.
              bones: bones.filter(({ node }) => !renderAncestors.has(node)),
            }
          : null;
      this.rigs.set(root, rig);
    }
    if (!rig) return false;
    // Preserve the original first-pose sorting-sphere sampling, including newly
    // visible submeshes. The envelope is separate from that sorting sphere.
    if (!rig.sampled) {
      rig.sampled = true;
      return false;
    }
    if (rig.meshes.some((mesh) => mesh.visible && mesh.boundingSphere === null)) return false;
    // Manual structure matrices do not automatically mark themselves dirty.
    root.matrixWorldNeedsUpdate = true;
    root.updateWorldMatrix(true, false);
    transformSphere(this.sphere.copy(rig.sphere), root.matrixWorld);
    return (
      !this.camera.intersectsSphere(this.sphere) &&
      (!this.hasShadow || !this.shadow.intersectsSphere(this.sphere))
    );
  }

  setSleeping(root: THREE.Object3D, sleeping: boolean): void {
    const rig = this.rigs.get(root);
    if (!rig || rig.sleeping === sleeping) return;
    for (const { node, local, world } of rig.bones) {
      node.matrixAutoUpdate = sleeping ? false : local;
      node.matrixWorldAutoUpdate = sleeping ? false : world;
      if (!sleeping) node.matrixWorldNeedsUpdate = true;
    }
    rig.sleeping = sleeping;
  }
}
