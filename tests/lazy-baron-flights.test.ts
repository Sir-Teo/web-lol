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
vi.mock('../src/render/baron-source-flights', () => ({
  BaronSourceFlights: class {
    clouds = new Map();
    constructor(...args: unknown[]) {
      hooks.constructed(...args);
    }
    update = hooks.update;
    dispose = hooks.dispose;
  },
}));
import { LazyBaronFlights } from '../src/render/lazy-baron-flights';
const world = (audience: string[] = []) =>
  ({
    hero: { team: 'blue' },
    baronAttackVisuals: audience.length ? [{ frames: [{ audience }] }] : [],
  }) as unknown as World;
beforeEach(() => {
  for (const fn of Object.values(hooks)) fn.mockReset();
});
test('visible flight loads only missile assets and the marker gate changes after readiness', async () => {
  const lazy = new LazyBaronFlights(new THREE.Scene(), () => 0),
    ready = vi.fn(),
    camera = new THREE.PerspectiveCamera();
  lazy.onReady = ready;
  hooks.load.mockResolvedValue({ dispose: vi.fn() });
  lazy.update(world(), 1, camera);
  lazy.update(world(['red']), 1, camera);
  expect(lazy.loaded).toBe(false);
  expect(hooks.load).not.toHaveBeenCalled();
  lazy.update(world(['blue']), 1, camera);
  await lazy.load();
  expect(hooks.load).toHaveBeenCalledExactlyOnceWith(['missile']);
  expect(lazy.loaded).toBe(true);
  expect(ready).toHaveBeenCalledTimes(1);
  lazy.dispose();
  lazy.dispose();
  expect(lazy.loaded).toBe(false);
  expect(hooks.dispose).toHaveBeenCalledTimes(1);
});
test('a rejected load retains the loading fallback and can retry', async () => {
  const lazy = new LazyBaronFlights(new THREE.Scene(), () => 0);
  hooks.load.mockRejectedValueOnce(Error('checksum')).mockResolvedValueOnce({ dispose: vi.fn() });
  await expect(lazy.load()).rejects.toThrow('checksum');
  expect(lazy.loaded).toBe(false);
  await lazy.load();
  expect(lazy.loaded).toBe(true);
  lazy.dispose();
});
test('disposal while loading releases new resources without enabling the renderer', async () => {
  let resolve!: (value: unknown) => void;
  const resources = { dispose: vi.fn() },
    lazy = new LazyBaronFlights(new THREE.Scene(), () => 0);
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
  expect(lazy.loaded).toBe(false);
  expect(resources.dispose).toHaveBeenCalledTimes(1);
  expect(hooks.constructed).not.toHaveBeenCalled();
});
