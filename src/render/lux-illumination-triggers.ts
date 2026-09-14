import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { ImpactRig } from '../content/impact-target';
import { LUX_ILLUMINATION_HISTORY_TICKS } from '../content/lux-illumination-presentation';
import { createTargetPoseSampler } from './models';
import { LuxImpactAttachments } from './lux-impact-attachments';
import {
  loadIlluminationTriggerTextures,
  LuxIlluminationTriggerCloud,
} from './lux-illumination-trigger-cloud';

let textures: Map<string, THREE.Texture> | undefined;
export async function loadLuxIlluminationTriggerTextures() {
  textures = await loadIlluminationTriggerTextures();
}
type Entry = {
  rig: ImpactRig | null;
  cloud: LuxIlluminationTriggerCloud;
  attachments: LuxImpactAttachments;
};

/** Saved detonation adapter. Reuses the normal impact bone as a provisional local
 * origin; the passive's native bone is not yet verified. Creation audience and
 * current origin sight are both required. Terminal playback drains frozen events. */
export class LuxIlluminationTriggers {
  readonly clouds = new Map<number, Entry>();
  private frame = new THREE.Matrix3().set(-1, 0, 0, 0, 1, 0, 0, 0, 1);
  constructor(
    private scene: THREE.Scene,
    private ground: (p: { x: number; y: number }) => number
  ) {}
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0) {
    if (!textures) return;
    const active = new Set<number>();
    const tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0);
    for (const effect of world.luxIlluminationVisuals) {
      if (!effect.audience.includes('blue')) continue;
      const time = (tick - effect.startTick) / 60;
      if (time >= LUX_ILLUMINATION_HISTORY_TICKS / 60) continue;
      let entry = this.clouds.get(effect.id);
      if (entry && entry.rig !== effect.targetRig) {
        this.release(entry);
        entry = undefined;
      }
      if (!entry) {
        entry = {
          rig: effect.targetRig,
          cloud: new LuxIlluminationTriggerCloud(textures),
          attachments: new LuxImpactAttachments(
            effect.targetRig ? createTargetPoseSampler(effect.targetRig) : null,
            this.ground
          ),
        };
        this.clouds.set(effect.id, entry);
        this.scene.add(entry.cloud.root);
      }
      const current = entry.attachments.point(effect, tick);
      entry.cloud.root.visible = world.pointVisible({ x: current.x * 100, y: current.z * 100 });
      const center = entry.attachments.point(effect, effect.startTick);
      const origin = (seconds: number) =>
        entry!.attachments
          .point(effect, effect.startTick + seconds * 60)
          .sub(center)
          .multiplyScalar(100)
          .applyMatrix3(this.frame);
      entry.cloud.draw(effect.id, time, camera, center, this.frame, Infinity, origin);
      active.add(effect.id);
    }
    for (const [id, entry] of this.clouds)
      if (!active.has(id)) {
        this.release(entry);
        this.clouds.delete(id);
      }
  }
  private release(entry: Entry) {
    entry.cloud.dispose();
    entry.attachments.dispose();
  }
}
