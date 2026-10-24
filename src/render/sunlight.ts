import * as THREE from 'three';
import profiles from '../content/leona-sunlight-particles.json';
import {
  SUNLIGHT_BONE,
  SUNLIGHT_VISUAL_HISTORY_TICKS,
} from '../content/leona-sunlight-presentation';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { UnitModel } from './models';
import { createTargetPoseSampler } from './models';
import { ImpactAttachments } from './impact-attachments';
import { createParticleColorProductMaterial } from './particle-color-product';
import { loadLuxParticleTextures } from './lux-particle-textures';
import { sunlightParticles } from './sunlight-particles';

let textures: Map<string, THREE.Texture> | undefined;
export async function loadSunlight() {
  textures = await loadLuxParticleTextures(profiles.flatMap((p) => [p.texture, p.lookup]));
}
const quad = new THREE.PlaneGeometry(2, 2);
const uv = quad.getAttribute('uv');
for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));

/** Local centre-bone anchor, root+0.9 fallback for procedural targets. Birth
 * audience is saved independently of current sight; later reveal cannot create
 * an unseen burst. Six emitters borrow source textures/shared quad geometry. */
export class Sunlight {
  readonly models = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  private attachments = new Map<number, ImpactAttachments>();
  private point = new THREE.Vector3();
  private roll = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 0, 1);
  private worldUp = new THREE.Vector3(0, 1, 0);
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  update(
    world: World,
    alpha: number,
    camera: THREE.Camera,
    unitModels: ReadonlyMap<number, UnitModel>,
    terminalAge = 0
  ) {
    const active = new Set<string>(),
      histories = new Set<number>();
    if (textures) {
      const tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0);
      for (const target of world.units) {
        const mark = target.sunlight,
          model = unitModels.get(target.id);
        if (!mark || !world.alive(target) || !world.visible(target) || !model?.root.visible)
          continue;
        let bone: THREE.Object3D | undefined;
        model.root.traverse((o) => {
          if (o.name.toLowerCase() === SUNLIGHT_BONE.toLowerCase()) bone = o;
        });
        if (bone) bone.getWorldPosition(this.point);
        else {
          model.root.getWorldPosition(this.point);
          this.point.y += 0.9;
        }
        const seed =
          target.id ^ Math.imul(mark.sourceId, 0x85ebca6b) ^ Math.imul(mark.startTick, 0x9e3779b9);
        for (const p of sunlightParticles(
          target.kind === 'champion' ? 'champion' : 'mark',
          seed,
          (tick - mark.startTick) / 60,
          target.radius
        ))
          this.draw(
            `mark:${target.id}:${mark.sourceId}:${mark.startTick}`,
            p,
            this.point,
            target.facing,
            camera,
            active,
            bone?.name ?? 'local-centre-fallback'
          );
      }
      for (const effect of world.sunlightVisuals) {
        if (
          !effect.audience.includes('blue') ||
          tick >= effect.startTick + SUNLIGHT_VISUAL_HISTORY_TICKS
        )
          continue;
        const birth = effect.frames.find((f) => f.tick === effect.startTick + 1);
        if (!birth?.audience.includes('blue')) continue;
        histories.add(effect.id);
        let path = this.attachments.get(effect.id);
        if (!path) {
          path = new ImpactAttachments(
            effect.targetRig ? createTargetPoseSampler(effect.targetRig) : null,
            this.ground,
            () => SUNLIGHT_BONE
          );
          this.attachments.set(effect.id, path);
        }
        for (const p of sunlightParticles(
          'hit',
          effect.id,
          (tick - effect.startTick) / 60,
          effect.radius
        )) {
          const anchor = path.point(effect, p.bind === 1 ? tick : effect.startTick + p.bornTick);
          const at = Math.min(effect.frames.length - 1, p.bornTick),
            facing = effect.frames[at].facing;
          // Check each particle at its actual placed point, including detached flares.
          const position = this.position(anchor, p.offset, facing);
          if (!world.pointVisible({ x: position.x * 100, y: position.z * 100 })) continue;
          this.draw(`hit:${effect.id}`, p, anchor, facing, camera, active, SUNLIGHT_BONE);
        }
      }
    }
    for (const [key, m] of this.models)
      if (!active.has(key)) {
        this.scene.remove(m);
        m.material.dispose();
        this.models.delete(key);
      }
    for (const [id, path] of this.attachments)
      if (!histories.has(id)) {
        path.dispose();
        this.attachments.delete(id);
      }
  }
  private position(anchor: THREE.Vector3, offset: readonly number[], facing: number) {
    return new THREE.Vector3(-offset[0], offset[1], offset[2])
      .multiplyScalar(0.01)
      .applyAxisAngle(this.worldUp, facing)
      .add(anchor);
  }
  private draw(
    key: string,
    p: ReturnType<typeof sunlightParticles>[number],
    anchor: THREE.Vector3,
    facing: number,
    camera: THREE.Camera,
    active: Set<string>,
    attachment: string
  ) {
    const profile = profiles[p.profileIndex];
    key += `:${p.profileIndex}:${p.ordinal}`;
    active.add(key);
    let mesh = this.models.get(key);
    if (!mesh) {
      const material = createParticleColorProductMaterial(
        textures!.get(profile.texture)!,
        textures!.get(profile.lookup)!
      );
      Object.assign(material, {
        transparent: true,
        depthTest: (profile.miscRenderFlags & 1) === 0,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
      });
      mesh = new THREE.Mesh(quad, material);
      mesh.name = `Sunlight ${profile.role} ${profile.name}`;
      mesh.frustumCulled = false;
      mesh.renderOrder = profile.renderOrder;
      this.models.set(key, mesh);
      this.scene.add(mesh);
    }
    mesh.position.copy(this.position(anchor, p.offset, facing));
    mesh.quaternion
      .copy(camera.quaternion)
      .multiply(this.roll.setFromAxisAngle(this.up, (p.rotation[0] * Math.PI) / 180));
    mesh.scale.set(p.size[0] * 0.01, p.size[1] * 0.01, 1);
    mesh.material.uniforms.particleColor.value.fromArray(p.color);
    mesh.material.uniforms.lookupUv.value.fromArray(p.lookup);
    Object.assign(mesh.userData, {
      profileIndex: p.profileIndex,
      ordinal: p.ordinal,
      role: profile.role,
      age: p.age,
      phase: p.phase,
      attachment,
    });
  }
}
