import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { luxHitBone } from './lux-hit-bone';

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
  private readonly bones: (THREE.Object3D | undefined)[];
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
    this.bones = [luxHitBone(this.root, false), luxHitBone(this.root, true)];
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
    if (this.disposed) throw new Error('Target pose sampler has been disposed');
    const bone = this.bones[critical ? 1 : 0];
    if (!bone) return false;
    bone.getWorldPosition(out);
    return true;
  }
  dispose() {
    if (this.disposed) return;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.clips.clear();
    this.root.clear();
    this.disposed = true;
  }
}
