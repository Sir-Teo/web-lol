import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import profile from '../content/garen-q-particles.json';
import type { World } from '../simulation/world';
import type { UnitModel } from './models';
import { garenQTrailParticles } from './garen-q-particles';
import { createParticleColorProductMaterial } from './particle-color-product';

let geometry: THREE.BufferGeometry | undefined;
const textures = new Map<string, THREE.Texture>();
let pending: Promise<void> | undefined;
export function loadGarenDecisiveStrike(): Promise<void> {
  if (geometry) return Promise.resolve();
  return (pending ??= (async () => {
    let candidate: THREE.BufferGeometry | undefined;
    const images = new Map<string, THREE.Texture>();
    const result = await Promise.allSettled([
      (async () => {
        const gltf = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + profile.mesh);
        gltf.scene.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          candidate = o.geometry;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
        });
        if (!candidate) throw new Error('Missing Q source weapon trail mesh');
      })(),
      ...[profile.texture, profile.lookup].map(async (path) => {
        const texture = await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL + path);
        texture.colorSpace = THREE.NoColorSpace;
        texture.flipY = false;
        texture.generateMipmaps = false;
        texture.minFilter = texture.magFilter = THREE.LinearFilter;
        texture.wrapS = texture.wrapT =
          path === profile.lookup ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
        images.set(path, texture);
      }),
    ]);
    const failed = result.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') {
      candidate?.dispose();
      images.forEach((t) => t.dispose());
      throw failed.reason;
    }
    images.forEach((t, path) => textures.set(path, t));
    geometry = candidate!;
  })().catch((error) => {
    pending = undefined;
    throw error;
  }));
}
export function createGarenQTrailMaterial(base: THREE.Texture, lookup: THREE.Texture) {
  const material = createParticleColorProductMaterial(base, lookup);
  Object.assign(material, {
    name: 'Decisive Strike source weapon trail',
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    forceSinglePass: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor,
  });
  return material;
}
export class GarenDecisiveStrike {
  readonly models = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  private bones = new WeakMap<UnitModel, THREE.Object3D | null>();
  private anchor = new THREE.Vector3();
  private heading = new THREE.Quaternion();
  private offset = new THREE.Vector3();
  private rotation = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      ...(profile.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
      'YXZ'
    )
  );
  constructor(private scene: THREE.Scene) {}
  update(world: World, alpha: number, unitModels: ReadonlyMap<number, UnitModel>, terminalAge = 0) {
    const active = new Set<string>();
    if (geometry)
      for (const unit of world.units) {
        if (unit.champion !== 'garen' || (unit.team !== 'blue' && !world.visible(unit))) continue;
        const model = unitModels.get(unit.id);
        if (!model?.root.visible) continue;
        if (!this.bones.has(model)) {
          let bone: THREE.Object3D | null = null;
          model.root.traverse((o) => {
            if (o.name === profile.bone) bone = o;
          });
          this.bones.set(model, bone);
        }
        const bone = this.bones.get(model);
        if (!bone) continue; // Never invent a root fallback for the explicit source binding.
        bone.getWorldPosition(this.anchor);
        const tick = world.tick - 1 + alpha + terminalAge * 60;
        for (const p of garenQTrailParticles(world.championState(unit.id)!.garenQVisuals, tick)) {
          const key = `${unit.id}:${p.startTick}:${p.ordinal}`;
          active.add(key);
          let mesh = this.models.get(key);
          if (!mesh) {
            mesh = new THREE.Mesh(
              geometry,
              createGarenQTrailMaterial(
                textures.get(profile.texture)!,
                textures.get(profile.lookup)!
              )
            );
            mesh.name = 'Garen Q WeaponTrail';
            Object.assign(mesh.userData, {
              sourceId: unit.id,
              startTick: p.startTick,
              castTick: p.castTick,
              bornTick: p.bornTick,
              bone: profile.bone,
            });
            mesh.frustumCulled = false;
            this.models.set(key, mesh);
            this.scene.add(mesh);
          }
          this.heading.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.facing);
          this.offset
            .fromArray(profile.position)
            .multiplyScalar(0.01)
            .applyQuaternion(this.heading);
          mesh.position.copy(this.anchor).add(this.offset);
          mesh.quaternion.copy(this.heading).multiply(this.rotation);
          mesh.scale.fromArray(profile.scale);
          mesh.material.uniforms.particleColor.value.fromArray(profile.color);
          mesh.material.uniforms.lookupUv.value.fromArray(p.lookup);
          mesh.material.uniforms.sourceUvOffset.value.fromArray(p.scroll);
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
