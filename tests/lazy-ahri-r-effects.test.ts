import { beforeEach, expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { World } from '../src/simulation/world';
import { PRACTICE_FIXTURE } from '../src/content/practice-fixture';
const fake = vi.hoisted(() => ({
  load: vi.fn(),
  update: vi.fn(),
  dispose: vi.fn(),
  create: vi.fn(),
}));
vi.mock('../src/render/ahri-r-effects', () => ({
  loadAhriRParticles: fake.load,
  AhriRParticles: class {
    models = new Map();
    surfaces = {};
    constructor() {
      fake.create();
    }
    update(...args: unknown[]) {
      fake.update(...args);
    }
    dispose() {
      fake.dispose();
    }
  },
}));
import { LazyAhriRParticles } from '../src/render/lazy-ahri-r-effects';
beforeEach(() => {
  vi.clearAllMocks();
  fake.load.mockResolvedValue(undefined);
});
function setup() {
  const w = new World(false, PRACTICE_FIXTURE),
    v = new LazyAhriRParticles(new THREE.Scene(), new THREE.Scene(), () => 0),
    c = new THREE.PerspectiveCamera();
  return { w, v, c };
}
test('ordinary rosters never import or request R resources', async () => {
  const { w, v, c } = setup();
  v.update(w, 1, c);
  await Promise.resolve();
  expect(fake.load).not.toHaveBeenCalled();
  expect(v.ready).toBe(false);
  v.dispose();
});
test('a failed load requires an explicit retry and coalesces successful renderer creation', async () => {
  const { w, v, c } = setup();
  w.spawn('champion', 'blue', { x: 0, y: 0 }, 'ahri');
  fake.load.mockRejectedValueOnce(Error('network'));
  await expect(v.load()).rejects.toThrow('network');
  v.update(w, 1, c);
  expect(fake.load).toHaveBeenCalledTimes(1);
  const a = v.load(),
    b = v.load();
  expect(a).toBe(b);
  await a;
  expect(v.ready).toBe(true);
  expect(fake.create).toHaveBeenCalledTimes(1);
  await v.load();
  expect(fake.create).toHaveBeenCalledTimes(1);
  v.update(w, 1, c, 2);
  expect(fake.update).toHaveBeenCalledWith(w, 1, c, 2);
  v.dispose();
  expect(fake.dispose).toHaveBeenCalledTimes(1);
  expect(v.ready).toBe(false);
});
test('disposing during resource loading prevents late scene construction and ready callbacks', async () => {
  const { v } = setup();
  let release!: () => void;
  fake.load.mockImplementationOnce(
    () =>
      new Promise<void>((r) => {
        release = r;
      })
  );
  v.onReady = vi.fn();
  const pending = v.load();
  await vi.waitFor(() => expect(fake.load).toHaveBeenCalled());
  v.dispose();
  release();
  await pending;
  expect(fake.create).not.toHaveBeenCalled();
  expect(v.onReady).not.toHaveBeenCalled();
  await expect(v.load()).rejects.toThrow('disposed');
});
