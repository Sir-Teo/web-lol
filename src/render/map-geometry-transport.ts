import type { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

interface GeometryTransport {
  source: { uri: string; bytes: number; sha256: string };
  gzip: { uri: string; bytes: number; sha256: string };
}
/** Keep the canonical glTF external buffer unchanged, substituting a byte-identical
 * compressed transport through GLTFLoader's buffer-view plugin interface. */
export async function installMapGeometryTransport(loader: GLTFLoader, base: string): Promise<void> {
  const response = await fetch(`${base}rift-geometry-gzip.json`);
  if (!response.ok) throw new Error('Map geometry transport manifest could not be loaded');
  const manifest = (await response.json()) as GeometryTransport;
  if (
    manifest.source.uri !== 'rift-geometry.bin' ||
    manifest.gzip.uri !== 'rift-geometry.bin.gz' ||
    !Number.isSafeInteger(manifest.source.bytes) ||
    manifest.source.bytes <= 0 ||
    !/^[0-9a-f]{64}$/.test(manifest.source.sha256)
  )
    throw new Error('Invalid map geometry transport manifest');
  let decoded: Promise<ArrayBuffer> | undefined;
  const load = () =>
    (decoded ??= (async () => {
      const response = await fetch(base + manifest.gzip.uri);
      if (!response.ok) throw new Error('Compressed map geometry could not be loaded');
      let bytes = await response.arrayBuffer();
      // Static hosts may serve either the gzip wrapper or already decoded bytes.
      const magic = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
      if (magic[0] === 0x1f && magic[1] === 0x8b)
        bytes = await new Response(
          new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
        ).arrayBuffer();
      if (bytes.byteLength !== manifest.source.bytes)
        throw new Error('Map geometry length mismatch');
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hash = Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, '0')).join(
        ''
      );
      if (hash !== manifest.source.sha256) throw new Error('Map geometry hash mismatch');
      return bytes;
    })());
  loader.register((parser) => ({
    name: 'LOCAL_lossless_map_geometry',
    loadBufferView(index) {
      const view = parser.json.bufferViews[index];
      const buffer = parser.json.buffers[view.buffer];
      if (buffer.uri !== manifest.source.uri) return null;
      if (buffer.byteLength !== manifest.source.bytes)
        throw new Error('glTF geometry length mismatch');
      const offset = view.byteOffset ?? 0,
        length = view.byteLength;
      if (
        !Number.isSafeInteger(offset) ||
        !Number.isSafeInteger(length) ||
        offset < 0 ||
        length < 0 ||
        offset + length > buffer.byteLength
      )
        throw new Error('Invalid map geometry buffer view');
      return load().then((bytes) => bytes.slice(offset, offset + length));
    },
  }));
}
