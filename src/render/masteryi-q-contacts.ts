import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import data from '../content/masteryi-q-contact-particles.json';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { checkedAssetBytes, loadAuthoredMipTexture } from './authored-mip-texture';
import { alphaContactParticles } from './masteryi-q-contact-particles';
import { createParticleColorProductMaterial } from './particle-color-product';

const textures = new Map<string, Awaited<ReturnType<typeof loadAuthoredMipTexture>>>();
let geometry: THREE.BufferGeometry | undefined,
  ready = false,
  pending: Promise<void> | undefined;

/** Present/late-spawn only. Keep verified successes across an explicit retry;
 * the renderer admits particles only after the complete selected closure loads. */
export function loadAlphaContacts(): Promise<void> {
  if (ready) return Promise.resolve();
  return (pending ??= (async () => {
    const outcomes = await Promise.allSettled([
      ...data.textures
        .filter((asset) => !textures.has(asset.key))
        .map(async (asset) => {
          const lookup = data.profiles.some((p) => p.lookup === asset.key);
          const loaded = await loadAuthoredMipTexture(asset, lookup);
          textures.set(asset.key, loaded);
        }),
      ...(geometry
        ? []
        : [
            (async () => {
              const raw = await checkedAssetBytes(data.mesh.url, data.mesh.bytes, data.mesh.sha256);
              const gltf = await new GLTFLoader().parseAsync(raw, import.meta.env.BASE_URL);
              const found: THREE.BufferGeometry[] = [];
              gltf.scene.traverse((o) => {
                if (!(o instanceof THREE.Mesh)) return;
                found.push(o.geometry);
                for (const material of Array.isArray(o.material) ? o.material : [o.material])
                  material.dispose();
              });
              if (found.length !== 1) {
                found.forEach((g) => g.dispose());
                throw Error('Invalid Alpha Strike contact mesh closure');
              }
              geometry = found[0];
            })(),
          ]),
    ]);
    const failed = outcomes.find((outcome) => outcome.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
    ready = true;
  })().catch((error) => {
    pending = undefined;
    throw error;
  }));
}

const billboard = new THREE.PlaneGeometry(2, 2);
for (let i = 0; i < 4; i++) {
  const uv = billboard.getAttribute('uv');
  uv.setY(i, 1 - uv.getY(i));
}
export function createAlphaContactMaterial(
  index: number,
  base: THREE.Texture,
  lookup: THREE.Texture
) {
  const p = data.profiles[index],
    material = createParticleColorProductMaterial(base, lookup);
  Object.assign(material, {
    name: `Alpha Strike ${p.system} ${p.name}`,
    transparent: true,
    depthWrite: false,
    depthTest: (p.miscRenderFlags & 1) === 0,
    forceSinglePass: true,
    side: p.doubleSided || p.kind !== 'mesh' ? THREE.DoubleSide : THREE.FrontSide,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendEquationAlpha: THREE.AddEquation,
    blendSrc: p.blend === 0 ? THREE.OneFactor : THREE.SrcAlphaFactor,
    blendDst: p.blend === 1 ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
    blendSrcAlpha: p.blend === 0 ? THREE.OneFactor : THREE.SrcAlphaFactor,
    blendDstAlpha: p.blend === 1 ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
  });
  return material;
}

type ContactMesh = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
export class AlphaContacts {
  readonly models = new Map<string, ContactMesh>();
  private heading = new THREE.Quaternion();
  private rotation = new THREE.Quaternion();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  constructor(
    private scene: THREE.Scene,
    private ground: (point: Vec2) => number
  ) {}
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0): void {
    const active = new Set<string>();
    const tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0);
    if (ready)
      for (const unit of world.units) {
        if (unit.champion !== 'masteryi') continue;
        const records = world.championState(unit.id)?.alphaContactVisuals;
        if (!records?.length) continue;
        for (const particle of alphaContactParticles(unit.id, records, tick, 'blue')) {
          const p = data.profiles[particle.profileIndex],
            r = particle.record;
          const key = `${unit.id}:${r.castTick}:${r.markIndex}:${particle.profileIndex}:${particle.ordinal}`;
          active.add(key);
          let mesh = this.models.get(key);
          if (!mesh) {
            mesh = new THREE.Mesh(
              p.kind === 'mesh' ? geometry! : billboard,
              createAlphaContactMaterial(
                particle.profileIndex,
                textures.get(p.texture)!.texture,
                textures.get(p.lookup)!.texture
              )
            );
            mesh.name = `Alpha Strike ${p.system} ${p.index} ${p.name}`;
            mesh.frustumCulled = false;
            mesh.renderOrder = p.renderOrder;
            Object.assign(mesh.userData, {
              sourceId: unit.id,
              castTick: r.castTick,
              markIndex: r.markIndex,
              targetId: r.targetId,
              profileIndex: particle.profileIndex,
              ordinal: particle.ordinal,
              bornTick: particle.bornTick,
              critical: r.critical,
            });
            this.models.set(key, mesh);
            this.scene.add(mesh);
          }
          this.heading.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, r.facing);
          const offset = new THREE.Vector3(...particle.offset)
            .multiplyScalar(0.01)
            .applyQuaternion(this.heading);
          mesh.position
            .set(particle.point.x * 0.01, this.ground(particle.point), particle.point.y * 0.01)
            .add(offset);
          if (p.kind === 'billboard') {
            mesh.quaternion.copy(camera.quaternion);
            mesh.rotateZ(-THREE.MathUtils.degToRad(particle.rotation[0]));
          } else
            mesh.quaternion
              .copy(this.heading)
              .multiply(
                this.rotation.setFromEuler(
                  this.euler.set(
                    ...(particle.rotation.map(THREE.MathUtils.degToRad) as [
                      number,
                      number,
                      number,
                    ]),
                    'YXZ'
                  )
                )
              );
          mesh.scale.fromArray(particle.scale).multiplyScalar(p.kind === 'mesh' ? 1 : 0.01);
          const color = [...particle.color];
          if (p.blend === 0) {
            for (let i = 0; i < 3; i++) color[i] *= color[3];
            color[3] = 1;
          }
          mesh.material.uniforms.particleColor.value.fromArray(color);
          mesh.material.uniforms.lookupUv.value.fromArray(particle.lookup);
          mesh.material.uniforms.sourceUvOffset.value.fromArray(particle.scroll);
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
