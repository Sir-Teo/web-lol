import { beforeEach, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import type { World } from '../src/simulation/world';
const hooks = vi.hoisted(() => ({
  load: vi.fn(),
  update: vi.fn(),
  dispose: vi.fn(),
  constructed: vi.fn(),
}));
vi.mock('../src/render/baron-particle-resources', () => ({
  loadBaronParticleResources: hooks.load,
}));
vi.mock('../src/render/baron-source-hits', () => ({
  BaronSourceHits: class {
    clouds = new Map();
    constructor(...args: unknown[]) {
      hooks.constructed(...args);
    }
    update = hooks.update;
    dispose = hooks.dispose;
  },
}));
import { LazyBaronHits } from '../src/render/lazy-baron-hits';
const world = (audience: string[] = []) =>
  ({
    hero: { team: 'blue' },
    baronAttackVisuals: audience.length ? [{ impact: { frames: [{ audience }] } }] : [],
  }) as unknown as World;
beforeEach(() => {
  for (const fn of Object.values(hooks)) fn.mockReset();
});
test('hidden or absent contact never fetches resources; visible contact loads only hit role', async () => {
  const ready = vi.fn(),
    lazy = new LazyBaronHits(new THREE.Scene(), () => 0);
  lazy.onReady = ready;
  hooks.load.mockResolvedValue({ dispose: vi.fn() });
  const camera = new THREE.PerspectiveCamera();
  lazy.update(world(), 1, camera);
  lazy.update(world(['red']), 1, camera);
  expect(hooks.load).not.toHaveBeenCalled();
  lazy.update(world(['blue']), 1, camera);
  await lazy.load();
  expect(hooks.load).toHaveBeenCalledExactlyOnceWith(['hit']);
  expect(ready).toHaveBeenCalledTimes(1);
  const w = world(['blue']);
  lazy.update(w, 0.5, camera, 2);
  expect(hooks.update).toHaveBeenCalledWith(w, 0.5, camera, 2);
  lazy.dispose();
  lazy.dispose();
  expect(hooks.dispose).toHaveBeenCalledTimes(1);
});
test('rejected loads are evicted and a later explicit load can retry', async () => {
  const lazy = new LazyBaronHits(new THREE.Scene(), () => 0);
  hooks.load.mockRejectedValueOnce(Error('checksum')).mockResolvedValueOnce({ dispose: vi.fn() });
  await expect(lazy.load()).rejects.toThrow('checksum');
  await expect(lazy.load()).resolves.toBeUndefined();
  expect(hooks.load).toHaveBeenCalledTimes(2);
  lazy.dispose();
});
test('disposal during an asynchronous load retires its new resources without attaching a renderer', async () => {
  let resolve!: (value: unknown) => void;
  const resources = { dispose: vi.fn() },
    lazy = new LazyBaronHits(new THREE.Scene(), () => 0),
    ready = vi.fn();
  lazy.onReady = ready;
  hooks.load.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      })
  );
  const pending = lazy.load();
  await vi.waitFor(() => expect(hooks.load).toHaveBeenCalledTimes(1));
  lazy.dispose();
  resolve(resources);
  await expect(pending).rejects.toThrow('disposed during load');
  expect(resources.dispose).toHaveBeenCalledTimes(1);
  expect(hooks.constructed).not.toHaveBeenCalled();
  expect(ready).not.toHaveBeenCalled();
  await expect(lazy.load()).rejects.toThrow('disposed');
});
