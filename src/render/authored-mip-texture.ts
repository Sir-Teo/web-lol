import * as THREE from 'three';

export interface AuthoredMipAsset {
  url: string;
  bytes: number;
  sha256: string;
  width: number;
  height: number;
  rectangles: { level: number; x: number; y: number; width: number; height: number }[];
}
export async function checkedAssetBytes(
  url: string,
  bytes: number,
  sha256: string
): Promise<ArrayBuffer> {
  const response = await fetch(import.meta.env.BASE_URL + url);
  if (!response.ok) throw Error(`Source asset fetch failed: ${url}`);
  const raw = await response.arrayBuffer();
  if (raw.byteLength !== bytes) throw Error(`Source asset extent differs: ${url}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', raw));
  if (Array.from(digest, (v) => v.toString(16).padStart(2, '0')).join('') !== sha256)
    throw Error(`Source asset checksum differs: ${url}`);
  return raw;
}

/** A PNG transport is never sampled as an atlas. Extract all authored levels,
 * including zero, without Canvas premultiplication or generated/resized mips. */
export async function loadAuthoredMipTexture(asset: AuthoredMipAsset, lookup: boolean) {
  const rectangles = asset.rectangles,
    base = rectangles[0];
  let y = 0;
  if (
    !base ||
    (rectangles.length !== 1 &&
      rectangles.length !== Math.floor(Math.log2(Math.max(base.width, base.height))) + 1)
  )
    throw Error('Incomplete authored mip chain');
  for (let i = 0; i < rectangles.length; i++) {
    const r = rectangles[i];
    if (
      ![r.level, r.x, r.y, r.width, r.height].every(Number.isSafeInteger) ||
      r.level !== i ||
      r.x !== 0 ||
      r.y !== y ||
      r.width !== Math.max(1, base.width >> i) ||
      r.height !== Math.max(1, base.height >> i) ||
      r.width > asset.width ||
      r.y + r.height > asset.height
    )
      throw Error('Invalid authored mip rectangle');
    y += r.height;
  }
  if (asset.width !== base.width || y !== asset.height)
    throw Error('Invalid authored mip container');
  const raw = await checkedAssetBytes(asset.url, asset.bytes, asset.sha256),
    blob = new Blob([raw], { type: 'image/png' });
  const outcomes = await Promise.allSettled(
    rectangles.map(async (r) => {
      const image = await createImageBitmap(blob, r.x, r.y, r.width, r.height, {
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'none',
        imageOrientation: 'none',
      });
      if (image.width !== r.width || image.height !== r.height) {
        image.close();
        throw Error('Browser resized an authored mip');
      }
      return image;
    })
  );
  const images = outcomes.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const failed = outcomes.find((r) => r.status === 'rejected');
  if (failed?.status === 'rejected') {
    images.forEach((image) => image.close());
    throw failed.reason;
  }
  const texture = new THREE.Texture(images[0]);
  texture.name = asset.url;
  // Three r186 uploads each manual image with texSubImage2D; installed r183
  // declarations still omit ImageBitmap from the regular Texture mip union.
  texture.mipmaps = images as unknown as THREE.Texture['mipmaps'];
  texture.colorSpace = THREE.NoColorSpace;
  texture.flipY = false;
  texture.premultiplyAlpha = false;
  texture.generateMipmaps = false;
  texture.minFilter =
    lookup || images.length === 1 ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = lookup ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  texture.needsUpdate = true;
  let disposed = false;
  return {
    texture,
    dispose() {
      if (disposed) return;
      disposed = true;
      texture.dispose();
      images.forEach((image) => image.close());
    },
  };
}
