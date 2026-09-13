import * as THREE from 'three';
import type { UnitModel } from './models';

// Characters/Ashe/Animations/Skin0, Recall SequencerClipData.
// Source order is pinned in docs/reference/ashe-model.json. Native transition
// blending remains uncalibrated; seek one source clip without history-dependent fades.
export const ASHE_RECALL_CLIPS = ['idle5', 'idle2'] as const;

export function animateRecall(model: UnitModel, seconds: number): void {
  if (!model.mixer || !model.actions) return;
  let time = Math.max(0, seconds);
  const clips =
    model.referenceAsset === 'lux-base' ? ['idle3', 'entry_b4dcde19'] : ASHE_RECALL_CLIPS;
  let name: string = clips[0];
  for (const clip of clips) {
    name = clip;
    const duration = model.actions[clip].getClip().duration;
    if (time < duration || clip === clips.at(-1)) break;
    time -= duration;
  }
  const action = model.actions[name];
  if (model.actionName !== name) {
    model.mixer.stopAllAction();
    action.reset().setLoop(THREE.LoopOnce, 1).play();
    model.actionName = name;
  }
  action.setEffectiveWeight(1);
  action.clampWhenFinished = true;
  action.time = Math.min(time, action.getClip().duration);
  action.paused = true;
  model.mixer.update(0);
}
