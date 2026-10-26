import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import data from '../src/content/masteryi-q-contact-particles.json';
import { loadAuthoredMipTexture } from '../src/render/authored-mip-texture';

const asset = data.textures[0],
  source = readFileSync('public/' + asset.url);
let images: { width: number; height: number; close: ReturnType<typeof vi.fn> }[];
beforeEach(() => {
  images = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(source))
  );
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async (_blob: Blob, _x: number, _y: number, width: number, height: number) => {
      const image = { width, height, close: vi.fn() };
      images.push(image);
      return image;
    })
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('verified transport extracts all authored levels including zero with no color conversion or generated mips', async () => {
  const resource = await loadAuthoredMipTexture(asset, false),
    texture = resource.texture;
  expect(fetch).toHaveBeenCalledWith('/' + asset.url);
  expect(createImageBitmap).toHaveBeenCalledTimes(asset.rectangles.length);
  for (const r of asset.rectangles)
    expect(createImageBitmap).toHaveBeenNthCalledWith(
      r.level + 1,
      expect.any(Blob),
      r.x,
      r.y,
      r.width,
      r.height,
      { premultiplyAlpha: 'none', colorSpaceConversion: 'none', imageOrientation: 'none' }
    );
  expect(texture.image).toBe(images[0]);
  expect(texture.mipmaps).toEqual(images);
  expect(texture.colorSpace).toBe(THREE.NoColorSpace);
  expect(texture.flipY).toBe(false);
  expect(texture.premultiplyAlpha).toBe(false);
  expect(texture.generateMipmaps).toBe(false);
  expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
  expect(texture.magFilter).toBe(THREE.LinearFilter);
  expect(texture.wrapS).toBe(THREE.RepeatWrapping);
  expect(texture.wrapT).toBe(THREE.RepeatWrapping);
  const disposed = vi.fn();
  texture.addEventListener('dispose', disposed);
  resource.dispose();
  resource.dispose();
  expect(disposed).toHaveBeenCalledTimes(1);
  images.forEach((image) => expect(image.close).toHaveBeenCalledTimes(1));
});

test('lookup retains authored levels with the local clamped linear sampler', async () => {
  const resource = await loadAuthoredMipTexture(asset, true);
  expect(resource.texture.mipmaps).toHaveLength(asset.rectangles.length);
  expect(resource.texture.minFilter).toBe(THREE.LinearFilter);
  expect(resource.texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
  expect(resource.texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
  resource.dispose();
});

test.each(['status', 'length', 'checksum'])(
  'rejects %s failure before bitmap allocation',
  async (kind) => {
    let bytes = new Uint8Array(source);
    if (kind === 'length') bytes = bytes.subarray(0, bytes.length - 1);
    if (kind === 'checksum') bytes[bytes.length - 1] ^= 1;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(bytes, { status: kind === 'status' ? 503 : 200 }))
    );
    await expect(loadAuthoredMipTexture(asset, false)).rejects.toThrow();
    expect(createImageBitmap).not.toHaveBeenCalled();
  }
);

test.each(['rejected', 'resized'])(
  'a %s crop closes every successful sibling, including later completions',
  async (kind) => {
    let ordinal = 0;
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async (_blob: Blob, _x: number, _y: number, width: number, height: number) => {
        const index = ordinal++;
        if (index === 2 && kind === 'rejected') throw Error('crop failed');
        await Promise.resolve();
        const image = {
          width: width + (index === 2 && kind === 'resized' ? 1 : 0),
          height,
          close: vi.fn(),
        };
        images.push(image);
        return image;
      })
    );
    await expect(loadAuthoredMipTexture(asset, false)).rejects.toThrow(
      kind === 'rejected' ? 'crop failed' : 'resized'
    );
    expect(images).toHaveLength(asset.rectangles.length - (kind === 'rejected' ? 1 : 0));
    images.forEach((image) => expect(image.close).toHaveBeenCalledTimes(1));
  }
);

test.each(['partial', 'level', 'offset', 'gap', 'width', 'height', 'rows', 'fraction'])(
  'rejects %s layout before downloading',
  async (kind) => {
    const changed = structuredClone(asset);
    switch (kind) {
      case 'partial':
        changed.rectangles.pop();
        break;
      case 'level':
        changed.rectangles[1].level = 0;
        break;
      case 'offset':
        changed.rectangles[1].x = 1;
        break;
      case 'gap':
        changed.rectangles[1].y++;
        break;
      case 'width':
        changed.rectangles[1].width++;
        break;
      case 'height':
        changed.rectangles[1].height++;
        break;
      case 'rows':
        changed.height++;
        break;
      case 'fraction':
        changed.rectangles[0].x = 0.5;
        break;
    }
    await expect(loadAuthoredMipTexture(changed, false)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    expect(createImageBitmap).not.toHaveBeenCalled();
  }
);
