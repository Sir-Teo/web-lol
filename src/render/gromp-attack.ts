import * as THREE from 'three';
import source from '../content/gromp-attack.json';
import { GROMP_ATTACK_VISUAL_TAIL_TICKS } from '../content/gromp-attack-presentation';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';
import { grompAttackParticles } from './gromp-attack-particles';
import { createParticleColorProductMaterial } from './particle-color-product';
import { writeGrompAttackColor } from './gromp-attack-color';

const textures = new Map<string, THREE.Texture>(),
  white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1),
  billboard = new THREE.PlaneGeometry(2, 2).toNonIndexed(),
  quad = new THREE.PlaneGeometry(2, 2).toNonIndexed();
white.needsUpdate = true;
for (let i = 0; i < 6; i++) {
  const uv = quad.getAttribute('uv'),
    u = uv.getX(i),
    v = uv.getY(i);
  uv.setXY(i, v, 1 - u);
  const b = billboard.getAttribute('uv');
  b.setY(i, 1 - b.getY(i));
}
let pending: Promise<void> | undefined,
  ready = false;
export function loadGrompAttack(): Promise<void> {
  if (ready) return Promise.resolve();
  return (pending ??= (async () => {
    const loaded = new Map<string, THREE.Texture>();
    const results = await Promise.allSettled(
      [...new Set(source.profiles.map((p) => p.texture))].map(async (path) => {
        const t = await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL + path);
        t.colorSpace = THREE.NoColorSpace;
        t.flipY = false;
        t.generateMipmaps = false;
        t.minFilter = t.magFilter = THREE.LinearFilter;
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
        loaded.set(path, t);
      })
    );
    const failed = results.find((r) => r.status === 'rejected');
    if (failed?.status === 'rejected') {
      loaded.forEach((t) => t.dispose());
      throw failed.reason;
    }
    loaded.forEach((t, p) => textures.set(p, t));
    ready = true;
  })().catch((e) => {
    pending = undefined;
    throw e;
  }));
}

export function createGrompAttackMaterial(index: number, texture: THREE.Texture, batched = false) {
  const p = source.profiles[index],
    m = createParticleColorProductMaterial(
      texture,
      white,
      batched ? 'vertex' : 'uniform',
      undefined,
      batched ? 'bgra-unorm8' : false
    );
  Object.assign(m, {
    name: `Gromp attack ${p.name}`,
    transparent: true,
    depthTest: p.depthTest,
    depthWrite: false,
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
  return m;
}

export class GrompAttack {
  readonly models = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  private point = new THREE.Vector3();
  private position = new THREE.Vector3();
  private scale = new THREE.Vector3();
  private rotation = new THREE.Quaternion();
  private roll = new THREE.Quaternion();
  private rollAxis = new THREE.Vector3(0, 0, 1);
  private frame = new THREE.Quaternion();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private matrix = new THREE.Matrix4();
  constructor(
    private scene: THREE.Scene,
    private ground: (p: Vec2) => number
  ) {}
  update(world: World, alpha: number, camera: THREE.Camera, terminalAge = 0) {
    const active = new Set<string>(),
      tick = world.tick - 1 + alpha + (world.winner ? terminalAge * 60 : 0);
    if (ready)
      for (const saved of world.grompAttackVisuals) {
        const effect =
          world.winner && saved.stopTick === null ? { ...saved, stopTick: world.tick } : saved;
        if (effect.stopTick !== null && tick >= effect.stopTick + GROMP_ATTACK_VISUAL_TAIL_TICKS)
          continue;
        const particles = grompAttackParticles(effect, tick).filter((p) =>
          world.pointVisible({ x: p.position[0], y: p.position[2] })
        );
        for (const [index, p] of source.profiles.entries()) {
          const selected = particles.filter((v) => v.profileIndex === index);
          if (!selected.length) continue;
          const key = `${effect.id}:${index}`;
          active.add(key);
          let mesh = this.models.get(key);
          if (!mesh) {
            const capacity = p.single
                ? Math.max(1, Math.trunc(p.rate))
                : Math.ceil(p.rate * p.life) + 2,
              geometry = new THREE.BufferGeometry();
            for (const [name, size] of [
              ['position', 3],
              ['uv', 2],
              ['particleLookupUv', 2],
            ] as const)
              geometry.setAttribute(
                name,
                new THREE.BufferAttribute(new Float32Array(capacity * 6 * size), size).setUsage(
                  THREE.DynamicDrawUsage
                )
              );
            geometry.setAttribute(
              '_source_vertex_bgra',
              new THREE.BufferAttribute(new Uint8Array(capacity * 6 * 4), 4, true).setUsage(
                THREE.DynamicDrawUsage
              )
            );
            mesh = new THREE.Mesh(
              geometry,
              createGrompAttackMaterial(index, textures.get(p.texture)!, true)
            );
            mesh.name = `Gromp attack ${p.name}`;
            mesh.renderOrder = p.priority;
            mesh.frustumCulled = false;
            mesh.userData.projectileId = effect.id;
            mesh.userData.sourceId = effect.sourceId;
            this.models.set(key, mesh);
            this.scene.add(mesh);
          }
          const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute,
            uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute,
            tint = mesh.geometry.getAttribute('_source_vertex_bgra') as THREE.BufferAttribute,
            lookup = mesh.geometry.getAttribute('particleLookupUv') as THREE.BufferAttribute,
            base = p.kind === 'quad' ? quad : billboard,
            basePosition = base.getAttribute('position'),
            baseUv = base.getAttribute('uv');
          if (selected.length * 6 > position.count)
            throw new Error('Gromp attack batch exceeds source lifetime capacity');
          for (const [ordinal, particle] of selected.entries()) {
            const birthGround = this.ground(particle.birth),
              currentGround = this.ground(particle.current);
            this.position.set(
              particle.position[0] * 0.01,
              particle.position[1] * 0.01 +
                birthGround +
                0.9 +
                p.bind * (currentGround - birthGround),
              particle.position[2] * 0.01
            );
            this.frame.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, particle.facing);
            if (p.kind === 'billboard' && !p.particleLocal) {
              this.rotation.copy(camera.quaternion);
              this.rotation.multiply(
                this.roll.setFromAxisAngle(
                  this.rollAxis,
                  -THREE.MathUtils.degToRad(particle.rotation[0])
                )
              );
            } else {
              this.rotation.setFromEuler(
                this.euler.set(
                  ...(particle.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
                  'YXZ'
                )
              );
              if (p.local) this.rotation.premultiply(this.frame);
            }
            this.scale.fromArray(particle.scale).multiplyScalar(0.01);
            this.matrix.compose(this.position, this.rotation, this.scale);
            writeGrompAttackColor(
              tint.array as Uint8Array,
              ordinal * 6,
              6,
              particle.color,
              p.blend
            );
            for (let v = 0; v < 6; v++) {
              const at = ordinal * 6 + v;
              this.point.fromBufferAttribute(basePosition, v).applyMatrix4(this.matrix);
              position.setXYZ(at, this.point.x, this.point.y, this.point.z);
              uv.setXY(at, baseUv.getX(v), baseUv.getY(v));
              lookup.setXY(at, particle.phase, 0.5);
            }
          }
          mesh.userData.ordinals = selected.map((v) => v.ordinal);
          mesh.userData.particleCount = selected.length;
          mesh.geometry.setDrawRange(0, selected.length * 6);
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
