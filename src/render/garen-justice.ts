import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import profiles from '../content/garen-r-particles.json';
import { GAREN_R_CAST_PARTICLE_BONE } from '../content/garen-r-presentation';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import type { UnitModel } from './models';
import { garenJusticeParticles } from './garen-justice-particles';
import { createParticleColorProductMaterial } from './particle-color-product';
import { writeRayQuad } from './ray-quad';
import { writeRayColor } from './particle-ray-color';

const sourceMeshes = new Map<string, THREE.BufferGeometry>();
const textures = new Map<string, THREE.Texture>();
const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
white.needsUpdate = true;
let ready = false,
  pending: Promise<void> | undefined;
/** On-presence startup and lazy late-NPC loading share one request set. Failed
 * partial loads are disposed and may be retried without affecting simulation. */
export function loadGarenJustice(): Promise<void> {
  if (ready) return Promise.resolve();
  if (pending) return pending;
  pending = (async () => {
    const geometries = new Map<string, THREE.BufferGeometry>(),
      images = new Map<string, THREE.Texture>();
    const selected = profiles.filter((p) => !p.deferred);
    const paths = new Set(
      selected.flatMap((p) => [
        p.texture,
        ...(p.lookup ? [p.lookup] : []),
        ...(p.multiplier ? [p.multiplier] : []),
      ])
    );
    const results = await Promise.allSettled([
      ...[...new Set(selected.flatMap((p) => (p.mesh ? [p.mesh] : [])))].map(async (path) => {
        const gltf = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + path);
        gltf.scene.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          geometries.set(path, o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
        });
        if (!geometries.has(path)) throw new Error(`Missing R source mesh: ${path}`);
      }),
      ...[...paths].map(async (path) => {
        const texture = await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL + path);
        texture.colorSpace = THREE.NoColorSpace;
        texture.flipY = false;
        texture.generateMipmaps = false;
        texture.minFilter = texture.magFilter = THREE.LinearFilter;
        texture.wrapS = texture.wrapT = selected.some((p) => p.lookup === path)
          ? THREE.ClampToEdgeWrapping
          : THREE.RepeatWrapping;
        images.set(path, texture);
      }),
    ]);
    const failed = results.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') {
      geometries.forEach((g) => g.dispose());
      images.forEach((t) => t.dispose());
      throw failed.reason;
    }
    geometries.forEach((g, p) => sourceMeshes.set(p, g));
    images.forEach((t, p) => textures.set(p, t));
    ready = true;
  })().catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
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
/** Initial RGBA product plus independent source atlas/scroll and mesh multiplier
 * UVs. UV_MODE lock-alpha/native remapping and distortion require comparison. */
export function createGarenJusticeMaterial(
  profileIndex: number,
  base: THREE.Texture,
  lookup: THREE.Texture,
  multiplier?: THREE.Texture
) {
  const p = profiles[profileIndex];
  const material = createParticleColorProductMaterial(
    base,
    lookup,
    'uniform',
    multiplier,
    p.kind === 'ray' ? 'bgra-unorm8' : false
  );
  material.uniforms.sourceUvScale = { value: new THREE.Vector2(1, 1) };
  material.uniforms.multiplierUvOffset = { value: new THREE.Vector2() };
  material.vertexShader = material.vertexShader
    .replace(
      'varying vec2 sourceUv;',
      'varying vec2 sourceUv;\nvarying vec2 rawUv;\nuniform vec2 sourceUvScale;'
    )
    .replace(
      'sourceUv = uv + sourceUvOffset;',
      'rawUv = uv;\nsourceUv = uv * sourceUvScale + sourceUvOffset;'
    );
  material.fragmentShader = material.fragmentShader
    .replace(
      'varying vec2 sourceUv;',
      'varying vec2 sourceUv;\nvarying vec2 rawUv;\nuniform vec2 multiplierUvOffset;'
    )
    .replace(
      'texture2D(multiplierTexture, colorUv)',
      'texture2D(multiplierTexture, rawUv + multiplierUvOffset)'
    );
  if (p.alphaRef)
    material.fragmentShader = material.fragmentShader.replace(
      /}\s*$/,
      `if(gl_FragColor.a < ${p.alphaRef}.0/255.0) discard;\n}`
    );
  Object.assign(material, {
    name: `Demacian Justice ${p.role} ${p.index} ${p.name}`,
    transparent: true,
    depthWrite: false,
    depthTest: (p.miscRenderFlags & 1) === 0,
    forceSinglePass: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: p.blend === 0 ? THREE.OneFactor : THREE.SrcAlphaFactor,
    blendDst: p.blend === 1 ? THREE.OneMinusSrcAlphaFactor : THREE.OneFactor,
  });
  return material;
}

export class GarenJustice {
  readonly models = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  private attachments = new WeakMap<UnitModel, THREE.Object3D | undefined>();
  private anchor = new THREE.Vector3();
  private offset = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private sourceUp = new THREE.Vector3();
  private rotation = new THREE.Quaternion();
  private frame = new THREE.Quaternion();
  private aim = new THREE.Quaternion();
  private rayAxis = new THREE.Vector3();
  private rayAcross = new THREE.Vector3();
  private rayEye = new THREE.Vector3();
  private rayOrigin = new THREE.Vector3();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
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
    const active = new Set<string>();
    if (ready)
      for (const unit of world.units) {
        const effect = world.championState(unit.id)?.garenRVisual;
        if (!effect) continue;
        const tick = world.tick - 1 + alpha + terminalAge * 60;
        const target = world.unit(effect.targetId);
        for (const particle of garenJusticeParticles(unit.id, effect, tick)) {
          const p = profiles[particle.profileIndex];
          if (p.role === 'cast') {
            if (unit.team !== 'blue' && !world.visible(unit)) continue;
            const model = unitModels.get(unit.id);
            if (!model?.root.visible) continue;
            if (!this.attachments.has(model)) {
              let found: THREE.Object3D | undefined;
              model.root.traverse((o) => {
                if (o.name.toLowerCase() === GAREN_R_CAST_PARTICLE_BONE.toLowerCase()) found = o;
              });
              this.attachments.set(model, found);
            }
            const attachment = this.attachments.get(model);
            if (attachment) attachment.getWorldPosition(this.anchor);
            else model.root.getWorldPosition(this.anchor);
            this.frame.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, effect.facing);
          } else {
            const point =
              effect.releaseTick === null && target
                ? {
                    x: target.previous.x + (target.x - target.previous.x) * alpha,
                    y: target.previous.y + (target.y - target.previous.y) * alpha,
                  }
                : effect.point;
            if (
              unit.team !== 'blue' &&
              !world.pointVisible(point) &&
              !(target && effect.releaseTick === null && world.visible(target))
            )
              continue;
            this.anchor.set(point.x * 0.01, this.ground(point), point.y * 0.01);
            this.frame.identity();
          }
          const key = `${unit.id}:${effect.startTick}:${particle.profileIndex}:${particle.ordinal}`;
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
                  ? sourceMeshes.get(p.mesh)!
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
              createGarenJusticeMaterial(
                particle.profileIndex,
                textures.get(p.texture)!,
                p.lookup ? textures.get(p.lookup)! : white,
                p.multiplier ? textures.get(p.multiplier)! : undefined
              )
            );
            mesh.name = `Garen R ${p.role} ${p.index} ${p.name}`;
            mesh.userData.sourceId = unit.id;
            mesh.userData.startTick = effect.startTick;
            mesh.userData.ownedGeometry = p.kind === 'ray';
            mesh.userData.attachment =
              p.role === 'cast'
                ? (this.attachments.get(unitModels.get(unit.id)!)?.name ?? 'local-root-fallback')
                : 'local-target-ground';
            mesh.renderOrder = p.renderOrder;
            mesh.frustumCulled = false;
            this.models.set(key, mesh);
            this.scene.add(mesh);
          }
          this.offset.fromArray(particle.offset).multiplyScalar(0.01).applyQuaternion(this.frame);
          mesh.position.copy(this.anchor).add(this.offset);
          if (p.kind === 'ray') {
            this.rotation.setFromEuler(
              this.euler.set(
                ...(particle.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
                'YXZ'
              )
            );
            if (p.local) this.rotation.premultiply(this.frame);
            this.rayAxis.set(0, 0, 1).applyQuaternion(this.rotation);
            this.rayAcross.set(1, 0, 0).applyQuaternion(this.rotation);
            camera.getWorldPosition(this.rayEye).sub(mesh.position);
            const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute,
              uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
            writeRayQuad(
              position,
              uv,
              0,
              {
                center: this.rayOrigin,
                axis: this.rayAxis,
                fallbackAcross: this.rayAcross,
                size: particle.scale.map((v) => v * 0.01) as [number, number, number],
              },
              this.rayEye
            );
            position.needsUpdate = uv.needsUpdate = true;
            mesh.quaternion.identity();
            mesh.scale.setScalar(1);
          } else if (p.kind === 'billboard') {
            mesh.quaternion.copy(camera.quaternion);
            if (p.direction) {
              this.direction
                .fromArray(particle.travel)
                .applyQuaternion(this.frame)
                .applyQuaternion(this.aim.copy(camera.quaternion).invert());
              const angle = Math.atan2(-this.direction.x, this.direction.y);
              mesh.rotateZ(angle);
            } else mesh.rotateZ(-THREE.MathUtils.degToRad(particle.rotation[0]));
          } else {
            this.rotation.setFromEuler(
              this.euler.set(
                ...(particle.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
                'YXZ'
              )
            );
            if (p.direction && this.direction.fromArray(particle.travel).lengthSq() > 0) {
              this.sourceUp.set(0, 1, 0).applyQuaternion(this.rotation);
              this.aim.setFromUnitVectors(this.sourceUp, this.direction.normalize());
              this.rotation.premultiply(this.aim);
            }
            mesh.quaternion
              .copy(p.local ? this.frame : this.aim.identity())
              .multiply(this.rotation);
          }
          if (p.kind !== 'ray')
            mesh.scale.fromArray(particle.scale).multiplyScalar(p.kind === 'mesh' ? 1 : 0.01);
          const uniforms = mesh.material.uniforms;
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
            const color = [...particle.color];
            if (p.blend === 0) {
              for (let i = 0; i < 3; i++) color[i] *= color[3];
              color[3] = 1;
            }
            uniforms.particleColor.value.fromArray(color);
          }
          uniforms.lookupUv.value.fromArray(particle.lookup);
          const [columns, rows] = p.atlas.grid;
          uniforms.sourceUvScale.value.set(1 / columns, 1 / rows);
          uniforms.sourceUvOffset.value.set(
            particle.scroll[0] + (particle.frame % columns) / columns,
            particle.scroll[1] + Math.floor(particle.frame / columns) / rows
          );
          uniforms.multiplierUvOffset.value.fromArray(particle.multiplier);
        }
      }
    for (const [key, mesh] of this.models)
      if (!active.has(key)) {
        this.scene.remove(mesh);
        mesh.material.dispose();
        if (mesh.userData.ownedGeometry) mesh.geometry.dispose();
        this.models.delete(key);
      }
  }
}
