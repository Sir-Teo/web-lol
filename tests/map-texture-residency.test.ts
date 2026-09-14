import { expect, test, vi } from 'vitest';
import { Texture } from 'three';
import { MapTextureResidency } from '../src/render/map-texture-residency';

test('evicts oldest offscreen textures, counts shared textures once, and permits reupload', () => {
  const residency = new MapTextureResidency(20);
  const a = new Texture(),
    b = new Texture(),
    c = new Texture();
  const disposeA = vi.spyOn(a, 'dispose'),
    disposeB = vi.spyOn(b, 'dispose');
  residency.beginFrame();
  residency.touch(a, 10);
  residency.touch(a, 10);
  residency.endFrame();
  expect(residency.residentBytes).toBe(10);
  residency.beginFrame();
  residency.touch(b, 10);
  residency.endFrame();
  residency.beginFrame();
  residency.touch(c, 10);
  residency.endFrame();
  expect(disposeA).toHaveBeenCalledTimes(1);
  expect(disposeB).not.toHaveBeenCalled();
  expect(residency.residentBytes).toBe(20);
  residency.beginFrame();
  residency.touch(a, 10);
  residency.endFrame();
  expect(disposeB).toHaveBeenCalledTimes(1);
  expect(disposeA).toHaveBeenCalledTimes(1);
  expect(residency.evictions).toBe(2);
  expect(residency.residentCount).toBe(2);
  residency.endFrame();
  expect(residency.evictions).toBe(2);
});

test('protects every current-frame texture even when the visible working set exceeds budget', () => {
  const residency = new MapTextureResidency(10);
  const a = new Texture(),
    b = new Texture();
  residency.beginFrame();
  residency.touch(a, 20);
  residency.touch(b, 20);
  residency.endFrame();
  expect(residency.currentFrameBytes).toBe(40);
  expect(residency.residentBytes).toBe(40);
  expect(residency.evictions).toBe(0);
  residency.beginFrame();
  residency.touch(b, 20);
  residency.endFrame();
  expect(residency.residentBytes).toBe(20);
  expect(residency.evictions).toBe(1);
});

test('prefetch replaces distant textures while protecting visible and nearby textures', () => {
  const residency = new MapTextureResidency(30);
  const visible = new Texture(),
    distant = new Texture(),
    nearby = new Texture(),
    next = new Texture();
  residency.beginFrame();
  residency.touch(distant, 10);
  residency.touch(nearby, 10);
  residency.beginFrame();
  residency.touch(visible, 10);
  const upload = vi.fn();
  expect(
    residency.prefetch(
      new Map([
        [nearby, 10],
        [next, 10],
      ]),
      upload,
      () => 0
    )
  ).toBe(1);
  expect(upload).toHaveBeenCalledWith(next);
  expect(residency.residentBytes).toBe(30);
  expect(residency.currentFrameBytes).toBe(10);
  expect(residency.evictions).toBe(1);
  expect(
    residency.prefetch(
      new Map([
        [nearby, 10],
        [next, 10],
      ]),
      upload,
      () => 0
    )
  ).toBe(0);
  residency.beginFrame();
  residency.touch(next, 10);
  expect(residency.currentFrameBytes).toBe(10);
});

test('prefetch skips oversubscribed neighborhoods without churn or partial evictions', () => {
  const residency = new MapTextureResidency(20);
  const a = new Texture(),
    b = new Texture(),
    c = new Texture();
  residency.beginFrame();
  residency.touch(a, 10);
  residency.touch(b, 10);
  residency.beginFrame();
  residency.touch(a, 10);
  const upload = vi.fn();
  expect(
    residency.prefetch(
      new Map([
        [b, 10],
        [c, 10],
      ]),
      upload,
      () => 0
    )
  ).toBe(0);
  expect(residency.prefetch(new Map([[c, 30]]), upload, () => 0)).toBe(0);
  expect(upload).not.toHaveBeenCalled();
  expect(residency.evictions).toBe(0);
});

test('prefetch stops after its count or elapsed-time limit', () => {
  const nearby = new Map(Array.from({ length: 5 }, () => [new Texture(), 10] as const));
  const residency = new MapTextureResidency(100),
    upload = vi.fn();
  expect(residency.prefetch(nearby, upload, () => 0)).toBe(2);
  let clock = 0;
  const slowUpload = vi.fn(() => {
    clock += 3;
  });
  expect(residency.prefetch(nearby, slowUpload, () => clock)).toBe(1);
  expect(residency.residentBytes).toBe(30);
});
