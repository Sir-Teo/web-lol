import * as THREE from 'three';
import type { MobilePose } from './mobile-pose';
import type { PoseLayer } from '../simulation/animation-timeline';

const activeClips = new WeakMap<THREE.AnimationMixer, string[]>();

/** Keep bindings active while their ordered blend is unchanged. All clocks,
 * weights and loop policies are still assigned absolutely for every sample. */
export function applyMobileAnimation(
  mixer: THREE.AnimationMixer,
  actions: Record<string, THREE.AnimationAction>,
  pose: MobilePose,
  layers: readonly PoseLayer[]
): void {
  const clips = [pose.clip, ...layers.filter((l) => l.clip !== pose.clip).map((l) => l.clip)];
  const previous = activeClips.get(mixer);
  if (!previous || clips.length !== previous.length || clips.some((c, i) => c !== previous[i])) {
    // Preserve the original accumulation order, including the zero-weight
    // primary during the first sample of a transition.
    mixer.stopAllAction();
    for (const clip of clips) actions[clip].reset().play();
    activeClips.set(mixer, clips);
  }
  const primary = actions[pose.clip];
  primary.enabled = true;
  primary.setLoop(pose.loop ? THREE.LoopRepeat : THREE.LoopOnce, pose.loop ? Infinity : 1);
  primary.setEffectiveWeight(0);
  primary.time = pose.time;
  primary.paused = true;
  primary.clampWhenFinished = !pose.loop;
  primary.timeScale = pose.kind === 'attack' ? pose.rate : 1;
  for (const layer of layers) {
    const action = actions[layer.clip];
    action.enabled = true;
    action.setLoop(layer.loop ? THREE.LoopRepeat : THREE.LoopOnce, layer.loop ? Infinity : 1);
    action.setEffectiveWeight(layer.weight);
    action.time = layer.time;
    action.paused = true;
    action.clampWhenFinished = !layer.loop;
    action.timeScale = layer.rate;
  }
  mixer.update(0);
}
