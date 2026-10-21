import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import profiles from '../content/garen-w-particles.json';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { garenCourageParticles } from './garen-courage-particles';
import { createParticleColorProductMaterial } from './particle-color-product';
import { GAREN_W_CAST_PARTICLE_BONE } from '../content/garen-w-presentation';
import type { UnitModel } from './models';

const sourceMeshes = new Map<string, THREE.BufferGeometry>();
const textures = new Map<string, THREE.Texture>();
const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
white.needsUpdate = true;
let ready = false,
  pending: Promise<void> | undefined;
/** On-presence startup and lazy late-NPC loading share one request set. Failed
 * partial loads are disposed and may be retried without affecting simulation. */
export function loadGarenCourage(): Promise<void> {
  if (ready) return Promise.resolve();
  if (pending) return pending;
  pending = (async () => {
    const geometries = new Map<string, THREE.BufferGeometry>(),
      images = new Map<string, THREE.Texture>();
    const selected = profiles;
    const paths = new Set(selected.flatMap((p) => [p.texture, ...(p.lookup ? [p.lookup] : [])]));
    const results = await Promise.allSettled([
      ...[...new Set(selected.flatMap((p) => (p.mesh ? [p.mesh] : [])))].map(async (path) => {
        const gltf = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + path);
        gltf.scene.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          geometries.set(path, o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
        });
        if (!geometries.has(path)) throw new Error(`Missing W source mesh: ${path}`);
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
/** Shared initial RGBA product. Native UV_MODE, color remapping and framebuffer
 * composition remain open. Source passes, depth flags and blend factors retained. */
export function createGarenCourageMaterial(
  profileIndex: number,
  base: THREE.Texture,
  lookup: THREE.Texture
) {
  const p = profiles[profileIndex],
    material = createParticleColorProductMaterial(base, lookup);
  if (p.alphaRef)
    material.fragmentShader = material.fragmentShader.replace(
      /}\s*$/,
      `if(gl_FragColor.a < ${p.alphaRef}.0/255.0) discard;\n}`
    );
  Object.assign(material, {
    name: `Courage ${p.role} ${p.index} ${p.name}`,
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

export class GarenCourage {
  readonly models = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  private anchor = new THREE.Vector3();
  private attachments = new WeakMap<UnitModel, THREE.Object3D | undefined>();
  private offset = new THREE.Vector3();
  private frame = new THREE.Quaternion();
  private rotation = new THREE.Quaternion();
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
        const effect = world.championState(unit.id)?.garenWVisual;
        if (!effect) continue;
        const tick = world.tick - 1 + alpha + terminalAge * 60;
        if (unit.team !== 'blue' && !world.visible(unit)) continue;
        const point = {
          x: unit.previous.x + (unit.x - unit.previous.x) * alpha,
          y: unit.previous.y + (unit.y - unit.previous.y) * alpha,
        };
        this.frame.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, unit.facing);
        for (const particle of garenCourageParticles(unit.id, effect, tick)) {
          const p = profiles[particle.profileIndex];
          let attachment = 'local-caster-ground';
          if (p.role === 'cast') {
            const model = unitModels.get(unit.id);
            if (!model?.root.visible) continue;
            if (!this.attachments.has(model)) {
              let found: THREE.Object3D | undefined;
              model.root.traverse((o) => {
                if (o.name.toLowerCase() === GAREN_W_CAST_PARTICLE_BONE.toLowerCase()) found = o;
              });
              this.attachments.set(model, found);
            }
            const bone = this.attachments.get(model);
            if (bone) bone.getWorldPosition(this.anchor);
            else model.root.getWorldPosition(this.anchor);
            attachment = bone?.name ?? 'local-root-fallback';
          } else this.anchor.set(point.x * 0.01, this.ground(point), point.y * 0.01);
          const key = `${unit.id}:${effect.startTick}:${particle.profileIndex}:${particle.ordinal}`;
          active.add(key);
          let mesh = this.models.get(key);
          if (!mesh) {
            mesh = new THREE.Mesh(
              p.mesh ? sourceMeshes.get(p.mesh)! : p.kind === 'quad' ? quad : billboard,
              createGarenCourageMaterial(
                particle.profileIndex,
                textures.get(p.texture)!,
                p.lookup ? textures.get(p.lookup)! : white
              )
            );
            mesh.name = `Garen W ${p.role} ${p.index} ${p.name}`;
            mesh.userData.sourceId = unit.id;
            mesh.userData.startTick = effect.startTick;
            mesh.userData.attachment = attachment;
            mesh.renderOrder = p.renderOrder;
            mesh.frustumCulled = false;
            this.models.set(key, mesh);
            this.scene.add(mesh);
          }
          this.offset.fromArray(particle.offset).multiplyScalar(0.01).applyQuaternion(this.frame);
          mesh.position.copy(this.anchor).add(this.offset);
          if (p.kind === 'billboard') {
            mesh.quaternion.copy(camera.quaternion);
            mesh.rotateZ(-THREE.MathUtils.degToRad(particle.rotation[0]));
          } else {
            this.rotation.setFromEuler(
              this.euler.set(
                ...(particle.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
                'YXZ'
              )
            );
            mesh.quaternion.copy(this.frame);
            if (!p.local) mesh.quaternion.identity();
            mesh.quaternion.multiply(this.rotation);
          }
          mesh.scale.fromArray(particle.scale).multiplyScalar(p.kind === 'mesh' ? 1 : 0.01);
          const uniforms = mesh.material.uniforms;
          const color = [...particle.color];
          if (p.blend === 0) {
            for (let i = 0; i < 3; i++) color[i] *= color[3];
            color[3] = 1;
          }
          uniforms.particleColor.value.fromArray(color);
          uniforms.lookupUv.value.fromArray(particle.lookup);
          uniforms.sourceUvOffset.value.fromArray(particle.scroll);
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
