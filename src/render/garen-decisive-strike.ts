import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import profile from '../content/garen-q-particles.json';
import castProfiles from '../content/garen-q-cast-particles.json';
import type { World } from '../simulation/world';
import type { UnitModel } from './models';
import { garenQTrailParticles, garenQCastParticles } from './garen-q-particles';
import { createParticleColorProductMaterial } from './particle-color-product';

const geometries = new Map<string, THREE.BufferGeometry>();
let ready = false;
const textures = new Map<string, THREE.Texture>();
let pending: Promise<void> | undefined;
export function loadGarenDecisiveStrike(): Promise<void> {
  if (ready) return Promise.resolve();
  return (pending ??= (async () => {
    const candidates = new Map<string, THREE.BufferGeometry>();
    const meshPaths = [
      ...new Set([profile.mesh, ...castProfiles.flatMap((p) => (p.mesh ? [p.mesh] : []))]),
    ];
    const imagePaths = [
      ...new Set([
        profile.texture,
        profile.lookup,
        ...castProfiles.flatMap((p) => [p.texture, ...(p.lookup ? [p.lookup] : [])]),
      ]),
    ];
    const images = new Map<string, THREE.Texture>();
    const result = await Promise.allSettled([
      ...meshPaths.map(async (path) => {
        const gltf = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + path);
        gltf.scene.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          candidates.set(path, o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
        });
        if (!candidates.has(path)) throw new Error(`Missing Q source mesh: ${path}`);
      }),
      ...imagePaths.map(async (path) => {
        const texture = await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL + path);
        texture.colorSpace = THREE.NoColorSpace;
        texture.flipY = false;
        texture.generateMipmaps = false;
        texture.minFilter = texture.magFilter = THREE.LinearFilter;
        texture.wrapS = texture.wrapT =
          path === profile.lookup || castProfiles.some((p) => p.lookup === path)
            ? THREE.ClampToEdgeWrapping
            : THREE.RepeatWrapping;
        images.set(path, texture);
      }),
    ]);
    const failed = result.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') {
      candidates.forEach((g) => g.dispose());
      images.forEach((t) => t.dispose());
      throw failed.reason;
    }
    images.forEach((t, path) => textures.set(path, t));
    candidates.forEach((g, path) => geometries.set(path, g));
    ready = true;
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
const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
white.needsUpdate = true;
const quad = new THREE.PlaneGeometry(2, 2),
  billboard = new THREE.PlaneGeometry(2, 2);
for (let i = 0; i < 4; i++) {
  const uv = quad.getAttribute('uv'),
    u = uv.getX(i),
    v = uv.getY(i);
  uv.setXY(i, v, 1 - u);
  const cameraUv = billboard.getAttribute('uv');
  cameraUv.setY(i, 1 - cameraUv.getY(i));
}
export function createGarenQCastMaterial(
  index: number,
  base: THREE.Texture,
  lookup: THREE.Texture
) {
  const p = castProfiles[index],
    material = createParticleColorProductMaterial(base, lookup);
  material.uniforms.sourceUvScale = { value: new THREE.Vector2(1, 1) };
  material.vertexShader = material.vertexShader
    .replace(
      'uniform vec2 sourceUvOffset;',
      'uniform vec2 sourceUvOffset;\nuniform vec2 sourceUvScale;'
    )
    .replace('sourceUv = uv + sourceUvOffset;', 'sourceUv = uv * sourceUvScale + sourceUvOffset;');
  Object.assign(material, {
    name: `Decisive Strike ${p.role} ${p.index}`,
    transparent: true,
    depthWrite: false,
    depthTest: (p.miscRenderFlags & 1) === 0,
    forceSinglePass: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendEquationAlpha: THREE.AddEquation,
    blendSrc:
      p.blend === 2 ? THREE.ZeroFactor : p.blend === 0 ? THREE.OneFactor : THREE.SrcAlphaFactor,
    blendDst: p.blend === 2 ? THREE.OneMinusSrcColorFactor : THREE.OneFactor,
    blendSrcAlpha:
      p.blend === 2 ? THREE.ZeroFactor : p.blend === 0 ? THREE.OneFactor : THREE.SrcAlphaFactor,
    blendDstAlpha: p.blend === 2 ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
  });
  return material;
}
export class GarenDecisiveStrike {
  readonly models = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  private bones = new WeakMap<UnitModel, THREE.Object3D | null>();
  private anchor = new THREE.Vector3();
  private heading = new THREE.Quaternion();
  private offset = new THREE.Vector3();
  private castRotation = new THREE.Quaternion();
  private identity = new THREE.Quaternion();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private rotation = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      ...(profile.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
      'YXZ'
    )
  );
  constructor(private scene: THREE.Scene) {}
  update(
    world: World,
    alpha: number,
    camera: THREE.Camera,
    unitModels: ReadonlyMap<number, UnitModel>,
    terminalAge = 0
  ) {
    const active = new Set<string>();
    if (ready)
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
        if (bone) bone.getWorldPosition(this.anchor);
        const tick = world.tick - 1 + alpha + terminalAge * 60;
        for (const p of bone
          ? garenQTrailParticles(world.championState(unit.id)!.garenQVisuals, tick)
          : []) {
          const key = `${unit.id}:${p.startTick}:${p.ordinal}`;
          active.add(key);
          let mesh = this.models.get(key);
          if (!mesh) {
            mesh = new THREE.Mesh(
              geometries.get(profile.mesh)!,
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
        model.root.getWorldPosition(this.anchor);
        this.heading.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, unit.facing);
        for (const particle of garenQCastParticles(
          unit.id,
          world.championState(unit.id)!.garenQVisuals,
          tick
        )) {
          const p = castProfiles[particle.profileIndex];
          const key = `${unit.id}:cast:${particle.castTick}:${particle.profileIndex}:${particle.ordinal}`;
          active.add(key);
          let mesh = this.models.get(key);
          if (!mesh) {
            mesh = new THREE.Mesh(
              p.mesh ? geometries.get(p.mesh)! : p.kind === 'quad' ? quad : billboard,
              createGarenQCastMaterial(
                particle.profileIndex,
                textures.get(p.texture)!,
                p.lookup ? textures.get(p.lookup)! : white
              )
            );
            mesh.name = `Garen Q ${p.role} ${p.index} ${p.name}`;
            Object.assign(mesh.userData, {
              sourceId: unit.id,
              castTick: particle.castTick,
              profileIndex: particle.profileIndex,
              attachment: 'local-caster-root',
            });
            mesh.renderOrder = p.renderOrder;
            mesh.frustumCulled = false;
            this.models.set(key, mesh);
            this.scene.add(mesh);
          }
          this.offset.fromArray(particle.offset).multiplyScalar(0.01).applyQuaternion(this.heading);
          mesh.position.copy(this.anchor).add(this.offset);
          if (p.kind === 'billboard' && !p.particleLocal) {
            mesh.quaternion.copy(camera.quaternion);
            mesh.rotateZ(-THREE.MathUtils.degToRad(particle.rotation[0]));
          } else {
            this.castRotation.setFromEuler(
              this.euler.set(
                ...(particle.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
                'YXZ'
              )
            );
            mesh.quaternion
              .copy(p.local ? this.heading : this.identity)
              .multiply(this.castRotation);
          }
          mesh.scale.fromArray(particle.scale).multiplyScalar(p.kind === 'mesh' ? 1 : 0.01);
          const tint = [...particle.color];
          if (p.blend === 0 || p.blend === 2) {
            for (let i = 0; i < 3; i++) tint[i] *= tint[3];
            tint[3] = 1;
          }
          const uniforms = mesh.material.uniforms;
          uniforms.particleColor.value.fromArray(tint);
          uniforms.lookupUv.value.fromArray(particle.lookup);
          const [columns, rows] = p.atlas.grid;
          uniforms.sourceUvScale.value.set(1 / columns, 1 / rows);
          uniforms.sourceUvOffset.value.set(
            particle.scroll[0] + (particle.frame % columns) / columns,
            particle.scroll[1] + Math.floor(particle.frame / columns) / rows
          );
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
