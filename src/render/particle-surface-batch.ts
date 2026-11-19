import * as THREE from 'three';
import { particleColorMaterial } from './particle-color-phase';

type Surface = THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
type SurfaceFamily = 'eclipse-surface' | 'color-product';

interface BatchSlot {
  geometry: THREE.InstancedBufferGeometry;
  interleaved: THREE.InstancedInterleavedBuffer;
}

interface Batch {
  key: string;
  family: SurfaceFamily;
  mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  slots: [BatchSlot, BatchSlot, BatchSlot];
  capacity: number;
  hasSourceUvScale: boolean;
  hasAtlasOffset: boolean;
}

interface TransparentItem {
  object: THREE.Object3D;
  material: THREE.Material;
  groupOrder: number;
  renderOrder: number;
  z: number;
  id: number;
  colorPhase: boolean;
  additive: boolean;
  surface: Surface | null;
  batchKey: string | null;
  family: SurfaceFamily | null;
}

const COLOR_PRODUCT_UNIFORMS = new Set([
  'sourceTexture',
  'particleColorTexture',
  'particleColor',
  'lookupUv',
  'sourceUvOffset',
  'sourceUvScale',
  'atlasOffset',
  'multiplierTexture',
  'paletteTexture',
  'paletteSourceMix',
  'paletteRow',
  'paletteScroll',
]);

const ECLIPSE_DEFINES = [
  'SOURCE_MESH',
  'SOURCE_MULT',
  'SOURCE_QUAD_SECONDARY_UV',
  'SOURCE_LOCK_ALPHA',
  'SOURCE_REMAP',
  'SOURCE_PALETTE',
  'SOURCE_EROSION',
  'SOURCE_SOFT',
] as const;

/** Conservative operator-norm bound matching RigPoseCulling.transformSphere. */
function transformSphere(sphere: THREE.Sphere, matrix: THREE.Matrix4): THREE.Sphere {
  const m = matrix.elements;
  const row = Math.max(
    Math.abs(m[0]) + Math.abs(m[4]) + Math.abs(m[8]),
    Math.abs(m[1]) + Math.abs(m[5]) + Math.abs(m[9]),
    Math.abs(m[2]) + Math.abs(m[6]) + Math.abs(m[10])
  );
  const column = Math.max(
    Math.abs(m[0]) + Math.abs(m[1]) + Math.abs(m[2]),
    Math.abs(m[4]) + Math.abs(m[5]) + Math.abs(m[6]),
    Math.abs(m[8]) + Math.abs(m[9]) + Math.abs(m[10])
  );
  sphere.center.applyMatrix4(matrix);
  sphere.radius = sphere.radius * Math.sqrt(row * column) + 1e-4;
  return sphere;
}

function isPureAdditive(m: THREE.Material): boolean {
  return (
    m.blending === THREE.CustomBlending &&
    m.blendEquation === THREE.AddEquation &&
    (m.blendEquationAlpha === null || m.blendEquationAlpha === THREE.AddEquation) &&
    m.blendDst === THREE.OneFactor &&
    (m.blendDstAlpha === null || m.blendDstAlpha === THREE.OneFactor) &&
    !m.depthWrite
  );
}

function texId(u: THREE.IUniform | undefined): string {
  const v = u?.value as THREE.Texture | null | undefined;
  return v ? v.uuid : '';
}

function vecKey(u: THREE.IUniform | undefined): string {
  const v = u?.value;
  if (v === undefined || v === null) return '';
  if (typeof v === 'number') return String(v);
  if ('toArray' in v && typeof v.toArray === 'function') return v.toArray().join(',');
  return '';
}

/** Frustum-culls off-screen unculled particle meshes and batches visible static-geometry
 * SourceParticleSurfaces and ParticleColorProduct meshes into order-preserving instanced
 * draws for the duration of one render frame. Call restore() in finally after rendering
 * so logical .models meshes remain intact and visible outside GameView.render(). */
export class ParticleSurfaceBatcher {
  private readonly pools = new Map<string, Batch[]>();
  private readonly batchMeshes = new Set<THREE.Object3D>();
  private readonly activeBatches: Batch[] = [];
  private readonly hiddenMeshes: THREE.Mesh[] = [];
  private readonly sphereVersions = new WeakMap<THREE.BufferGeometry, number>();
  private readonly surfaceCache = new WeakMap<
    Surface,
    { family: SurfaceFamily; baseKey: string; hasSoftDepth: boolean } | null
  >();
  private readonly opaqueStaticSubtrees = new WeakSet<THREE.Object3D>();
  private readonly pureBoneSubtrees = new WeakSet<THREE.Object3D>();
  private readonly frustum = new THREE.Frustum();
  private readonly projScreenMatrix = new THREE.Matrix4();
  private readonly cameraInverse = new THREE.Matrix4();
  private readonly modelView = new THREE.Matrix4();
  private readonly worldSphere = new THREE.Sphere();
  private readonly sortPoint = new THREE.Vector4();
  private readonly centerWorld = new THREE.Vector3();
  private frameSlot = 0;

  constructor(private readonly scene: THREE.Scene) {}

  prepare(camera: THREE.Camera, earlyDistortionActive: boolean): void {
    this.cullOffscreen(camera);
    this.prepareBatches(earlyDistortionActive);
  }

  cullOffscreen(camera: THREE.Camera): void {
    this.restore();
    this.frameSlot = (this.frameSlot + 1) % 3;
    camera.updateMatrixWorld();
    this.cameraInverse.copy(camera.matrixWorldInverse);
    this.projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreenMatrix, camera.coordinateSystem);

    for (const child of this.scene.children) {
      if (this.batchMeshes.has(child)) continue;
      const mesh = child as THREE.Mesh;
      if (
        !mesh.isMesh ||
        !mesh.visible ||
        mesh.frustumCulled ||
        mesh.castShadow ||
        mesh.children.length > 0 ||
        (mesh as unknown as THREE.InstancedMesh).isInstancedMesh ||
        mesh.geometry instanceof THREE.InstancedBufferGeometry
      )
        continue;
      const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (!pos || pos.count === 0) continue;
      mesh.updateWorldMatrix(true, false);
      if (!mesh.geometry.boundingSphere || this.sphereVersions.get(mesh.geometry) !== pos.version) {
        mesh.geometry.computeBoundingSphere();
        this.sphereVersions.set(mesh.geometry, pos.version);
      }
      if (!mesh.geometry.boundingSphere) continue;
      transformSphere(this.worldSphere.copy(mesh.geometry.boundingSphere), mesh.matrixWorld);
      if (!this.frustum.intersectsSphere(this.worldSphere)) {
        mesh.visible = false;
        this.hiddenMeshes.push(mesh);
      }
    }
  }

  intersectsMesh(mesh: THREE.Mesh): boolean {
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos || pos.count === 0) return false;
    mesh.updateWorldMatrix(true, false);
    if (!mesh.geometry.boundingSphere || this.sphereVersions.get(mesh.geometry) !== pos.version) {
      mesh.geometry.computeBoundingSphere();
      this.sphereVersions.set(mesh.geometry, pos.version);
    }
    if (!mesh.geometry.boundingSphere) return false;
    transformSphere(this.worldSphere.copy(mesh.geometry.boundingSphere), mesh.matrixWorld);
    return this.frustum.intersectsSphere(this.worldSphere);
  }

  prepareBatches(earlyDistortionActive: boolean): void {
    const keyCounts = new Map<string, number>();
    const candidateOrders = new Set<number>();
    const preclassified = new Map<THREE.Object3D, { family: SurfaceFamily; key: string } | null>();
    let hasDuplicateBatchKey = false;
    for (const child of this.scene.children) {
      if (this.batchMeshes.has(child)) continue;
      const mesh = child as THREE.Mesh;
      if (
        !mesh.isMesh ||
        !mesh.visible ||
        mesh.frustumCulled ||
        mesh.castShadow ||
        mesh.children.length > 0 ||
        (mesh as unknown as THREE.InstancedMesh).isInstancedMesh ||
        mesh.geometry instanceof THREE.InstancedBufferGeometry
      )
        continue;
      if (!Array.isArray(mesh.material) && mesh.material?.visible && mesh.material.transparent) {
        const classified = this.getClassifiedSurface(mesh as Surface);
        preclassified.set(mesh, classified);
        if (classified) {
          const count = (keyCounts.get(classified.key) ?? 0) + 1;
          keyCounts.set(classified.key, count);
          if (count >= 2) {
            hasDuplicateBatchKey = true;
            candidateOrders.add(mesh.renderOrder);
          }
        }
      }
    }
    if (!hasDuplicateBatchKey) return;

    // 2. Collect visible transparent scene items in matching (groupOrder=0, candidateOrders)
    // in Three.js's exact sort order.
    const items: TransparentItem[] = [];
    const visit = (object: THREE.Object3D, groupOrder: number) => {
      if (
        !object.visible ||
        this.batchMeshes.has(object) ||
        this.opaqueStaticSubtrees.has(object) ||
        this.pureBoneSubtrees.has(object)
      )
        return;
      if ((object as THREE.Bone).isBone) {
        if (this.checkPureBoneSubtree(object)) {
          this.pureBoneSubtrees.add(object);
          return;
        }
      } else if (
        (object as THREE.Group).isGroup &&
        !object.matrixWorldAutoUpdate &&
        !this.subtreeHasTransparent(object)
      ) {
        this.opaqueStaticSubtrees.add(object);
        return;
      }
      const nextGroupOrder = (object as THREE.Group).isGroup ? object.renderOrder : groupOrder;
      const asMesh = object as THREE.Mesh;
      const isSprite = (object as THREE.Sprite).isSprite === true;
      const isRenderable =
        isSprite ||
        asMesh.isMesh ||
        (object as THREE.Line).isLine === true ||
        (object as THREE.Points).isPoints === true;
      if (isRenderable && nextGroupOrder === 0 && candidateOrders.has(object.renderOrder)) {
        const materials = Array.isArray(asMesh.material) ? asMesh.material : [asMesh.material];
        let hasVisibleTransparent = false;
        for (let m = 0; m < materials.length; m++) {
          const mat = materials[m];
          if (mat && mat.visible && mat.transparent) {
            hasVisibleTransparent = true;
            break;
          }
        }
        if (hasVisibleTransparent) {
          if (!preclassified.has(object)) object.updateWorldMatrix(true, false);
          if (!object.frustumCulled || this.objectIntersectsFrustum(object)) {
            let z = 0;
            if (isSprite) {
              this.sortPoint
                .setFromMatrixPosition(object.matrixWorld)
                .applyMatrix4(this.projScreenMatrix);
            } else {
              const bounded = object as THREE.Mesh & {
                boundingSphere?: THREE.Sphere | null;
                computeBoundingSphere?: () => void;
              };
              if (bounded.boundingSphere !== undefined) {
                if (bounded.boundingSphere === null) bounded.computeBoundingSphere?.();
                const c = bounded.boundingSphere!.center;
                this.sortPoint.set(c.x, c.y, c.z, 1);
              } else {
                if (asMesh.geometry.boundingSphere === null)
                  asMesh.geometry.computeBoundingSphere();
                const c = asMesh.geometry.boundingSphere!.center;
                this.sortPoint.set(c.x, c.y, c.z, 1);
              }
              this.sortPoint.applyMatrix4(object.matrixWorld).applyMatrix4(this.projScreenMatrix);
            }
            z = this.sortPoint.z;
            const classified = preclassified.has(object)
              ? preclassified.get(object)!
              : materials.length === 1 &&
                  object.parent === this.scene &&
                  object.children.length === 0
                ? this.getClassifiedSurface(asMesh as Surface)
                : null;
            for (let m = 0; m < materials.length; m++) {
              const mat = materials[m];
              if (!mat || !mat.visible || !mat.transparent) continue;
              items.push({
                object,
                material: mat,
                groupOrder: nextGroupOrder,
                renderOrder: object.renderOrder,
                z,
                id: object.id,
                colorPhase: this.isColorPhaseMaterial(mat),
                additive: isPureAdditive(mat),
                surface: classified ? (asMesh as Surface) : null,
                batchKey: classified?.key ?? null,
                family: classified?.family ?? null,
              });
            }
          }
        }
      }
      for (let i = 0; i < object.children.length; i++) visit(object.children[i], nextGroupOrder);
    };
    visit(this.scene, 0);
    if (items.length < 2) return;

    const lists = earlyDistortionActive
      ? [items.filter((x) => !x.colorPhase), items.filter((x) => x.colorPhase)]
      : [items];

    const poolUsage = new Map<string, number>();
    for (const list of lists) {
      if (list.length < 2) continue;
      list.sort(
        (a, b) =>
          a.groupOrder - b.groupOrder || a.renderOrder - b.renderOrder || b.z - a.z || a.id - b.id
      );
      this.emitBatchesForList(list, poolUsage);
    }
  }

  restore(): void {
    for (let i = 0; i < this.hiddenMeshes.length; i++) this.hiddenMeshes[i].visible = true;
    this.hiddenMeshes.length = 0;
    for (let i = 0; i < this.activeBatches.length; i++) {
      const batch = this.activeBatches[i];
      batch.mesh.visible = false;
      batch.mesh.geometry.instanceCount = 0;
    }
    this.activeBatches.length = 0;
  }

  dispose(): void {
    this.restore();
    for (const list of this.pools.values()) {
      for (const batch of list) {
        batch.mesh.removeFromParent();
        for (const slot of batch.slots) slot.geometry.dispose();
        batch.mesh.material.dispose();
        this.batchMeshes.delete(batch.mesh);
      }
    }
    this.pools.clear();
  }

  private checkPureBoneSubtree(root: THREE.Object3D): boolean {
    for (let i = 0; i < root.children.length; i++) {
      const c = root.children[i];
      if (!(c as THREE.Bone).isBone || !this.checkPureBoneSubtree(c)) return false;
    }
    return true;
  }

  private subtreeHasTransparent(root: THREE.Object3D): boolean {
    let found = false;
    root.traverse((node) => {
      if (found) return;
      const mat = (node as THREE.Mesh).material;
      if (!mat) return;
      const list = Array.isArray(mat) ? mat : [mat];
      if (list.some((m) => m?.transparent)) found = true;
    });
    return found;
  }

  private getClassifiedSurface(mesh: Surface): { family: SurfaceFamily; key: string } | null {
    let cached = this.surfaceCache.get(mesh);
    if (cached === undefined) {
      const raw = this.classifySurface(mesh);
      cached = raw
        ? {
            family: raw.family,
            baseKey: raw.key,
            hasSoftDepth: !!mesh.material.defines?.SOURCE_SOFT,
          }
        : null;
      this.surfaceCache.set(mesh, cached);
    }
    if (!cached) return null;
    if (!cached.hasSoftDepth) return { family: cached.family, key: cached.baseKey };
    const u = mesh.material.uniforms;
    return {
      family: cached.family,
      key: `${cached.baseKey}|${texId(u.softDepth)}`,
    };
  }

  private objectIntersectsFrustum(object: THREE.Object3D): boolean {
    const anyObj = object as THREE.Mesh & { intersectsFrustum?: (f: THREE.Frustum) => boolean };
    if (typeof anyObj.intersectsFrustum === 'function')
      return anyObj.intersectsFrustum(this.frustum);
    return true;
  }

  private isColorPhaseMaterial(material: THREE.Material): boolean {
    return (
      material.name.startsWith('Leona Eclipse source ') ||
      material.name === 'Leona Eclipse skin' ||
      material.name === 'Particle skin mult' ||
      material.name === 'Particle decal' ||
      material.name === 'Particle mesh reflection' ||
      material.name.endsWith(' instances')
    );
  }

  private classifySurface(mesh: Surface): { family: SurfaceFamily; key: string } | null {
    if (
      !mesh.isMesh ||
      mesh.castShadow ||
      mesh.userData.ownedGeometry ||
      (mesh as unknown as THREE.InstancedMesh).isInstancedMesh
    )
      return null;
    const mat = mesh.material;
    if (
      !(mat instanceof THREE.ShaderMaterial) ||
      !mat.transparent ||
      mat.depthWrite ||
      !mat.forceSinglePass
    )
      return null;
    const geom = mesh.geometry;
    const pos = geom.getAttribute('position') as THREE.BufferAttribute | undefined;
    const uv = geom.getAttribute('uv') as THREE.BufferAttribute | undefined;
    if (
      !pos ||
      !uv ||
      pos.itemSize !== 3 ||
      uv.itemSize !== 2 ||
      pos.usage !== THREE.StaticDrawUsage ||
      uv.usage !== THREE.StaticDrawUsage ||
      geom.getAttribute('_source_vertex_bgra') ||
      geom.getAttribute('particleTint') ||
      geom.getAttribute('particleLookupUv') ||
      Object.keys(geom.morphAttributes).length > 0
    )
      return null;

    const u = mat.uniforms;
    const raster = `${mesh.renderOrder}|${mat.blending}|${mat.blendEquation}|${mat.blendEquationAlpha ?? ''}|${mat.blendSrc}|${mat.blendDst}|${mat.blendSrcAlpha ?? ''}|${mat.blendDstAlpha ?? ''}|${mat.depthTest ? 1 : 0}|${mat.side}|${mat.polygonOffset ? `${mat.polygonOffsetFactor},${mat.polygonOffsetUnits}` : '0'}|${mat.toneMapped ? 1 : 0}`;

    if (
      mat.name === 'Leona Eclipse source quad surface' ||
      mat.name === 'Leona Eclipse source mesh surface'
    ) {
      const d = mat.defines ?? {};
      if (d.SOURCE_VERTEX_BGRA) return null;
      if (Object.keys(d).some((k) => !(ECLIPSE_DEFINES as readonly string[]).includes(k)))
        return null;
      if (
        !u.sourceTexture ||
        !u.particleColorTexture ||
        !u.particleColor ||
        !u.lookupUv ||
        !u.sourceUvTransform ||
        !u.multiplierUvTransform ||
        !u.alphaRef
      )
        return null;
      const defMask = ECLIPSE_DEFINES.map((k) => (d[k] ? '1' : '0')).join('');
      const erosionStatic = d.SOURCE_EROSION
        ? `${texId(u.erosionTexture)}:${vecKey(u.erosionMixer)}:${u.erosionParameters.value.y},${u.erosionParameters.value.z},${u.erosionParameters.value.w}`
        : '';
      const paletteStatic = d.SOURCE_PALETTE
        ? `${texId(u.paletteTexture)}:${vecKey(u.paletteSourceMix)}:${vecKey(u.paletteRow)}:${vecKey(u.paletteScroll)}`
        : '';
      const softStatic = d.SOURCE_SOFT
        ? `${vecKey(u.softParameters)}:${vecKey(u.softControl)}`
        : '';
      return {
        family: 'eclipse-surface',
        key: `E|${geom.uuid}|${raster}|${defMask}|${texId(u.sourceTexture)}|${texId(u.particleColorTexture)}|${u.alphaRef.value}|${texId(u.multiplierTexture)}|${texId(u.remapTexture)}|${erosionStatic}|${paletteStatic}|${softStatic}`,
      };
    }

    if (
      u.sourceTexture &&
      u.particleColorTexture &&
      u.particleColor &&
      u.lookupUv &&
      u.sourceUvOffset &&
      !mat.defines?.VERTEX_TINT &&
      !mat.defines?.VERTEX_LOOKUP
    ) {
      if (Object.keys(u).some((k) => !COLOR_PRODUCT_UNIFORMS.has(k))) return null;
      if (
        !mat.vertexShader.includes(
          'gl_Position = projectionMatrix * modelViewMatrix * localPosition;'
        ) ||
        !mat.fragmentShader.includes('uniform vec4 particleColor;')
      )
        return null;
      const paletteStatic = mat.defines?.PALETTIZE_TEXTURES
        ? `${texId(u.paletteTexture)}:${vecKey(u.paletteSourceMix)}:${vecKey(u.paletteRow)}:${vecKey(u.paletteScroll)}`
        : '';
      return {
        family: 'color-product',
        key: `C|${geom.uuid}|${raster}|${texId(u.sourceTexture)}|${texId(u.particleColorTexture)}|${texId(u.multiplierTexture)}|${paletteStatic}|${mat.vertexShader}|${mat.fragmentShader}`,
      };
    }

    return null;
  }

  private emitBatchesForList(list: TransparentItem[], poolUsage: Map<string, number>): void {
    let i = 0;
    while (i < list.length) {
      const first = list[i];
      if (first.additive) {
        let end = i + 1;
        while (
          end < list.length &&
          list[end].additive &&
          list[end].groupOrder === first.groupOrder &&
          list[end].renderOrder === first.renderOrder
        )
          end++;
        const prevBarrier =
          i > 0 &&
          list[i - 1].groupOrder === first.groupOrder &&
          list[i - 1].renderOrder === first.renderOrder
            ? list[i - 1]
            : null;
        const nextBarrier =
          end < list.length &&
          list[end].groupOrder === first.groupOrder &&
          list[end].renderOrder === first.renderOrder
            ? list[end]
            : null;
        const byKey = new Map<string, TransparentItem[]>();
        for (let k = i; k < end; k++) {
          const item = list[k];
          if (!item.batchKey || !item.surface) continue;
          let group = byKey.get(item.batchKey);
          if (!group) byKey.set(item.batchKey, (group = []));
          group.push(item);
        }
        for (const [key, group] of byKey) {
          if (group.length < 2) continue;
          const anchorZ = group[0].z;
          if (
            (prevBarrier && prevBarrier.z === anchorZ) ||
            (nextBarrier && nextBarrier.z === anchorZ)
          )
            continue;
          this.commitBatch(key, group[0].family!, group, poolUsage);
        }
        i = end;
      } else {
        if (!first.batchKey || !first.surface) {
          i++;
          continue;
        }
        let end = i + 1;
        while (
          end < list.length &&
          list[end].batchKey === first.batchKey &&
          list[end].groupOrder === first.groupOrder &&
          list[end].renderOrder === first.renderOrder
        )
          end++;
        const count = end - i;
        if (count >= 2) {
          const anchorZ = first.z;
          const prevNeighbor =
            i > 0 &&
            list[i - 1].groupOrder === first.groupOrder &&
            list[i - 1].renderOrder === first.renderOrder
              ? list[i - 1]
              : null;
          const nextNeighbor =
            end < list.length &&
            list[end].groupOrder === first.groupOrder &&
            list[end].renderOrder === first.renderOrder
              ? list[end]
              : null;
          if (
            (!prevNeighbor || prevNeighbor.z !== anchorZ) &&
            (!nextNeighbor || nextNeighbor.z !== anchorZ)
          ) {
            this.commitBatch(first.batchKey, first.family!, list.slice(i, end), poolUsage);
          }
        }
        i = end;
      }
    }
  }

  private commitBatch(
    key: string,
    family: SurfaceFamily,
    group: TransparentItem[],
    poolUsage: Map<string, number>
  ): void {
    const used = poolUsage.get(key) ?? 0;
    poolUsage.set(key, used + 1);
    let list = this.pools.get(key);
    if (!list) this.pools.set(key, (list = []));
    const needed = group.length;
    let batch = list[used];
    if (!batch) {
      const capacity = Math.max(64, 2 ** Math.ceil(Math.log2(needed)));
      batch =
        family === 'eclipse-surface'
          ? this.createEclipseBatch(key, group[0].surface!, capacity)
          : this.createColorProductBatch(key, group[0].surface!, capacity);
      list[used] = batch;
    } else if (batch.capacity < needed) {
      const capacity = Math.max(64, 2 ** Math.ceil(Math.log2(needed)));
      this.growBatchGeometry(batch, group[0].surface!, capacity);
    }

    const anchor = group[0].surface!;
    if (!anchor.geometry.boundingSphere) anchor.geometry.computeBoundingSphere();
    this.centerWorld.copy(anchor.geometry.boundingSphere!.center).applyMatrix4(anchor.matrixWorld);
    const slot = batch.slots[this.frameSlot];
    batch.mesh.geometry = slot.geometry;
    batch.mesh.position.copy(this.centerWorld);
    batch.mesh.quaternion.identity();
    batch.mesh.scale.setScalar(1);
    batch.mesh.updateMatrixWorld(true);
    batch.mesh.renderOrder = anchor.renderOrder;
    batch.mesh.visible = true;
    slot.geometry.instanceCount = needed;

    if (family === 'eclipse-surface') {
      this.fillEclipseBatch(batch, slot.interleaved, group);
    } else {
      this.fillColorProductBatch(batch, slot.interleaved, group);
    }

    for (let i = 0; i < needed; i++) {
      const surface = group[i].surface!;
      surface.visible = false;
      this.hiddenMeshes.push(surface);
    }
    this.activeBatches.push(batch);
  }

  private attachEclipseAttributes(
    geometry: THREE.InstancedBufferGeometry,
    capacity: number
  ): THREE.InstancedInterleavedBuffer {
    const stride = 41;
    const interleaved = new THREE.InstancedInterleavedBuffer(
      new Float32Array(capacity * stride),
      stride,
      1
    ).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aInstMV0', new THREE.InterleavedBufferAttribute(interleaved, 4, 0));
    geometry.setAttribute('aInstMV1', new THREE.InterleavedBufferAttribute(interleaved, 4, 4));
    geometry.setAttribute('aInstMV2', new THREE.InterleavedBufferAttribute(interleaved, 4, 8));
    geometry.setAttribute('aInstMV3', new THREE.InterleavedBufferAttribute(interleaved, 4, 12));
    geometry.setAttribute(
      'aInstSourceUv0',
      new THREE.InterleavedBufferAttribute(interleaved, 3, 16)
    );
    geometry.setAttribute(
      'aInstSourceUv1',
      new THREE.InterleavedBufferAttribute(interleaved, 3, 19)
    );
    geometry.setAttribute(
      'aInstSourceUv2',
      new THREE.InterleavedBufferAttribute(interleaved, 3, 22)
    );
    geometry.setAttribute('aInstMultUv0', new THREE.InterleavedBufferAttribute(interleaved, 3, 25));
    geometry.setAttribute('aInstMultUv1', new THREE.InterleavedBufferAttribute(interleaved, 3, 28));
    geometry.setAttribute('aInstMultUv2', new THREE.InterleavedBufferAttribute(interleaved, 3, 31));
    geometry.setAttribute(
      'aInstParticleColor',
      new THREE.InterleavedBufferAttribute(interleaved, 4, 34)
    );
    geometry.setAttribute(
      'aInstLookupErosion',
      new THREE.InterleavedBufferAttribute(interleaved, 3, 38)
    );
    return interleaved;
  }

  private attachColorProductAttributes(
    geometry: THREE.InstancedBufferGeometry,
    capacity: number,
    hasSourceUvScale: boolean,
    hasAtlasOffset: boolean
  ): THREE.InstancedInterleavedBuffer {
    const stride = 24 + (hasSourceUvScale ? 2 : 0) + (hasAtlasOffset ? 2 : 0);
    const interleaved = new THREE.InstancedInterleavedBuffer(
      new Float32Array(capacity * stride),
      stride,
      1
    ).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aInstMV0', new THREE.InterleavedBufferAttribute(interleaved, 4, 0));
    geometry.setAttribute('aInstMV1', new THREE.InterleavedBufferAttribute(interleaved, 4, 4));
    geometry.setAttribute('aInstMV2', new THREE.InterleavedBufferAttribute(interleaved, 4, 8));
    geometry.setAttribute('aInstMV3', new THREE.InterleavedBufferAttribute(interleaved, 4, 12));
    geometry.setAttribute(
      'aInstParticleColor',
      new THREE.InterleavedBufferAttribute(interleaved, 4, 16)
    );
    geometry.setAttribute(
      'aInstLookupUv',
      new THREE.InterleavedBufferAttribute(interleaved, 2, 20)
    );
    geometry.setAttribute(
      'aInstSourceUvOffset',
      new THREE.InterleavedBufferAttribute(interleaved, 2, 22)
    );
    let offset = 24;
    if (hasSourceUvScale) {
      geometry.setAttribute(
        'aInstSourceUvScale',
        new THREE.InterleavedBufferAttribute(interleaved, 2, offset)
      );
      offset += 2;
    }
    if (hasAtlasOffset) {
      geometry.setAttribute(
        'aInstAtlasOffset',
        new THREE.InterleavedBufferAttribute(interleaved, 2, offset)
      );
    }
    return interleaved;
  }

  private createSlots(
    reference: Surface,
    capacity: number,
    family: SurfaceFamily,
    hasSourceUvScale: boolean,
    hasAtlasOffset: boolean
  ): [BatchSlot, BatchSlot, BatchSlot] {
    const pos = reference.geometry.getAttribute('position').clone();
    const uv = reference.geometry.getAttribute('uv').clone();
    const idx = reference.geometry.index ? reference.geometry.index.clone() : null;
    const makeSlot = (): BatchSlot => {
      const geometry = new THREE.InstancedBufferGeometry();
      geometry.setAttribute('position', pos);
      geometry.setAttribute('uv', uv);
      if (idx) geometry.setIndex(idx);
      geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 0);
      const interleaved =
        family === 'eclipse-surface'
          ? this.attachEclipseAttributes(geometry, capacity)
          : this.attachColorProductAttributes(geometry, capacity, hasSourceUvScale, hasAtlasOffset);
      return { geometry, interleaved };
    };
    return [makeSlot(), makeSlot(), makeSlot()];
  }

  private growBatchGeometry(batch: Batch, reference: Surface, capacity: number): void {
    const nextSlots = this.createSlots(
      reference,
      capacity,
      batch.family,
      batch.hasSourceUvScale,
      batch.hasAtlasOffset
    );
    for (const old of batch.slots) old.geometry.dispose();
    batch.slots = nextSlots;
    batch.mesh.geometry = nextSlots[this.frameSlot].geometry;
    batch.capacity = capacity;
  }

  private createEclipseBatch(key: string, reference: Surface, capacity: number): Batch {
    const src = reference.material;
    const slots = this.createSlots(reference, capacity, 'eclipse-surface', false, false);

    const material = new THREE.ShaderMaterial();
    THREE.Material.prototype.copy.call(material, src);
    material.name = `${src.name} instances`;
    material.defines = { ...(src.defines ?? {}) };
    const u = src.uniforms;
    material.uniforms = {
      sourceTexture: { value: u.sourceTexture.value },
      particleColorTexture: { value: u.particleColorTexture.value },
      alphaRef: { value: u.alphaRef.value },
      ...(u.multiplierTexture ? { multiplierTexture: { value: u.multiplierTexture.value } } : {}),
      ...(u.remapTexture ? { remapTexture: { value: u.remapTexture.value } } : {}),
      ...(u.erosionTexture
        ? {
            erosionTexture: { value: u.erosionTexture.value },
            erosionMixer: { value: u.erosionMixer.value.clone() },
            erosionParameters: { value: u.erosionParameters.value.clone() },
          }
        : {}),
      ...(u.paletteTexture
        ? {
            paletteTexture: { value: u.paletteTexture.value },
            paletteSourceMix: { value: u.paletteSourceMix.value.clone() },
            paletteRow: { value: u.paletteRow.value },
            paletteScroll: { value: u.paletteScroll.value.clone() },
          }
        : {}),
      ...(u.softDepth
        ? {
            softDepth: { value: u.softDepth.value },
            softSize: { value: u.softSize.value.clone() },
            depthConversion: { value: u.depthConversion.value.clone() },
            softParameters: { value: u.softParameters.value.clone() },
            softControl: { value: u.softControl.value.clone() },
          }
        : {}),
    };
    material.vertexShader = `
      attribute vec4 aInstMV0;
      attribute vec4 aInstMV1;
      attribute vec4 aInstMV2;
      attribute vec4 aInstMV3;
      attribute vec3 aInstSourceUv0;
      attribute vec3 aInstSourceUv1;
      attribute vec3 aInstSourceUv2;
      attribute vec3 aInstMultUv0;
      attribute vec3 aInstMultUv1;
      attribute vec3 aInstMultUv2;
      attribute vec4 aInstParticleColor;
      attribute vec3 aInstLookupErosion;
      flat varying vec4 vInstParticleColor;
      flat varying vec3 vInstLookupErosion;
      varying vec2 sourceUv;
      varying vec2 alphaUv;
      varying vec2 multUv;
      varying vec4 sourceVertexColor;
      void main() {
        mat3 instSourceUv = mat3(aInstSourceUv0, aInstSourceUv1, aInstSourceUv2);
        mat3 instMultUv = mat3(aInstMultUv0, aInstMultUv1, aInstMultUv2);
        mat4 instMV = mat4(aInstMV0, aInstMV1, aInstMV2, aInstMV3);
        vInstParticleColor = aInstParticleColor;
        vInstLookupErosion = aInstLookupErosion;
        sourceUv = (instSourceUv * vec3(uv, 1.0)).xy;
        alphaUv = (instSourceUv * vec3(uv, 0.0)).xy;
        multUv = (instMultUv * vec3(uv, 1.0)).xy;
        sourceVertexColor = vec4(1.0);
        gl_Position = projectionMatrix * instMV * vec4(position, 1.0);
      }
    `;
    material.fragmentShader = src.fragmentShader
      .replace('uniform vec4 particleColor;', 'flat varying vec4 vInstParticleColor;')
      .replace('uniform vec2 lookupUv;', 'flat varying vec3 vInstLookupErosion;')
      .replace(/\bparticleColor\b/g, 'vInstParticleColor')
      .replace(/\blookupUv\b/g, 'vInstLookupErosion.xy')
      .replace(/\berosionParameters\.x\b/g, 'vInstLookupErosion.z');
    particleColorMaterial(material);

    const mesh = new THREE.Mesh(slots[0].geometry, material);
    mesh.name = `${reference.name} instances`;
    mesh.frustumCulled = false;
    mesh.visible = false;
    this.scene.add(mesh);
    this.batchMeshes.add(mesh);
    return {
      key,
      family: 'eclipse-surface',
      mesh,
      slots,
      capacity,
      hasSourceUvScale: false,
      hasAtlasOffset: false,
    };
  }

  private fillEclipseBatch(
    batch: Batch,
    interleaved: THREE.InstancedInterleavedBuffer,
    group: TransparentItem[]
  ): void {
    const buf = interleaved.array as Float32Array;
    const firstUniforms = group[0].surface!.material.uniforms;
    if (firstUniforms.softDepth && batch.mesh.material.uniforms.softDepth) {
      batch.mesh.material.uniforms.softDepth.value = firstUniforms.softDepth.value;
      batch.mesh.material.uniforms.softSize.value.copy(firstUniforms.softSize.value);
      batch.mesh.material.uniforms.depthConversion.value.copy(firstUniforms.depthConversion.value);
    }

    for (let i = 0; i < group.length; i++) {
      const s = group[i].surface!;
      const u = s.material.uniforms;
      this.modelView.multiplyMatrices(this.cameraInverse, s.matrixWorld);
      const m = this.modelView.elements;
      const base = i * 41;
      buf[base] = m[0];
      buf[base + 1] = m[1];
      buf[base + 2] = m[2];
      buf[base + 3] = m[3];
      buf[base + 4] = m[4];
      buf[base + 5] = m[5];
      buf[base + 6] = m[6];
      buf[base + 7] = m[7];
      buf[base + 8] = m[8];
      buf[base + 9] = m[9];
      buf[base + 10] = m[10];
      buf[base + 11] = m[11];
      buf[base + 12] = m[12];
      buf[base + 13] = m[13];
      buf[base + 14] = m[14];
      buf[base + 15] = m[15];

      const se = (u.sourceUvTransform.value as THREE.Matrix3).elements;
      buf[base + 16] = se[0];
      buf[base + 17] = se[1];
      buf[base + 18] = se[2];
      buf[base + 19] = se[3];
      buf[base + 20] = se[4];
      buf[base + 21] = se[5];
      buf[base + 22] = se[6];
      buf[base + 23] = se[7];
      buf[base + 24] = se[8];

      const me = (u.multiplierUvTransform.value as THREE.Matrix3).elements;
      buf[base + 25] = me[0];
      buf[base + 26] = me[1];
      buf[base + 27] = me[2];
      buf[base + 28] = me[3];
      buf[base + 29] = me[4];
      buf[base + 30] = me[5];
      buf[base + 31] = me[6];
      buf[base + 32] = me[7];
      buf[base + 33] = me[8];

      const c = u.particleColor.value as THREE.Vector4;
      buf[base + 34] = c.x;
      buf[base + 35] = c.y;
      buf[base + 36] = c.z;
      buf[base + 37] = c.w;

      const l = u.lookupUv.value as THREE.Vector2;
      buf[base + 38] = l.x;
      buf[base + 39] = l.y;
      buf[base + 40] = u.erosionParameters ? (u.erosionParameters.value as THREE.Vector4).x : 0;
    }

    interleaved.clearUpdateRanges();
    interleaved.addUpdateRange(0, group.length * 41);
    interleaved.needsUpdate = true;
  }

  private createColorProductBatch(key: string, reference: Surface, capacity: number): Batch {
    const src = reference.material;
    const u = src.uniforms;
    const hasSourceUvScale = !!u.sourceUvScale;
    const hasAtlasOffset = !!u.atlasOffset;
    const slots = this.createSlots(
      reference,
      capacity,
      'color-product',
      hasSourceUvScale,
      hasAtlasOffset
    );

    const material = new THREE.ShaderMaterial();
    THREE.Material.prototype.copy.call(material, src);
    material.name = `${src.name} instances`;
    material.defines = { ...(src.defines ?? {}) };
    material.uniforms = {
      sourceTexture: { value: u.sourceTexture.value },
      particleColorTexture: { value: u.particleColorTexture.value },
      ...(u.multiplierTexture ? { multiplierTexture: { value: u.multiplierTexture.value } } : {}),
      ...(u.paletteTexture
        ? {
            paletteTexture: { value: u.paletteTexture.value },
            paletteSourceMix: { value: u.paletteSourceMix.value.clone() },
            paletteRow: { value: u.paletteRow.value },
            paletteScroll: { value: u.paletteScroll.value.clone() },
          }
        : {}),
    };

    let vs =
      `attribute vec4 aInstMV0;\nattribute vec4 aInstMV1;\nattribute vec4 aInstMV2;\nattribute vec4 aInstMV3;\nattribute vec4 aInstParticleColor;\nflat varying vec4 vInstParticleColor;\n` +
      src.vertexShader
        .replace('uniform vec2 lookupUv;', 'attribute vec2 aInstLookupUv;')
        .replace('uniform vec2 sourceUvOffset;', 'attribute vec2 aInstSourceUvOffset;');
    if (hasSourceUvScale)
      vs = vs.replace('uniform vec2 sourceUvScale;', 'attribute vec2 aInstSourceUvScale;');
    if (hasAtlasOffset)
      vs = vs.replace('uniform vec2 atlasOffset;', 'attribute vec2 aInstAtlasOffset;');
    vs = vs
      .replace(/\blookupUv\b/g, 'aInstLookupUv')
      .replace(/\bsourceUvOffset\b/g, 'aInstSourceUvOffset');
    if (hasSourceUvScale) vs = vs.replace(/\bsourceUvScale\b/g, 'aInstSourceUvScale');
    if (hasAtlasOffset) vs = vs.replace(/\batlasOffset\b/g, 'aInstAtlasOffset');
    vs = vs.replace(
      'gl_Position = projectionMatrix * modelViewMatrix * localPosition;',
      'vInstParticleColor = aInstParticleColor;\nmat4 instMV = mat4(aInstMV0, aInstMV1, aInstMV2, aInstMV3);\ngl_Position = projectionMatrix * instMV * localPosition;'
    );
    material.vertexShader = vs;
    material.fragmentShader = src.fragmentShader
      .replace('uniform vec4 particleColor;', 'flat varying vec4 vInstParticleColor;')
      .replace(/\bparticleColor\b/g, 'vInstParticleColor');

    const mesh = new THREE.Mesh(slots[0].geometry, material);
    mesh.name = `${reference.name} instances`;
    mesh.frustumCulled = false;
    mesh.visible = false;
    this.scene.add(mesh);
    this.batchMeshes.add(mesh);
    return {
      key,
      family: 'color-product',
      mesh,
      slots,
      capacity,
      hasSourceUvScale,
      hasAtlasOffset,
    };
  }

  private fillColorProductBatch(
    batch: Batch,
    interleaved: THREE.InstancedInterleavedBuffer,
    group: TransparentItem[]
  ): void {
    const buf = interleaved.array as Float32Array;
    const stride = interleaved.stride;

    for (let i = 0; i < group.length; i++) {
      const s = group[i].surface!;
      const u = s.material.uniforms;
      this.modelView.multiplyMatrices(this.cameraInverse, s.matrixWorld);
      const m = this.modelView.elements;
      const base = i * stride;
      buf[base] = m[0];
      buf[base + 1] = m[1];
      buf[base + 2] = m[2];
      buf[base + 3] = m[3];
      buf[base + 4] = m[4];
      buf[base + 5] = m[5];
      buf[base + 6] = m[6];
      buf[base + 7] = m[7];
      buf[base + 8] = m[8];
      buf[base + 9] = m[9];
      buf[base + 10] = m[10];
      buf[base + 11] = m[11];
      buf[base + 12] = m[12];
      buf[base + 13] = m[13];
      buf[base + 14] = m[14];
      buf[base + 15] = m[15];

      const c = u.particleColor.value as THREE.Vector4;
      buf[base + 16] = c.x;
      buf[base + 17] = c.y;
      buf[base + 18] = c.z;
      buf[base + 19] = c.w;

      const l = u.lookupUv.value as THREE.Vector2;
      buf[base + 20] = l.x;
      buf[base + 21] = l.y;

      const so = u.sourceUvOffset.value as THREE.Vector2;
      buf[base + 22] = so.x;
      buf[base + 23] = so.y;

      let offset = 24;
      if (batch.hasSourceUvScale) {
        const sv = u.sourceUvScale.value as THREE.Vector2;
        buf[base + offset] = sv.x;
        buf[base + offset + 1] = sv.y;
        offset += 2;
      }
      if (batch.hasAtlasOffset) {
        const av = u.atlasOffset.value as THREE.Vector2;
        buf[base + offset] = av.x;
        buf[base + offset + 1] = av.y;
      }
    }

    interleaved.clearUpdateRanges();
    interleaved.addUpdateRange(0, group.length * stride);
    interleaved.needsUpdate = true;
  }
}
