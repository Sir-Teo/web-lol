import * as THREE from 'three';
import source from '../content/gromp-death.json';
import { TICK_RATE } from '../content/rules';
import type { World } from '../simulation/world';
import type { UnitModel } from './models';
import { grompDeathParticles } from './gromp-death-particles';
import { createParticleColorProductMaterial } from './particle-color-product';

const textures = new Map<string, THREE.Texture>(),
  white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1),
  quad = new THREE.PlaneGeometry(2, 2);
white.needsUpdate = true;
for (let i = 0; i < 4; i++) {
  const uv = quad.getAttribute('uv');
  uv.setY(i, 1 - uv.getY(i));
}
let ready = false,
  pending: Promise<void> | undefined;

/** Only four shared textures load for this adapter. All other legacy assets
 * remain source exports until their emitters have a renderer. */
export function loadGrompDeath(): Promise<void> {
  if (ready) return Promise.resolve();
  if (pending) return pending;
  pending = (async () => {
    const images = new Map<string, THREE.Texture>(),
      paths = new Set(source.profiles.flatMap((p) => [p.texture, ...(p.lookup ? [p.lookup] : [])]));
    const results = await Promise.allSettled(
      [...paths].map(async (path) => {
        const texture = await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL + path);
        texture.colorSpace = THREE.NoColorSpace;
        texture.flipY = false;
        texture.generateMipmaps = false;
        texture.minFilter = texture.magFilter = THREE.LinearFilter;
        texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
        images.set(path, texture);
      })
    );
    const failed = results.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') {
      images.forEach((texture) => texture.dispose());
      throw failed.reason;
    }
    images.forEach((texture, path) => textures.set(path, texture));
    ready = true;
  })().catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}

/** Legacy render modes 0/1/4 map to ADD/BLEND/ADD_BLEND. The initial RGBA
 * product is shared with native shader inspection; final Gromp composition,
 * sampler state and camera-frame interpretation still need native comparison. */
export function createGrompDeathMaterial(
  index: number,
  base: THREE.Texture,
  lookup: THREE.Texture
) {
  const p = source.profiles[index],
    material = createParticleColorProductMaterial(base, lookup);
  Object.assign(material, {
    name: `Gromp death ${p.name}`,
    transparent: true,
    depthTest: p.depthTest,
    depthWrite: false,
    forceSinglePass: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: p.blend === 0 ? THREE.OneFactor : THREE.SrcAlphaFactor,
    blendDst: p.blend === 1 ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
  });
  return material;
}

export class GrompDeath {
  readonly models = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  private attachments = new WeakMap<UnitModel, THREE.Object3D | null>();
  private anchor = new THREE.Vector3();
  private rotation = new THREE.Quaternion();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  constructor(private scene: THREE.Scene) {}

  update(
    world: World,
    alpha: number,
    camera: THREE.Camera,
    unitModels: ReadonlyMap<number, UnitModel>,
    terminalAge = 0
  ) {
    const active = new Set<string>(),
      tick = world.tick - 1 + alpha + terminalAge * TICK_RATE;
    if (ready)
      for (const unit of world.units) {
        if (
          unit.kind !== 'monster' ||
          unit.monster.species !== 'gromp' ||
          unit.deadAt === null ||
          !world.visible(unit)
        )
          continue;
        const particles = grompDeathParticles(unit.deadAt, tick);
        if (!particles.length) continue;
        const model = unitModels.get(unit.id);
        if (!model?.root.visible) continue;
        if (!this.attachments.has(model))
          this.attachments.set(model, model.root.getObjectByName(source.bone) ?? null);
        const bone = this.attachments.get(model);
        // No fabricated ground/root fallback when the pinned attachment is absent.
        if (!bone) continue;
        bone.updateWorldMatrix(true, false);
        bone.getWorldPosition(this.anchor);
        for (const particle of particles) {
          const p = source.profiles[particle.profileIndex],
            key = `${unit.id}:${unit.deadAt}:${particle.profileIndex}`;
          active.add(key);
          let mesh = this.models.get(key);
          if (!mesh) {
            mesh = new THREE.Mesh(
              quad,
              createGrompDeathMaterial(
                particle.profileIndex,
                textures.get(p.texture)!,
                p.lookup ? textures.get(p.lookup)! : white
              )
            );
            mesh.name = `Gromp death ${p.name}`;
            mesh.userData.sourceId = unit.id;
            mesh.userData.deathTick = unit.deadAt;
            mesh.userData.attachment = source.bone;
            mesh.renderOrder = p.priority;
            mesh.frustumCulled = false;
            this.models.set(key, mesh);
            this.scene.add(mesh);
          }
          mesh.position.fromArray(particle.offset).multiplyScalar(0.01).add(this.anchor);
          // Local camera adapter: first source component is roll, then yaw/pitch.
          this.rotation.setFromEuler(
            this.euler.set(
              THREE.MathUtils.degToRad(p.rotation[2]),
              THREE.MathUtils.degToRad(p.rotation[1]),
              -THREE.MathUtils.degToRad(p.rotation[0]),
              'YXZ'
            )
          );
          mesh.quaternion.copy(camera.quaternion).multiply(this.rotation);
          mesh.scale.fromArray(particle.scale).multiplyScalar(0.01);
          const color = [...particle.color];
          if (p.blend === 0) {
            for (let i = 0; i < 3; i++) color[i] *= color[3];
            color[3] = 1;
          }
          mesh.material.uniforms.particleColor.value.fromArray(color);
          // The only authored lookup is color-hold: every source pixel is white.
          mesh.material.uniforms.lookupUv.value.set(particle.phase, 0.5);
        }
      }
    for (const [key, mesh] of this.models)
      if (!active.has(key)) {
        this.scene.remove(mesh);
        mesh.material.dispose();
        this.models.delete(key);
      }
  }
}
