import * as THREE from 'three';
import type { World } from '../simulation/world';
import type { UnitModel } from './models';
import { LUX_ILLUMINATION } from '../content/lux-illumination';
import { luxHitBone } from './lux-hit-bone';
import { loadIlluminationTextures, LuxIlluminationCloud } from './lux-illumination-cloud';

let textures: Map<string, THREE.Texture> | undefined;
export async function loadLuxIlluminationTextures() {
  textures = await loadIlluminationTextures();
}

/** Local buff adapter: refresh restarts the mark's particle clock; removal kills
 * its cloud immediately. Native refresh/tail behavior remains a comparison target.
 * The existing centre buff bone is reused as an explicitly provisional anchor. */
export class LuxIllumination {
  readonly models = new Map<string, LuxIlluminationCloud>();
  private attachments = new WeakMap<UnitModel, THREE.Object3D | undefined>();
  private center = new THREE.Vector3();
  // The ray emitter is authored with isLocalOrientation=false: target translation
  // binds fully, while the source frame does not inherit target/bone rotation.
  private frame = new THREE.Matrix3().set(-1, 0, 0, 0, 1, 0, 0, 0, 1);
  constructor(private scene: THREE.Scene) {}
  update(
    world: World,
    alpha: number,
    camera: THREE.Camera,
    unitModels: ReadonlyMap<number, UnitModel>
  ) {
    if (!textures) return;
    const active = new Set<string>();
    for (const target of world.units) {
      if (!world.alive(target) || !world.visible(target)) continue;
      const model = unitModels.get(target.id);
      if (!model?.root.visible) continue;
      const marks = target.illumination.filter((mark) => mark.endTick > world.tick);
      if (!marks.length) continue;
      if (!this.attachments.has(model)) this.attachments.set(model, luxHitBone(model.root, false));
      const attachment = this.attachments.get(model);
      if (attachment) attachment.getWorldPosition(this.center);
      else {
        model.root.getWorldPosition(this.center);
        this.center.y += 0.9;
      }
      for (const mark of marks) {
        const key = `${target.id}:${mark.sourceId}`;
        const startTick = mark.endTick - LUX_ILLUMINATION.durationSeconds * 60;
        const time = (world.tick - 1 + alpha - startTick) / 60;
        let cloud = this.models.get(key);
        if (!cloud) {
          cloud = new LuxIlluminationCloud(textures);
          cloud.root.userData.targetId = target.id;
          cloud.root.userData.sourceId = mark.sourceId;
          cloud.root.userData.attachment = attachment?.name ?? 'local-centre-fallback';
          this.models.set(key, cloud);
          this.scene.add(cloud.root);
        }
        cloud.root.userData.startTick = startTick;
        const seed =
          target.id ^ Math.imul(mark.sourceId, 0x85ebca6b) ^ Math.imul(startTick, 0x9e3779b9);
        cloud.draw(seed, time, camera, this.center, this.frame);
        active.add(key);
      }
    }
    for (const [key, cloud] of this.models) {
      if (active.has(key)) continue;
      cloud.dispose();
      this.models.delete(key);
    }
  }
}
