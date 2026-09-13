import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DDSLoader } from 'three/addons/loaders/DDSLoader.js';

interface DxtRecord {
  uri: string;
  width: number;
  height: number;
  mipLevels: number;
  gpuBytes: number;
}

/** Original BC blocks on compatible GPUs; verified full-resolution WebP otherwise. */
export async function loadRift(
  renderer: THREE.WebGLRenderer,
  forceWebP = false
): Promise<THREE.Group> {
  const base = 'assets/maps/';
  const response = await fetch(`${base}rift-dxt.json`);
  if (!response.ok) throw new Error('Map texture manifest could not be loaded');
  const records = (await response.json()) as Record<string, DxtRecord>;
  const native =
    !forceWebP &&
    renderer.extensions.has('WEBGL_compressed_texture_s3tc') &&
    renderer.extensions.has('WEBGL_compressed_texture_s3tc_srgb');
  const cache = new Map<string, Promise<THREE.CompressedTexture>>();
  const dds = new DDSLoader();
  async function compressed(name: string): Promise<THREE.CompressedTexture> {
    let pending = cache.get(name);
    if (!pending) {
      pending = (async () => {
        const record = records[name];
        if (!record) throw new Error(`Missing map texture: ${name}`);
        const response = await fetch(base + record.uri);
        if (!response.ok) throw new Error(`Failed map texture: ${name}`);
        // Static hosts differ: some send Content-Encoding:gzip (the browser
        // decompresses it), others serve the wrapper as an opaque binary file.
        let data = await response.arrayBuffer();
        if (new Uint8Array(data)[0] === 0x1f && new Uint8Array(data)[1] === 0x8b) {
          data = await new Response(
            new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'))
          ).arrayBuffer();
        }
        if (data.byteLength < 128 || new DataView(data).getUint32(0, true) !== 0x20534444)
          throw new Error(`Invalid DDS header: ${name}`);
        const parsed = dds.parse(data, true);
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
        const texture = new THREE.CompressedTexture(
          parsed.mipmaps,
          parsed.width,
          parsed.height,
          format
        );
        texture.name = name;
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = false;
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        texture.needsUpdate = true;
        return texture;
      })();
      cache.set(name, pending);
    }
    return pending;
  }
  const loader = new GLTFLoader();
  if (native)
    loader.register((parser) => ({
      // Replace the built-in WebP extension handler only for this source map.
      name: 'EXT_texture_webp',
      loadTexture: async (index: number) => {
        const textureDef = parser.json.textures[index];
        const sourceIndex = textureDef.extensions?.EXT_texture_webp?.source ?? textureDef.source;
        const texture = await compressed(parser.json.images[sourceIndex].name);
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
  const gltf = await loader.loadAsync(`${base}rift.gltf`);
  const grassTint = native
    ? await compressed('grasstint_srx')
    : await new THREE.TextureLoader().loadAsync(`${base}textures/grasstint_srx.webp`);
  grassTint.flipY = false;
  grassTint.colorSpace = THREE.SRGBColorSpace;
  grassTint.wrapS = grassTint.wrapT = THREE.ClampToEdgeWrapping;
  gltf.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const basic = material as THREE.MeshBasicMaterial;
      if (basic.map) basic.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
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
  });
  gltf.scene.userData.textureEncoding = native ? 'original-dxt' : 'lossless-webp';
  gltf.scene.userData.textureGpuBytes = native
    ? Object.values(records).reduce((sum, item) => sum + item.gpuBytes, 0)
    : null;
  return gltf.scene;
}
