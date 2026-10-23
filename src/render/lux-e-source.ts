import fieldProfiles from '../content/lux-e-field.json';
import { LuxEFieldCloud } from './lux-e-field';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import profiles from '../content/lux-e-particles.json';
import burstProfiles from '../content/lux-e-burst.json';
import { LuxEBurstCloud } from './lux-e-burst';
import { createParticleColorProductMaterial } from './particle-color-product';
import { loadLuxParticleTextures } from './lux-particle-textures';
import { groundEffectMaterial, setGroundRenderStage } from './ground-display-list';
import { luxEParticles, type LuxERole } from './lux-e-particles';
import type { World } from '../simulation/world';
import type { Vec2 } from '../simulation/math';

let assets:
  { textures: ReadonlyMap<string, THREE.Texture>; indicator: THREE.BufferGeometry } | undefined;
let pending: Promise<void> | undefined;
export function loadLuxESource(): Promise<void> {
  if (assets) return Promise.resolve();
  return (pending ??= (async () => {
    const paths = profiles
      .flatMap((p) => [
        p.texture,
        p.lookup,
        p.mult,
        p.palette?.texture ?? '',
        p.erosion?.texture ?? '',
      ])
      .filter(Boolean);
    paths.push(
      ...fieldProfiles
        .flatMap((p) => [p.texture, p.lookup, p.mult, p.palette?.texture ?? ''])
        .filter(Boolean)
    );
    paths.push(...burstProfiles.flatMap((p) => [p.texture, p.lookup]).filter(Boolean));
    const [textures, gltf] = await Promise.allSettled([
      loadLuxParticleTextures(paths),
      new GLTFLoader().loadAsync(import.meta.env.BASE_URL + 'assets/models/lux-e-indicator.glb'),
    ]);
    const candidates: THREE.BufferGeometry[] = [];
    if (gltf.status === 'fulfilled')
      gltf.value.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          candidates.push(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
        }
      });
    if (textures.status === 'rejected' || gltf.status === 'rejected' || candidates.length !== 1) {
      candidates.forEach((g) => g.dispose());
      if (textures.status === 'rejected') throw textures.reason;
      if (gltf.status === 'rejected') throw gltf.reason;
      throw Error('Expected one source E indicator geometry');
    }
    assets = { textures: textures.value, indicator: candidates[0] };
  })().catch((error) => {
    pending = undefined;
    throw error;
  }));
}

export function createLuxEMaterial(index: number, textures: ReadonlyMap<string, THREE.Texture>) {
  const p = profiles[index];
  const texture = (path: string) => {
    const t = textures.get(path);
    if (!t) throw Error(`Missing source E texture ${path}`);
    return t;
  };
  const material = createParticleColorProductMaterial(
    texture(p.texture),
    texture(p.lookup),
    'uniform',
    undefined,
    false,
    p.palette
      ? {
          texture: texture(p.palette.texture),
          sourceMix: p.palette.mix as [number, number, number, number],
          row: p.palette.row,
        }
      : undefined
  );
  Object.assign(material.uniforms, {
    multTexture: { value: texture(p.mult) },
    multScale: { value: new THREE.Vector2(1, 1) },
    multOffset: { value: new THREE.Vector2() },
    erosionMap: { value: texture(p.erosion?.texture ?? '') },
    erosionDrive: { value: 0 },
    erosionMixer: { value: new THREE.Vector4().fromArray(p.erosion?.mix ?? [0, 0, 0, 0]) },
  });
  material.vertexShader = material.vertexShader
    .replace('varying vec2 sourceUv;', 'varying vec2 sourceUv; varying vec2 rawUv;')
    .replace('void main() {', 'void main() { rawUv = uv;');
  material.fragmentShader = material.fragmentShader
    .replace(
      'varying vec2 sourceUv;',
      `varying vec2 sourceUv; varying vec2 rawUv;
    uniform sampler2D multTexture; uniform vec2 multScale; uniform vec2 multOffset;
    uniform sampler2D erosionMap; uniform float erosionDrive; uniform vec4 erosionMixer;`
    )
    .replace('texture2D(sourceTexture, sourceUv)', 'texture2D(sourceTexture, fract(sourceUv))');
  if (p.uvMode === 2)
    material.fragmentShader = material.fragmentShader.replace(
      'vec4 sourceColor = texture2D(sourceTexture, fract(sourceUv));',
      'vec4 sourceColor = texture2D(sourceTexture, fract(sourceUv)); sourceColor.a = texture2D(sourceTexture, rawUv).a;'
    );
  material.fragmentShader = material.fragmentShader.replace(
    /}\s*$/,
    `
    ${p.mult ? 'gl_FragColor *= texture2D(multTexture, fract((rawUv-0.5)*multScale+0.5+multOffset));' : ''}
    ${
      p.erosion
        ? `vec2 erodeUv = 1.0-abs(mod(sourceUv,2.0)-1.0);
    float value = clamp(dot(texture2D(erosionMap,erodeUv),erosionMixer),0.0,1.0);
    gl_FragColor.a *= clamp(erosionDrive-value+1.5,0.0,1.0)-clamp(erosionDrive-value,0.0,1.0);`
        : ''
    }
  }`
  );
  Object.assign(material, {
    name: `Lucent ${p.role} ${p.index} ${p.name}`,
    transparent: true,
    depthWrite: false,
    depthTest: (p.misc & 1) === 0,
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
  if (p.ground) groundEffectMaterial(material);
  return material;
}

const corners = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, -1],
  [1, 1],
  [-1, 1],
];
/** Owned geometry/materials; textures and source template remain session-owned. */
export class LuxESource {
  readonly root = new THREE.Group();
  private meshes = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>>();
  private point = new THREE.Vector3();
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();
  private size = new THREE.Vector3();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private burst: LuxEBurstCloud | undefined;
  private field: LuxEFieldCloud | undefined;
  constructor(
    private camera: THREE.Camera,
    private ground: (p: Vec2) => number
  ) {}
  draw(
    world: World,
    role: LuxERole,
    seed: number,
    age: number,
    at: Vec2,
    origin: Vec2,
    target: Vec2,
    team: string
  ) {
    if (!assets) return;
    this.camera.updateMatrixWorld();
    this.right.setFromMatrixColumn(this.camera.matrixWorld, 0);
    this.up.setFromMatrixColumn(this.camera.matrixWorld, 1);
    const d = Math.hypot(target.x - origin.x, target.y - origin.y);
    const fx = d ? (target.x - origin.x) / d : 0,
      fy = d ? (target.y - origin.y) / d : 1;
    const active = new Set<string>();
    if (role === 'ally' || role === 'enemy') {
      if (this.field?.role !== role) {
        this.field?.dispose();
        this.field = new LuxEFieldCloud(role, assets.textures);
        this.root.add(...this.field.meshes);
      }
      this.field.draw(world, seed, age, at, origin, target, team, this.camera, this.ground);
    } else if (this.field) {
      this.field.dispose();
      this.field = undefined;
    }

    if (role === 'burst') {
      if (!this.burst) {
        this.burst = new LuxEBurstCloud(assets.textures);
        this.root.add(...this.burst.meshes);
      }
      this.burst.draw(world, seed, age, at, origin, target, team, this.camera, this.ground);
    } else if (this.burst) {
      this.burst.dispose();
      this.burst = undefined;
    }
    for (const particle of luxEParticles(role, seed, age)) {
      const p = profiles[particle.profileIndex],
        key = `${particle.profileIndex}:${particle.ordinal}`;
      active.add(key);
      let mesh = this.meshes.get(key);
      if (!mesh) {
        const geometry =
          p.primitive === 'mesh' ? assets.indicator.clone() : new THREE.BufferGeometry();
        if (p.primitive !== 'mesh') {
          geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3));
          geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(12), 2));
        }
        mesh = new THREE.Mesh(geometry, createLuxEMaterial(particle.profileIndex, assets.textures));
        geometry.setIndex(
          new THREE.BufferAttribute(new Uint16Array(geometry.getAttribute('position').count), 1)
        );
        mesh.name = `Lucent ${p.role} ${p.index} ${p.name}`;
        mesh.renderOrder = p.passOrder;
        mesh.frustumCulled = false;
        mesh.userData.profileIndex = particle.profileIndex;
        if (p.ground) setGroundRenderStage(mesh, 'ground');
        // Retain untransformed source corners for arbitrary seek/order reconstruction.
        if (p.primitive === 'mesh') {
          // GLTFLoader may interleave positions and UVs. Preserve only source XYZ;
          // treating its packed array as vec3 corners mixes UV bytes into motion.
          const position = geometry.getAttribute('position');
          mesh.userData.source = Array.from({ length: position.count }, (_, i) => [
            position.getX(i),
            position.getY(i),
            position.getZ(i),
          ]).flat();
        }
        this.meshes.set(key, mesh);
        this.root.add(mesh);
      }
      const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
      const radians = particle.rotation.map((v) => (v * Math.PI) / 180);
      this.euler.set(radians[0], radians[1], radians[2], 'YXZ');
      this.size.fromArray(particle.scale);
      for (let i = 0; i < position.count; i++) {
        if (p.primitive === 'camera') {
          const [x, y] = corners[i],
            roll = -radians[0],
            c = Math.cos(roll),
            s = Math.sin(roll);
          this.point
            .copy(this.right)
            .multiplyScalar((x * c - y * s) * particle.scale[0] * 0.01)
            .addScaledVector(this.up, (x * s + y * c) * particle.scale[1] * 0.01);
          this.point.x += at.x * 0.01;
          this.point.z += at.y * 0.01;
          this.point.y += this.ground(at) + 1 + p.offset[1] * 0.01;
          uv.setXY(i, (x + 1) / 2, (1 - y) / 2);
        } else {
          if (p.primitive === 'mesh')
            this.point.fromArray(mesh.userData.source, i * 3).multiplyScalar(100);
          else {
            const [x, y] = corners[i];
            this.point.set(x, y, 0);
            uv.setXY(i, (y + 1) / 2, (1 - x) / 2);
          }
          this.point.multiply(this.size).applyEuler(this.euler);
          this.point.x += p.offset[0];
          this.point.y += p.offset[1];
          this.point.z += p.offset[2];
          const x = p.local ? -fy * this.point.x + fx * this.point.z : this.point.x;
          const y = p.local ? fx * this.point.x + fy * this.point.z : this.point.z;
          const horizontal = { x: at.x + x, y: at.y + y };
          this.point.set(
            horizontal.x * 0.01,
            this.ground(horizontal) + 1 + this.point.y * 0.01,
            horizontal.y * 0.01
          );
          if (p.primitive === 'mesh') this.point.y = this.ground(horizontal) + 0.02;
        }
        position.setXYZ(i, this.point.x, this.point.y, this.point.z);
      }
      // Conservatively suppress enemy triangles unless all corners are observed.
      const index = mesh.geometry.index!;
      let count = 0;
      for (let i = 0; i < position.count; i += 3)
        if (
          team === 'blue' ||
          [i, i + 1, i + 2].every((j) =>
            world.pointVisible({ x: position.getX(j) * 100, y: position.getZ(j) * 100 })
          )
        ) {
          index.setX(count++, i);
          index.setX(count++, i + 1);
          index.setX(count++, i + 2);
        }
      index.needsUpdate = true;
      mesh.geometry.setDrawRange(0, count);
      position.needsUpdate = uv.needsUpdate = true;
      const u = mesh.material.uniforms,
        color = [...particle.color];
      if (p.blend === 0 || p.blend === 2) {
        for (let i = 0; i < 3; i++) color[i] *= color[3];
        if (p.blend === 0) color[3] = 1;
      }
      u.particleColor.value.fromArray(color);
      u.lookupUv.value.fromArray(particle.lookup);
      u.sourceUvOffset.value.fromArray(particle.uvOffset);
      u.multScale.value.fromArray(particle.multScale);
      u.multOffset.value.fromArray(particle.multOffset);
      u.erosionDrive.value = particle.erosion;
    }
    for (const [key, mesh] of this.meshes)
      if (!active.has(key)) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.meshes.delete(key);
      }
  }
  dispose() {
    this.field?.dispose();
    this.field = undefined;
    this.burst?.dispose();
    this.burst = undefined;
    this.root.removeFromParent();
    for (const mesh of this.meshes.values()) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.meshes.clear();
    this.root.clear();
  }
}
