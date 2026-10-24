import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import luxBones from '../content/lux-hit-bones.json';

export interface TargetPoseLayer {
  clip: string;
  /** Explicit clip-local seconds. This sampler clamps; the caller owns looping. */
  time: number;
  weight: number;
}
/** A private skeleton samples explicit normal-blend poses without advancing or
 * modifying the live target. Construct from the unposed reference GLTF scene.
 * Geometry/materials/clips are borrowed. Results include the reference root's
 * transform, but no instance/world placement. Transition clocks belong to caller.
 */
export class TargetPoseSampler {
  private readonly root: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;
  private readonly clips = new Map<string, THREE.AnimationClip>();
  private readonly bones = new Map<string, THREE.Object3D | undefined>();
  private disposed = false;
  constructor(reference: THREE.Object3D, clips: readonly THREE.AnimationClip[]) {
    for (const clip of clips) {
      if (this.clips.has(clip.name)) throw new Error(`Duplicate target clip: ${clip.name}`);
      if (clip.blendMode !== THREE.NormalAnimationBlendMode)
        throw new Error('Target pose sampler requires normal animation blending');
      this.clips.set(clip.name, clip);
    }
    this.root = clone(reference);
    this.mixer = new THREE.AnimationMixer(this.root);
  }
  /** A caller may render this private pose, replacing borrowed mesh materials.
   * Keep placement on a parent so the reference root's authored transform survives.
   * The sampler owns its cloned skeletons, including lazily allocated bone textures;
   * callers retain ownership of replacement materials and parent containers. */
  get renderRoot(): THREE.Object3D {
    if (this.disposed) throw new Error('Target pose sampler has been disposed');
    return this.root;
  }
  sample(layers: readonly TargetPoseLayer[]) {
    if (this.disposed) throw new Error('Target pose sampler has been disposed');
    const seen = new Set<string>();
    // Validate before changing the previous sample. Duplicate actions cannot
    // represent two distinct times on one Three animation action.
    for (const layer of layers) {
      if (
        !this.clips.has(layer.clip) ||
        seen.has(layer.clip) ||
        !Number.isFinite(layer.time) ||
        !Number.isFinite(layer.weight) ||
        layer.weight < 0
      )
        throw new RangeError('Invalid target pose layer');
      seen.add(layer.clip);
    }
    this.mixer.stopAllAction();
    for (const layer of layers) {
      if (layer.weight === 0) continue;
      const clip = this.clips.get(layer.clip)!;
      const action = this.mixer.clipAction(clip);
      action.reset().setLoop(THREE.LoopOnce, 1).setEffectiveWeight(layer.weight).play();
      action.clampWhenFinished = true;
      action.time = Math.max(0, Math.min(clip.duration, layer.time));
      action.paused = true;
    }
    this.mixer.update(0);
    this.root.updateMatrixWorld(true);
  }
  hitPosition(critical: boolean, out: THREE.Vector3): boolean {
    return this.bonePosition(critical ? luxBones.critical : luxBones.normal, out);
  }
  private bone(name: string) {
    if (this.disposed) throw new Error('Target pose sampler has been disposed');
    const key = name.toLowerCase();
    if (!this.bones.has(key)) {
      let found: THREE.Object3D | undefined;
      this.root.traverse((node) => {
        if (node.name.toLowerCase() !== key) return;
        if (found) throw new Error(`Ambiguous authored attachment: ${name}`);
        found = node;
      });
      this.bones.set(key, found);
    }
    return this.bones.get(key);
  }
  /** Explicit authored names keep another champion's ordinary chest effect
   * independent of Lux's centre/chest critical routing. Missing stays missing. */
  bonePosition(name: string, out: THREE.Vector3): boolean {
    const bone = this.bone(name);
    if (!bone) return false;
    bone.getWorldPosition(out);
    return true;
  }
  boneMatrix(name: string, out: THREE.Matrix4): boolean {
    const bone = this.bone(name);
    if (!bone) return false;
    out.copy(bone.matrixWorld);
    return true;
  }
  dispose() {
    if (this.disposed) return;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.clips.clear();
    this.bones.clear();
    const skeletons = new Set<THREE.Skeleton>();
    this.root.traverse((node) => {
      if (node instanceof THREE.SkinnedMesh) skeletons.add(node.skeleton);
    });
    for (const skeleton of skeletons) skeleton.dispose();
    this.root.removeFromParent();
    this.root.clear();
    this.disposed = true;
  }
}
