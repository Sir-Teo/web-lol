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
