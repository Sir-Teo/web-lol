import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import profiles from '../content/oracle-particles.json';
import source from '../content/oracle-lens.json';
import { oracleParticles, type OracleParticleWindow } from './oracle-particle-state';
import { createParticleColorProductMaterial } from './particle-color-product';

interface Assets {
  rig: THREE.Group;
  clip: THREE.AnimationClip;
  meshes: Map<string, THREE.BufferGeometry>;
  textures: Map<string, THREE.Texture>;
}
let assets: Assets | null = null;
let pending: Promise<void> | null = null;
const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
white.needsUpdate = true;
/** Selected-effect preparation is atomic. A failed partial request disposes all
 * completed resources and permits retry; it never advances presentation state. */
export function loadOracleParticles(): Promise<void> {
  if (assets) return Promise.resolve();
  if (pending) return pending;
  pending = (async () => {
    const meshes = new Map<string, THREE.BufferGeometry>(),
      textures = new Map<string, THREE.Texture>(),
      geometries = new Set<THREE.BufferGeometry>();
    let rig: THREE.Group | undefined, clip: THREE.AnimationClip | undefined;
    const results = await Promise.allSettled([
      ...[...new Set(profiles.flatMap((p) => (p.mesh ? [p.mesh] : [])))].map(async (path) => {
        const gltf = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + path);
        gltf.scene.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          geometries.add(o.geometry);
          meshes.set(path, o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
            m.dispose();
          }
        });
        if (!meshes.has(path)) throw new Error(`Missing Oracle geometry: ${path}`);
        if (path === source.bindings.Trinket_Red.mesh) {
          rig = gltf.scene;
          clip = gltf.animations.find((c) => c.name === source.clip);
          if (!clip) throw new Error('Missing original Oracle animation');
        }
      }),
      ...[...new Set(profiles.flatMap((p) => [p.texture, p.lookup].filter((v) => v !== null)))].map(
        async (path) => {
          const texture = await new THREE.TextureLoader().loadAsync(
            import.meta.env.BASE_URL + path
          );
          texture.colorSpace = THREE.NoColorSpace;
          texture.flipY = false;
          texture.generateMipmaps = false;
          texture.minFilter = texture.magFilter = THREE.LinearFilter;
          texture.wrapS = texture.wrapT = profiles.some((p) => p.lookup === path)
            ? THREE.ClampToEdgeWrapping
            : THREE.RepeatWrapping;
          textures.set(path, texture);
        }
      ),
    ]);
    const failure = results.find((r) => r.status === 'rejected');
    if (failure?.status === 'rejected' || !rig || !clip) {
      geometries.forEach((g) => g.dispose());
      textures.forEach((t) => t.dispose());
      throw failure?.status === 'rejected' ? failure.reason : new Error('Missing Oracle rig');
    }
    assets = { rig, clip, meshes, textures };
  })().finally(() => {
    pending = null;
  });
  return pending;
}

const billboard = new THREE.PlaneGeometry(2, 2),
  quad = new THREE.PlaneGeometry(2, 2),
  projected = new THREE.PlaneGeometry(2, 2, 16, 16);
for (const geometry of [quad, projected]) {
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i),
      v = uv.getY(i);
    uv.setXY(i, v, 1 - u);
  }
}
const billboardUv = billboard.getAttribute('uv');
for (let i = 0; i < billboardUv.count; i++) billboardUv.setY(i, 1 - billboardUv.getY(i));

/** Native initial RGBA product for unskinned particles; local blend adapter.
 * UV divisors are floating point, independent of frame indexing and scrolling.
 * Native UV_MODE, reflection, projection fade and navmesh masks remain open. */
export function createOracleParticleMaterial(
  index: number,
  base: THREE.Texture,
  lookup: THREE.Texture,
  batched = false
) {
  const p = profiles[index],
    material = createParticleColorProductMaterial(
      base,
      lookup,
      batched ? 'vertex' : 'uniform',
      undefined,
      batched
    );
  material.uniforms.sourceUvScale = { value: new THREE.Vector2(1, 1) };
  material.uniforms.atlasOffset = { value: new THREE.Vector2() };
  material.vertexShader = material.vertexShader
    .replace(
      'uniform vec2 sourceUvOffset;',
      'uniform vec2 sourceUvOffset;\nuniform vec2 sourceUvScale;\nuniform vec2 atlasOffset;'
    )
    .replace(
      'sourceUv = uv + sourceUvOffset;',
      'sourceUv = (uv + sourceUvOffset) * sourceUvScale + atlasOffset;'
    );
  if (batched) {
    material.vertexShader = material.vertexShader
      .replace(
        'uniform vec2 sourceUvScale;',
        'attribute vec2 particleUvScale;\nattribute vec2 particleUvScroll;\nattribute vec2 particleAtlasOffset;\nuniform vec2 sourceUvScale;'
      )
      .replace(
        '(uv + sourceUvOffset) * sourceUvScale + atlasOffset',
        '(uv + particleUvScroll) * particleUvScale + particleAtlasOffset'
      )
      // Each matrix is the same CPU-composed model-view uniform the separate
      // draw used. Keep multiplication order; do not bake/round world vertices.
      .replace(
        'gl_Position = projectionMatrix * modelViewMatrix * localPosition;',
        'gl_Position = projectionMatrix * instanceMatrix * vec4(position, 1.0);'
      )
      .replace('varying vec4 vertexColor;', 'flat varying vec4 vertexColor;')
      .replace('varying vec2 colorUv;', 'flat varying vec2 colorUv;');
    material.fragmentShader = material.fragmentShader
      .replace('varying vec4 vertexColor;', 'flat varying vec4 vertexColor;')
      .replace('varying vec2 colorUv;', 'flat varying vec2 colorUv;')
      .replace('sourceColor * particleColor * texture2D', 'sourceColor * vertexColor * texture2D')
      .replace('gl_FragColor *= vertexColor;', '');
  }
  Object.assign(material, {
    name: `Oracle ${p.role} ${p.index} ${p.name}`,
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

/** Coordinates use source units. The caller supplies a seekable anchor so
 * unbound particles retain their birth location even when the owner moves. */
export interface OracleAnchor {
  position: readonly number[];
  facing: number;
}
export interface OracleEffectInput {
  id: string;
  ownerId: number;
  window: OracleParticleWindow;
  anchorAt: (tick: number) => OracleAnchor;
  /** An optional captured cast frame for systems whose roots follow the owner. */
  birthAnchor?: (tick: number) => OracleAnchor;
}
interface ParticleModel {
  root: THREE.Object3D;
  meshes: THREE.Mesh[];
  mixer?: THREE.AnimationMixer;
  ownedGeometry: boolean;
  batched?: boolean;
}
interface SortEntry {
  id: number;
  groupOrder: number;
  renderOrder: number;
  z: number;
  object: THREE.Object3D;
  model?: ParticleModel;
}
/** Three's existing transparent order, retaining the first logical object's id
 * when a contiguous run replaces separate draws. Other scene draws are barriers. */
const transparentSort: NonNullable<Parameters<THREE.WebGLRenderer['setTransparentSort']>[0]> = (
  a,
  b
) =>
  a.groupOrder - b.groupOrder ||
  a.renderOrder - b.renderOrder ||
  b.z - a.z ||
  (a.object.userData.oracleSortId ?? a.id) - (b.object.userData.oracleSortId ?? b.id);
/** Deterministic declaration playback, including arbitrary seeks. This adapter
 * accepts explicit systems; deciding which gameplay event starts them is separate.
 * The source rig keeps Three's skinning path, with local unlit RGBA shading.
 */
export class OracleParticles {
  readonly models = new Map<string, ParticleModel>();
  readonly batches = new Map<
    string,
    THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>
  >();
  private materials = new Map<number, THREE.ShaderMaterial>();
  private batchRoots = new WeakSet<THREE.Object3D>();
  private projection = new THREE.Matrix4();
  private center = new THREE.Vector4();
  private frame = new THREE.Quaternion();
  private rotation = new THREE.Quaternion();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private vector = new THREE.Vector3();
  constructor(
    private scene: THREE.Scene,
    private batching = true
  ) {
    const previous = scene.onBeforeRender;
    scene.onBeforeRender = (...args) => {
      previous.apply(scene, args);
      if (this.batching) {
        args[0].setTransparentSort(transparentSort);
        this.prepare(args[2]);
      }
    };
  }
  /** Actual GPU ownership, distinct from the retained logical particle records. */
  get draws(): THREE.Mesh[] {
    return [
      ...this.batches.values(),
      ...[...this.models.values()].filter((m) => !m.batched).flatMap((m) => m.meshes),
    ];
  }
  private removeBatch(key: string, mesh: THREE.InstancedMesh) {
    this.scene.remove(mesh);
    mesh.dispose();
    mesh.geometry.dispose();
    this.batches.delete(key);
  }
  private remove(key: string, model: ParticleModel) {
    this.scene.remove(model.root);
    model.mixer?.stopAllAction();
    model.mixer?.uncacheRoot(model.root);
    if (model.batched) {
      this.models.delete(key);
      return;
    }
    for (const mesh of model.meshes) {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
        material.dispose();
      if (model.ownedGeometry) mesh.geometry.dispose();
      if (mesh instanceof THREE.SkinnedMesh) mesh.skeleton.dispose();
    }
    this.models.delete(key);
  }
  clear() {
    for (const [key, model] of this.models) this.remove(key, model);
    for (const [key, mesh] of this.batches) this.removeBatch(key, mesh);
    this.materials.forEach((m) => m.dispose());
    this.materials.clear();
  }
  private prepare(camera: THREE.Camera): void {
    if (![...this.models.values()].some((m) => m.batched && m.root.visible)) {
      for (const [key, mesh] of this.batches) this.removeBatch(key, mesh);
      return;
    }
    this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const sorted: SortEntry[] = [];
    const entry = (
      object: THREE.Mesh | THREE.Line | THREE.Points | THREE.Sprite,
      groupOrder: number,
      model?: ParticleModel
    ) => {
      const sphereObject = object as THREE.Mesh & {
        boundingSphere?: THREE.Sphere | null;
        computeBoundingSphere?: () => void;
      };
      if (sphereObject.boundingSphere === null) sphereObject.computeBoundingSphere?.();
      if (!object.geometry.boundingSphere) object.geometry.computeBoundingSphere();
      const center = sphereObject.boundingSphere?.center ?? object.geometry.boundingSphere!.center;
      this.center
        .set(center.x, center.y, center.z, 1)
        .applyMatrix4(object.matrixWorld)
        .applyMatrix4(this.projection);
      sorted.push({
        id: object.userData.oracleSortId ?? object.id,
        groupOrder,
        renderOrder: object.renderOrder,
        z: this.center.z,
        object,
        model,
      });
    };
    for (const model of this.models.values())
      if (model.batched && model.root.visible) {
        model.root.updateMatrixWorld(true);
        entry(model.meshes[0], 0, model);
      }
    // Include visible external transparent objects as conservative barriers, even
    // if later frustum culling removes one. Preserve ordering around other effects.
    const visit = (object: THREE.Object3D, inherited: number) => {
      if (!object.visible || this.batchRoots.has(object)) return;
      let groupOrder = inherited;
      if (object.layers.test(camera.layers)) {
        if ((object as THREE.Group).isGroup) groupOrder = object.renderOrder;
        if (
          (object as THREE.Mesh).isMesh ||
          (object as THREE.Line).isLine ||
          (object as THREE.Points).isPoints ||
          (object as THREE.Sprite).isSprite
        ) {
          const drawable = object as THREE.Mesh;
          const materials = Array.isArray(drawable.material)
            ? drawable.material
            : [drawable.material];
          if (materials.some((m) => m.visible && m.transparent)) entry(drawable, groupOrder);
        }
      }
      for (const child of object.children) visit(child, groupOrder);
    };
    visit(this.scene, 0);
    sorted.sort(
      (a, b) =>
        a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder || b.z - a.z || a.id - b.id
    );
    const runs: SortEntry[][] = [];
    let run: SortEntry[] | undefined;
    for (const item of sorted) {
      if (!item.model) {
        run = undefined;
        continue;
      }
      if (
        !run ||
        run[0].model!.root.userData.profileIndex !== item.model.root.userData.profileIndex
      ) {
        run = [];
        runs.push(run);
      }
      run.push(item);
    }
    const active = new Set<string>(),
      ordinals = new Map<number, number>();
    for (const items of runs) {
      const index = items[0].model!.root.userData.profileIndex as number;
      const ordinal = ordinals.get(index) ?? 0;
      ordinals.set(index, ordinal + 1);
      const key = `${index}:${ordinal}`;
      active.add(key);
      let mesh = this.batches.get(key);
      if (mesh && items.length > mesh.instanceMatrix.count) {
        this.removeBatch(key, mesh);
        mesh = undefined;
      }
      if (!mesh) {
        const geometry = items[0].model!.meshes[0].geometry.clone(),
          capacity = THREE.MathUtils.ceilPowerOfTwo(items.length);
        for (const [name, size] of [
          ['particleTint', 4],
          ['particleLookupUv', 2],
          ['particleUvScroll', 2],
          ['particleUvScale', 2],
          ['particleAtlasOffset', 2],
        ] as const)
          geometry.setAttribute(
            name,
            new THREE.InstancedBufferAttribute(new Float32Array(capacity * size), size).setUsage(
              THREE.DynamicDrawUsage
            )
          );
        mesh = new THREE.InstancedMesh(geometry, this.materials.get(index)!, capacity);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.name = `Oracle ordered batch ${index}:${ordinal}`;
        this.batchRoots.add(mesh);
        this.batches.set(key, mesh);
        this.scene.add(mesh);
      }
      mesh.count = items.length;
      mesh.renderOrder = items[0].renderOrder;
      mesh.userData.oracleSortId = items[0].id;
      // Only the sorting center is world-space. Instance matrices deliberately
      // contain model-view transforms; geometry and source UVs remain original.
      const first = items[0].model!.meshes[0],
        sphere = first.geometry.boundingSphere!;
      mesh.boundingSphere = new THREE.Sphere(
        sphere.center.clone().applyMatrix4(first.matrixWorld),
        0
      );
      mesh.userData.particleKeys = [];
      for (const [slot, item] of items.entries()) {
        const model = item.model!,
          p = model.root.userData.particle;
        model.root.modelViewMatrix.multiplyMatrices(
          camera.matrixWorldInverse,
          model.root.matrixWorld
        );
        mesh.setMatrixAt(slot, model.root.modelViewMatrix);
        const color = [...p.color];
        if (profiles[index].blend === 0) {
          for (let i = 0; i < 3; i++) color[i] *= color[3];
          color[3] = 1;
        }
        for (const [name, value] of [
          ['particleTint', color],
          ['particleLookupUv', p.lookup],
          ['particleUvScroll', p.scroll],
          ['particleUvScale', p.uvScale],
          ['particleAtlasOffset', p.uvOffset],
        ] as const)
          (mesh.geometry.getAttribute(name) as THREE.InstancedBufferAttribute).array.set(
            value,
            slot * value.length
          );
        mesh.userData.particleKeys.push(model.root.userData.particleKey);
      }
      mesh.instanceMatrix.needsUpdate = true;
      for (const name of [
        'particleTint',
        'particleLookupUv',
        'particleUvScroll',
        'particleUvScale',
        'particleAtlasOffset',
      ])
        mesh.geometry.getAttribute(name).needsUpdate = true;
    }
    for (const [key, mesh] of this.batches) if (!active.has(key)) this.removeBatch(key, mesh);
  }
  update(
    inputs: readonly OracleEffectInput[],
    tick: number,
    camera: THREE.Camera,
    ground: (x: number, z: number) => number,
    onlyProfile: number | null = null
  ) {
    if (!assets) throw new Error('Oracle particle assets were not prepared');
    const active = new Set<string>();
    for (const input of inputs)
      for (const particle of oracleParticles(input.ownerId, input.window, tick)) {
        const p = profiles[particle.profileIndex];
        if (p.kind === 'child' || (onlyProfile !== null && onlyProfile !== particle.profileIndex))
          continue;
        const key = `${input.id}:${particle.profileIndex}:${particle.ordinal}`;
        active.add(key);
        let model = this.models.get(key);
        if (!model) {
          if (p.kind === 'rig') {
            const root = clone(assets.rig),
              meshes: THREE.Mesh[] = [];
            root.traverse((o) => {
              if (!(o instanceof THREE.Mesh)) return;
              o.material = new THREE.MeshBasicMaterial({
                map: assets!.textures.get(p.texture!)!,
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide,
                toneMapped: false,
              });
              meshes.push(o);
            });
            const mixer = new THREE.AnimationMixer(root);
            mixer.clipAction(assets.clip).play();
            model = { root, meshes, mixer, ownedGeometry: false };
          } else {
            const original = p.mesh
              ? assets.meshes.get(p.mesh)!
              : p.kind === 'quad'
                ? quad
                : p.kind === 'projection'
                  ? projected
                  : billboard;
            const ownedGeometry = p.ground || p.kind === 'projection';
            const batched = this.batching && !ownedGeometry;
            let material = this.materials.get(particle.profileIndex);
            if (!material || !batched) {
              material = createOracleParticleMaterial(
                particle.profileIndex,
                assets.textures.get(p.texture!)!,
                p.lookup ? assets.textures.get(p.lookup)! : white,
                batched
              );
              if (batched) this.materials.set(particle.profileIndex, material);
            }
            const mesh = new THREE.Mesh(ownedGeometry ? original.clone() : original, material);
            model = { root: mesh, meshes: [mesh], ownedGeometry, batched };
          }
          model.root.name = `Oracle ${p.role} ${p.index} ${p.name}`;
          model.root.userData.profileIndex = particle.profileIndex;
          model.root.userData.effectId = input.id;
          model.root.userData.ownerId = input.ownerId;
          model.root.userData.particleKey = key;
          for (const mesh of model.meshes) {
            mesh.frustumCulled = false;
            mesh.renderOrder = p.renderOrder;
          }
          this.models.set(key, model);
          if (!model.batched) this.scene.add(model.root);
        }
        const born = (input.birthAnchor ?? input.anchorAt)(particle.bornTick),
          now = input.anchorAt(tick);
        const anchor = born.position.map((v, i) => v + (now.position[i] - v) * particle.bind);
        const facing = p.particleLocal ? now.facing : born.facing;
        this.frame.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, facing);
        this.vector.fromArray(particle.offset).applyQuaternion(this.frame);
        model.root.position.fromArray(anchor).add(this.vector).multiplyScalar(0.01);
        this.rotation.setFromEuler(
          this.euler.set(
            ...(particle.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
            'YXZ'
          )
        );
        if (p.kind === 'billboard') {
          model.root.quaternion.copy(camera.quaternion);
          model.root.rotateZ(-THREE.MathUtils.degToRad(particle.rotation[0]));
        } else {
          model.root.quaternion
            .copy(p.local ? this.frame : new THREE.Quaternion())
            .multiply(this.rotation);
        }
        model.root.scale.fromArray(particle.scale).multiplyScalar(p.mesh ? 1 : 0.01);
        if (p.direction) {
          this.vector
            .fromArray(particle.travel)
            .applyQuaternion(this.frame)
            .applyQuaternion(camera.quaternion.clone().invert());
          model.root.quaternion.copy(camera.quaternion);
          model.root.rotateZ(Math.atan2(this.vector.y, this.vector.x) - Math.PI / 2);
          model.root.scale.y *= Math.max(p.directionMin, this.vector.length() * p.directionScale);
        }
        if (model.ownedGeometry) {
          const mesh = model.meshes[0],
            original = p.mesh ? assets.meshes.get(p.mesh)! : projected;
          model.root.updateMatrix();
          const positions = mesh.geometry.getAttribute('position');
          for (let i = 0; i < positions.count; i++) {
            this.vector
              .fromBufferAttribute(original.getAttribute('position'), i)
              .applyMatrix4(model.root.matrix);
            this.vector.y =
              ground(this.vector.x / 0.01, this.vector.z / 0.01) +
              (p.kind === 'projection' ? 0.02 : particle.offset[1] * 0.01);
            positions.setXYZ(i, this.vector.x, this.vector.y, this.vector.z);
          }
          positions.needsUpdate = true;
          mesh.geometry.computeBoundingBox();
          model.root.position.set(0, 0, 0);
          model.root.quaternion.identity();
          model.root.scale.set(1, 1, 1);
        }
        model.mixer?.setTime(particle.age);
        model.root.userData.particle = particle;
        for (const mesh of model.meshes) {
          const material = mesh.material as THREE.ShaderMaterial | THREE.MeshBasicMaterial;
          if (material instanceof THREE.ShaderMaterial) {
            // The batch uploads these values as instance attributes in prepare().
            if (model.batched) continue;
            const color = [...particle.color];
            if (p.blend === 0) {
              for (let i = 0; i < 3; i++) color[i] *= color[3];
              color[3] = 1;
            }
            material.uniforms.particleColor.value.fromArray(color);
            material.uniforms.lookupUv.value.fromArray(particle.lookup);
            material.uniforms.sourceUvOffset.value.fromArray(particle.scroll);
            material.uniforms.sourceUvScale.value.fromArray(particle.uvScale);
            material.uniforms.atlasOffset.value.fromArray(particle.uvOffset);
          } else {
            material.color.fromArray(particle.color);
            material.opacity = particle.color[3];
          }
        }
      }
    for (const [key, model] of this.models) if (!active.has(key)) this.remove(key, model);
    const profilesInUse = new Set(
      [...this.models.values()].filter((m) => m.batched).map((m) => m.root.userData.profileIndex)
    );
    for (const [index, material] of this.materials)
      if (!profilesInUse.has(index)) {
        material.dispose();
        this.materials.delete(index);
      }
  }
}
