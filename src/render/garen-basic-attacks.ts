import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import data from '../content/garen-aa-particles.json';
import type { ImpactRig } from '../content/impact-target';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { createTargetPoseSampler } from './models';
import { ImpactAttachments, type AttachmentHistory } from './impact-attachments';
import { garenAAParticles } from './garen-aa-particles';
import { createParticleColorProductMaterial } from './particle-color-product';
import { writeRayQuad } from './ray-quad';
import { writeRayColor } from './particle-ray-color';

const profiles = data.profiles;
const textures = new Map<string, THREE.Texture>(),
  geometries = new Map<string, THREE.BufferGeometry>();
let ready = false,
  pending: Promise<void> | undefined;
/** Load only linked, supported effects. Deferred definitions stay in the ledger. */
export function loadGarenBasicAttacks(): Promise<void> {
  if (ready) return Promise.resolve();
  return (pending ??= (async () => {
    const selected = profiles.filter((p) => p.deferred === null),
      images = [...new Set(selected.flatMap((p) => [p.texture, ...(p.lookup ? [p.lookup] : [])]))],
      meshes = [...new Set(selected.flatMap((p) => (p.mesh ? [p.mesh] : [])))];
    const loadedImages = new Map<string, THREE.Texture>(),
      loadedMeshes = new Map<string, THREE.BufferGeometry>();
    const outcomes = await Promise.allSettled([
      ...images.map(async (path) => {
        const t = await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL + path);
        t.colorSpace = THREE.NoColorSpace;
        t.flipY = false;
        t.generateMipmaps = false;
        t.minFilter = t.magFilter = THREE.LinearFilter;
        t.wrapS = t.wrapT = selected.some((p) => p.lookup === path)
          ? THREE.ClampToEdgeWrapping
          : THREE.RepeatWrapping;
        loadedImages.set(path, t);
      }),
      ...meshes.map(async (path) => {
        const gltf = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + path);
        gltf.scene.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          loadedMeshes.set(path, o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
        });
        if (!loadedMeshes.has(path)) throw new Error(`Missing Garen AA mesh: ${path}`);
      }),
    ]);
    const failed = outcomes.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') {
      loadedImages.forEach((t) => t.dispose());
      loadedMeshes.forEach((g) => g.dispose());
      throw failed.reason;
    }
    loadedImages.forEach((t, k) => textures.set(k, t));
    loadedMeshes.forEach((g, k) => geometries.set(k, g));
    ready = true;
  })().catch((error) => {
    pending = undefined;
    throw error;
  }));
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
  const b = billboard.getAttribute('uv');
  b.setY(i, 1 - b.getY(i));
}
export function createGarenAAMaterial(index: number, base: THREE.Texture, lookup: THREE.Texture) {
  const p = profiles[index],
    m = createParticleColorProductMaterial(
      base,
      lookup,
      'uniform',
      undefined,
      p.kind === 'ray' ? 'bgra-unorm8' : false
    );
  m.uniforms.sourceUvScale = { value: new THREE.Vector2(1, 1) };
  m.vertexShader = m.vertexShader
    .replace(
      'uniform vec2 sourceUvOffset;',
      'uniform vec2 sourceUvOffset;\nuniform vec2 sourceUvScale;'
    )
    .replace('sourceUv = uv + sourceUvOffset;', 'sourceUv = uv * sourceUvScale + sourceUvOffset;');
  Object.assign(m, {
    name: `Garen ${p.system} ${p.name}`,
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
  return m;
}
type Mesh = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
type Attachment = { rig: string | null; attachments: ImpactAttachments };
/** Authored bone positions from independent saved skeletons. Orientation type 2
 * remains unobserved: captured attacker heading is an explicit local adapter. */
export class GarenBasicAttacks {
  readonly models = new Map<string, Mesh>();
  readonly attachments = new Map<string, Attachment>();
  private heading = new THREE.Quaternion();
  private rotation = new THREE.Quaternion();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0) {
    const active = new Set<string>(),
      attached = new Set<string>();
    const tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0);
    if (ready)
      for (const u of world.units) {
        if (u.champion !== 'garen') continue;
        const records = world.championState(u.id)?.garenAAVisuals;
        if (!records?.length) continue;
        for (const particle of garenAAParticles(u.id, records, tick, 'blue')) {
          const p = profiles[particle.profileIndex],
            r = particle.record,
            hit = p.phase === 'hit';
          if (
            hit
              ? !r.impact!.audience.includes('blue')
              : !r.castAudience.includes('blue') || !world.visible(u)
          )
            continue;
          const rig = hit ? r.targetRig : 'garen-base',
            baseKey = `${u.id}:${r.startTick}:${hit ? 'hit' : 'swing'}:${particle.bone}`;
          let entry = this.attachments.get(baseKey);
          if (entry && entry.rig !== rig) {
            entry.attachments.dispose();
            this.attachments.delete(baseKey);
            entry = undefined;
          }
          if (!entry) {
            entry = {
              rig,
              attachments: new ImpactAttachments(
                rig ? createTargetPoseSampler(rig as ImpactRig | 'sightward-base') : null,
                this.ground,
                () => particle.bone
              ),
            };
            this.attachments.set(baseKey, entry);
          }
          attached.add(baseKey);
          const history: AttachmentHistory = {
            targetRig: rig,
            critical: r.kind === 'crit',
            targetTransform: hit ? r.impact!.targetTransform : null,
            frames: hit ? r.impact!.frames : r.frames,
          };
          const position = entry.attachments
            .point(history, particle.bornTick)
            .lerp(entry.attachments.point(history, tick), p.bindWeight);
          const frames = history.frames,
            at = hit
              ? r.impact!.facing
              : frames[Math.min(frames.length - 1, Math.max(0, Math.floor(tick) - frames[0].tick))]
                  .facing;
          this.heading.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, at);
          const offset = new THREE.Vector3(...particle.offset)
            .multiplyScalar(0.01)
            .applyQuaternion(this.heading);
          position.add(offset);
          // A known contact never licenses following a hidden target with VFX.
          if (hit && !world.pointVisible({ x: position.x * 100, y: position.z * 100 })) continue;
          const key = `${baseKey}:${particle.profileIndex}:${particle.ordinal}`;
          active.add(key);
          let mesh = this.models.get(key);
          if (!mesh) {
            const geometry =
              p.kind === 'ray'
                ? new THREE.BufferGeometry()
                    .setAttribute(
                      'position',
                      new THREE.BufferAttribute(new Float32Array(18), 3).setUsage(
                        THREE.DynamicDrawUsage
                      )
                    )
                    .setAttribute('uv', new THREE.BufferAttribute(new Float32Array(12), 2))
                : p.mesh
                  ? geometries.get(p.mesh)!
                  : p.kind === 'quad'
                    ? quad
                    : billboard;
            if (p.kind === 'ray')
              geometry.setAttribute(
                '_source_vertex_bgra',
                new THREE.Uint8BufferAttribute(new Uint8Array(24), 4, true).setUsage(
                  THREE.DynamicDrawUsage
                )
              );
            mesh = new THREE.Mesh(
              geometry,
              createGarenAAMaterial(
                particle.profileIndex,
                textures.get(p.texture)!,
                p.lookup ? textures.get(p.lookup)! : white
              )
            );
            mesh.name = `Garen AA ${p.system} ${p.index} ${p.name}`;
            mesh.frustumCulled = false;
            mesh.renderOrder = p.renderOrder;
            Object.assign(mesh.userData, {
              sourceId: u.id,
              startTick: r.startTick,
              phase: p.phase,
              profileIndex: particle.profileIndex,
              ordinal: particle.ordinal,
              bornTick: particle.bornTick,
              bone: particle.bone,
              ownedGeometry: p.kind === 'ray',
            });
            this.models.set(key, mesh);
            this.scene.add(mesh);
          }
          this.rotation.setFromEuler(
            this.euler.set(
              ...(particle.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
              'YXZ'
            )
          );
          mesh.visible = true;
          mesh.position.copy(position);
          if (p.kind === 'ray') {
            const orientation = this.heading.clone().multiply(this.rotation),
              origin = position.clone();
            writeRayQuad(
              mesh.geometry.getAttribute('position') as THREE.BufferAttribute,
              mesh.geometry.getAttribute('uv') as THREE.BufferAttribute,
              0,
              {
                center: origin,
                axis: new THREE.Vector3(0, 1, 0).applyQuaternion(orientation),
                fallbackAcross: new THREE.Vector3(1, 0, 0).applyQuaternion(orientation),
                size: particle.scale.map((v) => v * 0.01) as [number, number, number],
              },
              camera.getWorldPosition(new THREE.Vector3())
            );
            mesh.geometry.getAttribute('position').needsUpdate = true;
            mesh.geometry.getAttribute('uv').needsUpdate = true;
            mesh.position.set(0, 0, 0);
            mesh.quaternion.identity();
            mesh.scale.set(1, 1, 1);
          } else {
            if (p.kind === 'billboard' && !p.particleLocal) {
              mesh.quaternion.copy(camera.quaternion);
              if (p.direction && Math.hypot(...particle.travel) > 0) {
                const d = new THREE.Vector3(...particle.travel)
                  .applyQuaternion(this.heading)
                  .applyQuaternion(camera.quaternion.clone().invert());
                mesh.rotateZ(Math.atan2(-d.x, d.y));
              } else mesh.rotateZ(-THREE.MathUtils.degToRad(particle.rotation[0]));
            } else
              mesh.quaternion
                .copy(p.local ? this.heading : new THREE.Quaternion())
                .multiply(this.rotation);
            mesh.scale.fromArray(particle.scale).multiplyScalar(p.kind === 'mesh' ? 1 : 0.01);
          }
          const uniforms = mesh.material.uniforms,
            [columns, rows] = p.atlas.grid;
          if (p.kind === 'ray') {
            const attribute = mesh.geometry.getAttribute(
              '_source_vertex_bgra'
            ) as THREE.BufferAttribute;
            writeRayColor(
              attribute.array as Uint8Array,
              0,
              attribute.count,
              particle.color,
              p.blend
            );
            attribute.needsUpdate = true;
            uniforms.particleColor.value.set(1, 1, 1, 1);
          } else {
            const tint = [...particle.color];
            if (p.blend === 0) {
              for (let i = 0; i < 3; i++) tint[i] *= tint[3];
              tint[3] = 1;
            }
            uniforms.particleColor.value.fromArray(tint);
          }
          uniforms.lookupUv.value.fromArray(particle.lookup);
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
        if (mesh.userData.ownedGeometry) mesh.geometry.dispose();
        mesh.material.dispose();
        this.models.delete(key);
      }
    for (const [key, entry] of this.attachments)
      if (!attached.has(key)) {
        entry.attachments.dispose();
        this.attachments.delete(key);
      }
  }
}
