import initialVisibility from '../content/rift-initial-visibility.json';
import { setStableMaterialOrder, setStableObjectOrder } from './stable-opaque-order';
import { MapTexturePrefetch } from './map-texture-prefetch';
import { MapTextureResidency } from './map-texture-residency';
import { installMapGeometryTransport } from './map-geometry-transport';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DDSLoader } from 'three/addons/loaders/DDSLoader.js';
import { gunzipSync } from 'three/addons/libs/fflate.module.js';

interface DxtRecord {
  uri: string;
  width: number;
  height: number;
  mipLevels: number;
  format?: 'DXT1' | 'DXT5';
  gpuBytes: number;
}

export interface LoadRiftOptions {
  /** Max bytes of compressed `.dds.gz` bytes retained synchronously in V8 heap.
   * Defaults to `Infinity` for deterministic synchronous tools/inspectors; gameplay
   * sets a bounded LRU cache backed by off-heap Blobs to stay well under the JS heap budget. */
  cpuTextureCacheBytes?: number;
}

interface DxtBackingEntry {
  readonly name: string;
  readonly record: DxtRecord;
  readonly uri: string;
  blob: Blob | null;
  syncBytes: Uint8Array | null;
  loading: Promise<void> | null;
  placeholder: boolean;
}

const DDS_LOADER = new DDSLoader();
const DUMMY_DXT1_MIP: THREE.CompressedTextureMipmap = {
  data: new Uint8Array(8),
  width: 4,
  height: 4,
};
const DUMMY_DXT5_MIP: THREE.CompressedTextureMipmap = {
  data: new Uint8Array(16),
  width: 4,
  height: 4,
};

function dxtFormat(format: DxtRecord['format']): THREE.CompressedPixelFormat {
  return format === 'DXT5' ? THREE.RGBA_S3TC_DXT5_Format : THREE.RGBA_S3TC_DXT1_Format;
}

function isGzipBytes(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

function isDdsBytes(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 4 &&
    bytes[0] === 0x44 &&
    bytes[1] === 0x44 &&
    bytes[2] === 0x53 &&
    bytes[3] === 0x20
  );
}

function parseDdsBuffer(
  raw: Uint8Array,
  name: string,
  record: DxtRecord
): { mipmaps: THREE.CompressedTextureMipmap[]; format: THREE.CompressedPixelFormat } {
  const inflated = isGzipBytes(raw) ? gunzipSync(raw) : raw;
  if (inflated.byteLength < 128 || !isDdsBytes(inflated))
    throw new Error(`Invalid DDS header: ${name}`);
  const buffer =
    inflated.byteOffset === 0 && inflated.byteLength === inflated.buffer.byteLength
      ? (inflated.buffer as ArrayBuffer)
      : (inflated.buffer.slice(
          inflated.byteOffset,
          inflated.byteOffset + inflated.byteLength
        ) as ArrayBuffer);
  const parsed = DDS_LOADER.parse(buffer, true);
  if (
    parsed.width !== record.width ||
    parsed.height !== record.height ||
    parsed.mipmaps.length !== record.mipLevels
  )
    throw new Error(`Invalid map texture: ${name}`);
  if (
    parsed.format !== THREE.RGB_S3TC_DXT1_Format &&
    parsed.format !== THREE.RGBA_S3TC_DXT5_Format
  )
    throw new Error(`Unsupported map texture format: ${name}`);
  // TEX BC1 includes one-bit alpha. DDSLoader labels DXT1 as RGB, which
  // would turn transparent leaves into opaque black quads on the GPU.
  const format =
    parsed.format === THREE.RGB_S3TC_DXT1_Format
      ? THREE.RGBA_S3TC_DXT1_Format
      : THREE.RGBA_S3TC_DXT5_Format;
  return { mipmaps: parsed.mipmaps, format };
}

/** Keeps uncompressed BC1/BC3 mipmaps out of V8 heap after GPU upload while preserving
 * bit-exact synchronous re-upload on residency eviction and WebGL context recovery. */
class DxtTextureBacking {
  private entries = new Map<THREE.CompressedTexture, DxtBackingEntry>();
  private syncCache = new Map<THREE.CompressedTexture, Uint8Array>();
  private syncBytes = 0;

  constructor(private readonly maxSyncBytes: number) {}

  register(
    texture: THREE.CompressedTexture,
    name: string,
    record: DxtRecord,
    uri: string,
    blob: Blob | null,
    syncBytes: Uint8Array | null
  ): void {
    const entry: DxtBackingEntry = {
      name,
      record,
      uri,
      blob,
      syncBytes: null,
      loading: null,
      placeholder: false,
    };
    this.entries.set(texture, entry);
    if (syncBytes) this.storeSync(texture, entry, syncBytes);
    // Drop uncompressed BC blocks immediately after WebGL uploads them.
    texture.onUpdate = () => {
      texture.mipmaps = [];
    };
  }

  private touchSync(texture: THREE.CompressedTexture, bytes: Uint8Array): void {
    this.syncCache.delete(texture);
    this.syncCache.set(texture, bytes);
  }

  private storeSync(
    texture: THREE.CompressedTexture,
    entry: DxtBackingEntry,
    bytes: Uint8Array
  ): void {
    const prev = this.syncCache.get(texture);
    if (prev) {
      this.syncBytes -= prev.byteLength;
      this.syncCache.delete(texture);
    }
    entry.syncBytes = bytes;
    this.syncCache.set(texture, bytes);
    this.syncBytes += bytes.byteLength;
    if (!Number.isFinite(this.maxSyncBytes)) return;
    for (const [oldTexture, oldBytes] of this.syncCache) {
      if (this.syncBytes <= this.maxSyncBytes || oldTexture === texture) break;
      const oldEntry = this.entries.get(oldTexture);
      if (oldEntry) {
        oldEntry.blob ??= new Blob([oldBytes as Uint8Array<ArrayBuffer>]);
        oldEntry.syncBytes = null;
      }
      this.syncCache.delete(oldTexture);
      this.syncBytes -= oldBytes.byteLength;
    }
  }

  private hydrateAsync(texture: THREE.CompressedTexture, entry: DxtBackingEntry): Promise<void> {
    if (entry.syncBytes) return Promise.resolve();
    if (entry.loading) return entry.loading;
    entry.loading = (async () => {
      let bytes: Uint8Array;
      if (entry.blob) {
        bytes = new Uint8Array(await entry.blob.arrayBuffer());
      } else {
        const response = await fetch(entry.uri);
        if (!response.ok) throw new Error(`Failed map texture: ${entry.name}`);
        bytes = new Uint8Array(await response.arrayBuffer());
      }
      this.storeSync(texture, entry, bytes);
      if (entry.placeholder) {
        // Release temporary 4x4 immutable texStorage2D before re-uploading full mipmaps.
        texture.dispose();
        entry.placeholder = false;
      }
      texture.needsUpdate = true;
    })().finally(() => {
      entry.loading = null;
    });
    return entry.loading;
  }

  /** Synchronously prepares mipmaps when compressed bytes are cached; otherwise kicks off
   * off-heap Blob hydration so prefetch skips the frame or draw binds a 4x4 placeholder. */
  ensureForUpload(
    texture: THREE.Texture,
    residency: MapTextureResidency,
    allowPlaceholder: boolean
  ): boolean {
    const entry = this.entries.get(texture as THREE.CompressedTexture);
    if (!entry) return true;
    const compressed = texture as THREE.CompressedTexture;
    if (residency.isResident(compressed) && !entry.placeholder) {
      if (entry.syncBytes) this.touchSync(compressed, entry.syncBytes);
      return true;
    }
    if (compressed.mipmaps.length > 0 && !entry.placeholder) return true;
    if (entry.syncBytes) {
      this.touchSync(compressed, entry.syncBytes);
      if (entry.placeholder) {
        compressed.dispose();
        entry.placeholder = false;
        compressed.needsUpdate = true;
      }
      const parsed = parseDdsBuffer(entry.syncBytes, entry.name, entry.record);
      compressed.format = parsed.format;
      compressed.mipmaps = parsed.mipmaps;
      return true;
    }
    void this.hydrateAsync(compressed, entry);
    if (allowPlaceholder) {
      if (!entry.placeholder) {
        compressed.mipmaps = [
          entry.record.format === 'DXT5' ? DUMMY_DXT5_MIP : DUMMY_DXT1_MIP,
        ];
        entry.placeholder = true;
      }
    }
    return false;
  }

  async warmTextures(textures: Iterable<THREE.Texture>): Promise<void> {
    const tasks: Promise<void>[] = [];
    for (const texture of textures) {
      const entry = this.entries.get(texture as THREE.CompressedTexture);
      if (entry && !entry.syncBytes) tasks.push(this.hydrateAsync(texture as THREE.CompressedTexture, entry));
    }
    if (tasks.length) await Promise.all(tasks);
  }
}

function textureBytes(texture: THREE.Texture, gpuBytesByTexture: ReadonlyMap<THREE.Texture, number>): number {
  const known = gpuBytesByTexture.get(texture);
  if (known !== undefined) return known;
  const image = texture.image as { width: number; height: number };
  let width = image.width,
    height = image.height,
    bytes = 0;
  do {
    bytes += width * height * 4;
    if (!texture.generateMipmaps || (width === 1 && height === 1)) break;
    width = Math.max(1, Math.floor(width / 2));
    height = Math.max(1, Math.floor(height / 2));
  } while (true);
  return bytes;
}

function attachMeshTextureHooks(
  object: THREE.Mesh,
  residency: MapTextureResidency,
  backing: DxtTextureBacking | null,
  grassTint: THREE.Texture,
  gpuBytesByTexture: ReadonlyMap<THREE.Texture, number>,
  maxAnisotropy: number
): void {
  const previousRender = object.onBeforeRender;
  object.onBeforeRender = function (...args) {
    previousRender.apply(this, args);
    const material = args[4] as THREE.MeshBasicMaterial;
    if (material.map) {
      const ready = !backing || backing.ensureForUpload(material.map, residency, true);
      if (ready) residency.touch(material.map, textureBytes(material.map, gpuBytesByTexture));
    }
    if (material.name.endsWith('/VertexDeform_inst')) {
      const ready = !backing || backing.ensureForUpload(grassTint, residency, true);
      if (ready) residency.touch(grassTint, textureBytes(grassTint, gpuBytesByTexture));
    }
  };
  for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
    const basic = material as THREE.MeshBasicMaterial;
    if (basic.map) basic.map.anisotropy = maxAnisotropy;
    if (material.name.endsWith('/VertexDeform_inst')) {
      // Static tint approximation from the source grass-color map. Motion,
      // see-through behavior and the precise source UV fit remain separate work.
      basic.onBeforeCompile = (shader) => {
        shader.uniforms.riftGrassTint = { value: grassTint };
        shader.vertexShader = `varying vec2 vRiftGrassUV;\n${shader.vertexShader}`.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvec3 riftWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvRiftGrassUV = vec2(riftWorld.x + 74.25, riftWorld.z + 74.25) / 148.5;'
        );
        shader.fragmentShader =
          `uniform sampler2D riftGrassTint;\nvarying vec2 vRiftGrassUV;\n${shader.fragmentShader}`.replace(
            '#include <map_fragment>',
            '#include <map_fragment>\ndiffuseColor.rgb *= texture2D(riftGrassTint, vRiftGrassUV).rgb;'
          );
      };
      basic.customProgramCacheKey = () => 'rift-grass-tint-v1';
    }
  }
}

function attachContextRestored(
  canvas: HTMLCanvasElement,
  residency: MapTextureResidency
): void {
  canvas.addEventListener('webglcontextrestored', () => residency.contextRestored());
}

function createPrepareVisibleTextures(
  scene: THREE.Object3D,
  meshTextures: ReadonlyMap<THREE.Object3D, ReadonlyMap<THREE.Texture, number>>,
  grassTint: THREE.Texture,
  backing: DxtTextureBacking
): (camera: THREE.Camera) => Promise<void> {
  return async (camera: THREE.Camera) => {
    camera.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
      camera.coordinateSystem
    );
    const visible = new Set<THREE.Texture>([grassTint]);
    scene.traverseVisible((object) => {
      const textures = meshTextures.get(object);
      if (!textures || !object.layers.test(camera.layers)) return;
      if (object.frustumCulled && !frustum.intersectsObject(object)) return;
      for (const texture of textures.keys()) visible.add(texture);
    });
    await backing.warmTextures(visible);
  };
}

function createPrefetchPrepare(
  backing: DxtTextureBacking,
  residency: MapTextureResidency
): (texture: THREE.Texture) => boolean {
  return (texture) => backing.ensureForUpload(texture, residency, false);
}

function collectVisibleImageNames(
  json: {
    nodes?: Array<{ name?: string; mesh?: number }>;
    meshes?: Array<{ primitives?: Array<{ material?: number }> }>;
    materials?: Array<{
      pbrMetallicRoughness?: { baseColorTexture?: { index: number } };
    }>;
    textures?: Array<{
      source?: number;
      extensions?: { EXT_texture_webp?: { source?: number } };
    }>;
    images?: Array<{ name?: string }>;
  },
  hiddenNodes: ReadonlySet<string>
): Set<string> {
  const visible = new Set<string>(['grasstint_srx']);
  for (const node of json.nodes ?? []) {
    if (node.name && hiddenNodes.has(node.name)) continue;
    if (node.mesh === undefined) continue;
    const mesh = json.meshes?.[node.mesh];
    for (const primitive of mesh?.primitives ?? []) {
      if (primitive.material === undefined) continue;
      const texIndex = json.materials?.[primitive.material]?.pbrMetallicRoughness?.baseColorTexture?.index;
      if (texIndex === undefined) continue;
      const tex = json.textures?.[texIndex];
      const sourceIndex = tex?.extensions?.EXT_texture_webp?.source ?? tex?.source;
      const imageName = sourceIndex === undefined ? undefined : json.images?.[sourceIndex]?.name;
      if (imageName) visible.add(imageName);
    }
  }
  return visible;
}

/** Original BC blocks on compatible GPUs; verified full-resolution WebP otherwise. */
export async function loadRift(
  renderer: THREE.WebGLRenderer,
  forceWebP = false,
  options: LoadRiftOptions = {}
): Promise<THREE.Group> {
  const base = 'assets/maps/';
  const response = await fetch(`${base}rift-dxt.json`);
  if (!response.ok) throw new Error('Map texture manifest could not be loaded');
  const records = (await response.json()) as Record<string, DxtRecord>;
  const native =
    !forceWebP &&
    renderer.extensions.has('WEBGL_compressed_texture_s3tc') &&
    renderer.extensions.has('WEBGL_compressed_texture_s3tc_srgb');
  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const cpuTextureCacheBytes = options.cpuTextureCacheBytes ?? Infinity;
  const backing = native ? new DxtTextureBacking(cpuTextureCacheBytes) : null;
  const hiddenNodeSet = new Set(initialVisibility.hiddenNodes);
  const cache = new Map<string, Promise<THREE.CompressedTexture>>();
  const gpuBytesByTexture = new Map<THREE.Texture, number>();

  async function compressed(
    name: string,
    eagerLoad: boolean
  ): Promise<THREE.CompressedTexture> {
    let pending = cache.get(name);
    if (!pending) {
      pending = (async () => {
        const record = records[name];
        if (!record) throw new Error(`Missing map texture: ${name}`);
        const uri = base + record.uri;
        let blob: Blob | null = null;
        let syncBytes: Uint8Array | null = null;
        if (eagerLoad) {
          const response = await fetch(uri);
          if (!response.ok) throw new Error(`Failed map texture: ${name}`);
          if (Number.isFinite(cpuTextureCacheBytes)) {
            blob = await response.blob();
            const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
            if (!isGzipBytes(head) && !isDdsBytes(head))
              throw new Error(`Invalid DDS header: ${name}`);
          } else {
            const raw = new Uint8Array(await response.arrayBuffer());
            if (!isGzipBytes(raw) && !isDdsBytes(raw))
              throw new Error(`Invalid DDS header: ${name}`);
            syncBytes = raw;
          }
        }
        const texture = new THREE.CompressedTexture(
          [],
          record.width,
          record.height,
          dxtFormat(record.format)
        );
        texture.name = name;
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = false;
        texture.anisotropy = maxAnisotropy;
        texture.needsUpdate = true;
        backing!.register(texture, name, record, uri, blob, syncBytes);
        gpuBytesByTexture.set(texture, record.gpuBytes);
        return texture;
      })();
      cache.set(name, pending);
    }
    return pending;
  }

  const loader = new GLTFLoader();
  const releaseGeometryTransport = await installMapGeometryTransport(loader, base);
  let visibleImages: Set<string> | null = null;
  if (native)
    loader.register((parser) => ({
      // Replace the built-in WebP extension handler only for this source map.
      name: 'EXT_texture_webp',
      loadTexture: async (index: number) => {
        visibleImages ??= collectVisibleImageNames(parser.json, hiddenNodeSet);
        const textureDef = parser.json.textures[index];
        const sourceIndex = textureDef.extensions?.EXT_texture_webp?.source ?? textureDef.source;
        const imageName = parser.json.images[sourceIndex].name;
        const texture = await compressed(imageName, visibleImages.has(imageName));
        const sampler = parser.json.samplers?.[textureDef.sampler];
        // All authored samplers in this frozen artifact use linear filtering.
        const wrap = (value: number | undefined) =>
          value === 33071
            ? THREE.ClampToEdgeWrapping
            : value === 33648
              ? THREE.MirroredRepeatWrapping
              : THREE.RepeatWrapping;
        texture.wrapS = wrap(sampler?.wrapS);
        texture.wrapT = wrap(sampler?.wrapT);
        parser.associations.set(texture, { textures: index });
        return texture;
      },
    }));

  let gltf;
  try {
    gltf = await loader.loadAsync(`${base}rift.gltf`);
  } finally {
    releaseGeometryTransport();
  }

  const grassTint = native
    ? await compressed('grasstint_srx', true)
    : await new THREE.TextureLoader().loadAsync(`${base}textures/grasstint_srx.webp`);
  grassTint.flipY = false;
  grassTint.colorSpace = THREE.SRGBColorSpace;
  grassTint.wrapS = grassTint.wrapT = THREE.ClampToEdgeWrapping;
  const residency = new MapTextureResidency();
  attachContextRestored(renderer.domElement, residency);
  const scene = gltf.scene;
  scene.userData.textureResidency = residency;
  const meshTextures = new Map<THREE.Object3D, Map<THREE.Texture, number>>();
  const pendingHidden = new Set(initialVisibility.hiddenNodes);
  let sourceObjectIndex = 0;
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    setStableObjectOrder(object, sourceObjectIndex++);
    const sourceNode = gltf.parser.associations.get(object)?.nodes;
    const sourceName =
      sourceNode === undefined ? undefined : gltf.parser.json.nodes[sourceNode].name;
    if (sourceName && pendingHidden.delete(sourceName)) object.visible = false;
    const textures = new Map<THREE.Texture, number>();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const sourceMaterial = gltf.parser.associations.get(material)?.materials;
      if (sourceMaterial === undefined) throw new Error('Map material lacks a source index');
      setStableMaterialOrder(material, sourceMaterial);
      const basic = material as THREE.MeshBasicMaterial;
      if (basic.map) textures.set(basic.map, textureBytes(basic.map, gpuBytesByTexture));
      if (material.name.endsWith('/VertexDeform_inst'))
        textures.set(grassTint, textureBytes(grassTint, gpuBytesByTexture));
    }
    meshTextures.set(object, textures);
    attachMeshTextureHooks(
      object,
      residency,
      backing,
      grassTint,
      gpuBytesByTexture,
      maxAnisotropy
    );
  });
  if (pendingHidden.size)
    throw new Error(`Missing default-hidden map nodes: ${[...pendingHidden]}`);
  scene.userData.texturePrefetch = new MapTexturePrefetch(
    scene,
    residency,
    meshTextures,
    backing ? createPrefetchPrepare(backing, residency) : undefined
  );
  if (backing) {
    scene.userData.prepareVisibleTextures = createPrepareVisibleTextures(
      scene,
      meshTextures,
      grassTint,
      backing
    );
  }
  scene.userData.textureEncoding = native ? 'original-dxt' : 'lossless-webp';
  scene.userData.textureGpuBytes = native
    ? Object.values(records).reduce((sum, item) => sum + item.gpuBytes, 0)
    : null;
  return scene;
}
