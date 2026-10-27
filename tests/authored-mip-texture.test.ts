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
    vi.fn(
      async (
        input: Blob | object,
        _x?: number | object,
        _y?: number,
        width?: number,
        height?: number
      ) => {
        const image = {
          width: input instanceof Blob ? asset.width : width!,
          height: input instanceof Blob ? asset.height : height!,
          close: vi.fn(),
        };
        images.push(image);
        return image;
      }
    )
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
  expect(createImageBitmap).toHaveBeenCalledTimes(asset.rectangles.length + 1);
  expect(createImageBitmap).toHaveBeenNthCalledWith(1, expect.any(Blob), {
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
    imageOrientation: 'none',
  });
  const atlas = images[0];
  expect(atlas.close).toHaveBeenCalledTimes(1);
  for (const r of asset.rectangles)
    expect(createImageBitmap).toHaveBeenNthCalledWith(
      r.level + 2,
      atlas,
      r.x,
      r.y,
      r.width,
      r.height,
      { premultiplyAlpha: 'none', colorSpaceConversion: 'none', imageOrientation: 'none' }
    );
  expect(texture.image).toBe(images[1]);
  expect(texture.mipmaps).toEqual(images.slice(1));
  images.slice(1).forEach((image) => expect(image.close).not.toHaveBeenCalled());
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

test.each(['rejected', 'resized'])(
  'a %s container decode never starts crops and releases any allocated bitmap',
  async (kind) => {
    const atlas = { width: asset.width + 1, height: asset.height, close: vi.fn() };
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        if (kind === 'rejected') throw Error('container decode failed');
        return atlas;
      })
    );
    await expect(loadAuthoredMipTexture(asset, false)).rejects.toThrow(
      kind === 'rejected' ? 'container decode failed' : 'resized'
    );
    expect(createImageBitmap).toHaveBeenCalledTimes(1);
    expect(atlas.close).toHaveBeenCalledTimes(kind === 'rejected' ? 0 : 1);
  }
);

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
      vi.fn(
        async (
          input: Blob | object,
          _x?: number | object,
          _y?: number,
          width?: number,
          height?: number
        ) => {
          if (input instanceof Blob) {
            const atlas = { width: asset.width, height: asset.height, close: vi.fn() };
            images.push(atlas);
            return atlas;
          }
          const index = ordinal++;
          if (index === 2 && kind === 'rejected') throw Error('crop failed');
          await Promise.resolve();
          const image = {
            width: width! + (index === 2 && kind === 'resized' ? 1 : 0),
            height: height!,
            close: vi.fn(),
          };
          images.push(image);
          return image;
        }
      )
    );
    await expect(loadAuthoredMipTexture(asset, false)).rejects.toThrow(
      kind === 'rejected' ? 'crop failed' : 'resized'
    );
    expect(images).toHaveLength(asset.rectangles.length + 1 - (kind === 'rejected' ? 1 : 0));
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
