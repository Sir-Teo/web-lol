import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import source from '../content/gromp-death.json';
import { TICK_RATE } from '../content/rules';
import type { World } from '../simulation/world';
import type { UnitModel } from './models';
import { grompDeathParticles } from './gromp-death-particles';
import { createParticleColorProductMaterial } from './particle-color-product';
import { writeRayQuad } from './ray-quad';
import { writeRayColor } from './particle-ray-color';
import { isGrompLegacyBillboard, writeGrompBillboardColor } from './gromp-billboard-color';
import { particleHalf } from './particle-half';

const textures = new Map<string, THREE.Texture>(),
  geometries = new Map<string, THREE.BufferGeometry>(),
  white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1),
  billboard = new THREE.PlaneGeometry(2, 2).toNonIndexed(),
  quad = new THREE.PlaneGeometry(2, 2).toNonIndexed();
white.needsUpdate = true;
for (let i = 0; i < 6; i++) {
  const uv = quad.getAttribute('uv'),
    u = uv.getX(i),
    v = uv.getY(i);
  uv.setXY(i, v, 1 - u);
  const cameraUv = billboard.getAttribute('uv');
  cameraUv.setY(i, 1 - cameraUv.getY(i));
}
let ready = false,
  pending: Promise<void> | undefined;

/** On-presence assets share one transaction; completed partial loads are
 * disposed on failure. The source paper has no inspection texture/material. */
export function loadGrompDeath(): Promise<void> {
  if (ready) return Promise.resolve();
  if (pending) return pending;
  pending = (async () => {
    const images = new Map<string, THREE.Texture>(),
      meshes = new Map<string, THREE.BufferGeometry>(),
      paths = new Set(source.profiles.flatMap((p) => [p.texture, ...(p.lookup ? [p.lookup] : [])]));
    const results = await Promise.allSettled([
      ...[...new Set(source.profiles.flatMap((p) => (p.mesh ? [p.mesh] : [])))].map(
        async (path) => {
          const gltf = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + path);
          gltf.scene.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            meshes.set(path, o.geometry);
            for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
          });
          if (!meshes.has(path)) throw new Error(`Missing Gromp source mesh: ${path}`);
        }
      ),
      ...[...paths].map(async (path) => {
        const texture = await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL + path);
        texture.colorSpace = THREE.NoColorSpace;
        texture.flipY = false;
        texture.generateMipmaps = false;
        texture.minFilter = texture.magFilter = THREE.LinearFilter;
        texture.wrapS = texture.wrapT = source.profiles.some(
          (p) => p.texture === path && p.scroll.some((v) => v !== 0)
        )
          ? THREE.RepeatWrapping
          : THREE.ClampToEdgeWrapping;
        images.set(path, texture);
      }),
    ]);
    const failed = results.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') {
      images.forEach((t) => t.dispose());
      meshes.forEach((g) => g.dispose());
      throw failed.reason;
    }
    images.forEach((t, path) => textures.set(path, t));
    meshes.forEach((g, path) => geometries.set(path, g));
    ready = true;
  })().catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}

/** Initial RGBA product and legacy render mode reading; final native Gromp
 * composition/sampler/extent remain unverified. Batches carry per-vertex tint
 * and lookup coordinates, keeping at most one draw per emitter/corpse. */
export function createGrompDeathMaterial(
  index: number,
  base: THREE.Texture,
  lookup: THREE.Texture,
  batched = false
) {
  const p = source.profiles[index],
    material = createParticleColorProductMaterial(
      base,
      lookup,
      batched ? 'vertex' : 'uniform',
      undefined,
      batched && (p.kind === 'ray' || isGrompLegacyBillboard(index)) ? 'bgra-unorm8' : batched
    );
  if (p.alphaRef)
    material.fragmentShader = material.fragmentShader.replace(
      /}\s*$/,
      `if(gl_FragColor.a < ${p.alphaRef}.0/255.0) discard;\n}`
    );
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

function baseGeometry(index: number) {
  const p = source.profiles[index];
  return p.mesh ? geometries.get(p.mesh)! : p.kind === 'quad' ? quad : billboard;
}
function batchGeometry(index: number) {
  const p = source.profiles[index],
    packed = p.kind === 'ray' || isGrompLegacyBillboard(index),
    count = p.count * (p.kind === 'ray' ? 6 : baseGeometry(index).getAttribute('position').count),
    geometry = new THREE.BufferGeometry();
  for (const [name, size] of [
    ['position', 3],
    ['uv', 2],
    ['particleLookupUv', 2],
  ] as const)
    geometry.setAttribute(
      name,
      new THREE.BufferAttribute(new Float32Array(count * size), size).setUsage(
        THREE.DynamicDrawUsage
      )
    );
  geometry.setAttribute(
    packed ? '_source_vertex_bgra' : 'particleTint',
    new THREE.BufferAttribute(
      packed ? new Uint8Array(count * 4) : new Float32Array(count * 4),
      4,
      packed
    ).setUsage(THREE.DynamicDrawUsage)
  );
  return geometry;
}

export class GrompDeath {
  readonly models = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  private attachments = new WeakMap<UnitModel, THREE.Object3D | null>();
  private anchor = new THREE.Vector3();
  private point = new THREE.Vector3();
  private offset = new THREE.Vector3();
  private scale = new THREE.Vector3();
  private eye = new THREE.Vector3();
  private axis = new THREE.Vector3();
  private across = new THREE.Vector3();
  private frame = new THREE.Quaternion();
  private rotation = new THREE.Quaternion();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private transform = new THREE.Matrix4();
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
        const particles = grompDeathParticles(unit.deadAt, tick, unit.id);
        if (!particles.length) continue;
        const model = unitModels.get(unit.id);
        if (!model?.root.visible) continue;
        if (!this.attachments.has(model))
          this.attachments.set(model, model.root.getObjectByName(source.bone) ?? null);
        const bone = this.attachments.get(model);
        if (!bone) continue;
        bone.updateWorldMatrix(true, false);
        bone.getWorldPosition(this.anchor);
        this.frame.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, unit.facing);
        for (let profileIndex = 0; profileIndex < source.profiles.length; profileIndex++) {
          const p = source.profiles[profileIndex],
            packed = p.kind === 'ray' || isGrompLegacyBillboard(profileIndex),
            selected = particles.filter((v) => v.profileIndex === profileIndex);
          if (!selected.length) continue;
          const key = `${unit.id}:${unit.deadAt}:${profileIndex}`;
          active.add(key);
          let mesh = this.models.get(key);
          if (!mesh) {
            mesh = new THREE.Mesh(
              batchGeometry(profileIndex),
              createGrompDeathMaterial(
                profileIndex,
                textures.get(p.texture)!,
                p.lookup ? textures.get(p.lookup)! : white,
                true
              )
            );
            mesh.name = `Gromp death ${p.name}`;
            Object.assign(mesh.userData, {
              sourceId: unit.id,
              deathTick: unit.deadAt,
              attachment: source.bone,
            });
            mesh.renderOrder = p.priority;
            mesh.frustumCulled = false;
            this.models.set(key, mesh);
            this.scene.add(mesh);
          }
          mesh.position.copy(this.anchor);
          mesh.userData.particleCount = selected.length;
          mesh.userData.ordinals = selected.map((v) => v.ordinal);
          const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute,
            uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute,
            tint = mesh.geometry.getAttribute(
              packed ? '_source_vertex_bgra' : 'particleTint'
            ) as THREE.BufferAttribute,
            lookup = mesh.geometry.getAttribute('particleLookupUv') as THREE.BufferAttribute,
            base = baseGeometry(profileIndex),
            basePosition = base.getAttribute('position'),
            baseUv = base.getAttribute('uv'),
            vertices = p.kind === 'ray' ? 6 : basePosition.count;
          for (const [index, particle] of selected.entries()) {
            const first = index * vertices;
            this.offset.fromArray(particle.offset).multiplyScalar(0.01);
            if (p.local) this.offset.applyQuaternion(this.frame);
            if (p.kind === 'billboard') {
              this.rotation.setFromEuler(
                this.euler.set(
                  THREE.MathUtils.degToRad(particle.rotation[2]),
                  THREE.MathUtils.degToRad(particle.rotation[1]),
                  -THREE.MathUtils.degToRad(particle.rotation[0]),
                  'YXZ'
                )
              );
              this.rotation.premultiply(camera.quaternion);
            } else {
              this.rotation.setFromEuler(
                this.euler.set(
                  ...(particle.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
                  'YXZ'
                )
              );
              if (p.local) this.rotation.premultiply(this.frame);
            }
            if (p.kind === 'ray') {
              this.axis.set(0, 0, 1).applyQuaternion(this.rotation);
              this.across.set(1, 0, 0).applyQuaternion(this.rotation);
              camera.getWorldPosition(this.eye).sub(this.anchor);
              writeRayQuad(
                position,
                uv,
                first,
                {
                  center: this.offset,
                  axis: this.axis,
                  fallbackAcross: this.across,
                  size: particle.scale.map((v) => v * 0.01) as [number, number, number],
                },
                this.eye
              );
            } else {
              this.scale.fromArray(particle.scale).multiplyScalar(p.kind === 'mesh' ? 1 : 0.01);
              this.transform.compose(this.offset, this.rotation, this.scale);
              for (let v = 0; v < vertices; v++) {
                this.point.fromBufferAttribute(basePosition, v).applyMatrix4(this.transform);
                position.setXYZ(first + v, this.point.x, this.point.y, this.point.z);
                uv.setXY(first + v, baseUv.getX(v), baseUv.getY(v));
              }
            }
            const color = packed ? particle.color : [...particle.color],
              lookupPhase = p.kind === 'ray' ? particleHalf(particle.phase) : particle.phase,
              [columns, rows] = p.atlas.grid;
            if (p.kind === 'ray')
              writeRayColor(tint.array as Uint8Array, first, vertices, particle.color, p.blend);
            else if (isGrompLegacyBillboard(profileIndex))
              writeGrompBillboardColor(tint.array as Uint8Array, first, vertices, particle.color);
            else if (p.blend === 0) {
              for (let i = 0; i < 3; i++) color[i] *= color[3];
              color[3] = 1;
            }
            for (let v = first; v < first + vertices; v++) {
              uv.setXY(
                v,
                (uv.getX(v) + (particle.frame % columns)) / columns + particle.scroll[0],
                (uv.getY(v) + Math.floor(particle.frame / columns)) / rows + particle.scroll[1]
              );
              if (!packed) tint.setXYZW(v, color[0], color[1], color[2], color[3]);
              lookup.setXY(v, lookupPhase, 0.5);
            }
          }
          mesh.geometry.setDrawRange(0, selected.length * vertices);
          position.needsUpdate = uv.needsUpdate = tint.needsUpdate = lookup.needsUpdate = true;
        }
      }
    for (const [key, mesh] of this.models)
      if (!active.has(key)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.models.delete(key);
      }
  }
}
