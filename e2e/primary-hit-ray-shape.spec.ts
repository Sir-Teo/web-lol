import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { placementReference } from '../tools/qa/lib/prepare-surface-placement-reference.mjs';

test('primary ray shape preserves independent source dimensions against a frozen renderer', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const reference = await placementReference(
      info.outputPath('reference'),
      '552e1562caaab7280113c17649097ded9a693ee0'
    ),
    before = await import(pathToFileURL(reference.module).href),
    times = [1 / 60 + 0.012, 0.035, 0.05, 0.08, 0.1, 0.13, 0.15],
    original = times.map((time) =>
      before.primaryHitParticles(91, time, 'crit', 30).find((p) => p.profileIndex === 9)
    ),
    input = info.outputPath('size-inputs.json'),
    output = info.outputPath('size-reference.json');
  expect(original.every(Boolean)).toBe(true);
  writeFileSync(input, JSON.stringify(original.map((p) => ({ phase: p.phase }))));
  execFileSync('python3', ['tools/qa/lib/primary_hit_ray_size_reference.py', input, output]);
  const sizes = JSON.parse(readFileSync(output, 'utf8')),
    referenceUrl = '/' + relative(process.cwd(), reference.module).split(sep).join('/'),
    errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/ray-shape-probe', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Ray source dimensions</title>',
    })
  );
  await page.goto('/ray-shape-probe');
  const reading = await page.evaluate(
    async ({ times, sizes, referenceUrl }) => {
      const THREE = await import('/node_modules/three/build/three.module.js'),
        before = await import(referenceUrl),
        { SourceParticleSurfaces } = await import('/src/render/source-particle-surfaces.ts'),
        { primaryHitParticles } = await import('/src/render/masteryi-primary-hit-particles.ts'),
        { masterYiTextures } = await import('/src/render/masteryi-source-textures.ts'),
        data = before.data,
        profile = data.profiles[9],
        white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1),
        textures = new Map([['', white]]),
        rows = [],
        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
      white.needsUpdate = true;
      const asset = data.textures.find((a) => a.url === profile.texture);
      if (!asset) throw Error('Missing source ray texture');
      textures.set(profile.texture, await masterYiTextures.load(asset, false));
      const assets = {
        texture(path) {
          const t = textures.get(path);
          if (!t) throw Error('Missing ray texture');
          return t;
        },
        mesh() {
          throw Error('Unexpected ray mesh');
        },
      };
      renderer.setPixelRatio(1);
      renderer.setClearColor(0, 0);
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      let totalChanged = 0,
        maxDelta = 0,
        oldPolicyChangedBytes = 0,
        nonemptyCases = 0;
      try {
        for (let sample = 0; sample < times.length; sample++)
          for (const direction of [
            [3, 2, 4],
            [-3, 1, 2],
            [1, 4, -2],
          ]) {
            const time = times[sample],
              expectedSize = sizes[sample],
              particle = primaryHitParticles(91, time, 'crit', 30).find(
                (p) => p.profileIndex === 9
              );
            if (!particle || JSON.stringify(particle.size) !== JSON.stringify(expectedSize))
              throw Error('Ray sampler differs from independent source dimensions');
            const scenes = [new THREE.Scene(), new THREE.Scene(), new THREE.Scene()],
              particles = [
                particle,
                { ...particle, size: expectedSize },
                { ...particle, size: expectedSize.map(() => expectedSize[0]) },
              ],
              camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1000),
              group = { key: 'shape', startTick: 0, stopTick: 100, radius: 30, seed: 91 },
              world = { tick: time * 60 + 1, winner: null, pointVisible: () => true };
            camera.position.set(...direction);
            camera.lookAt(0, 0.5, 0);
            camera.updateMatrixWorld();
            const surfaces = scenes.map((scene, index) => {
              const program = {
                  name: 'ray shape',
                  attachment: 'fixture',
                  profiles: data.profiles,
                  assets: () => assets,
                  accepts: () => true,
                  vertexColor: () => 'bgra-unorm8',
                  records: () => [{ sourceId: 1, castTick: 0, group }],
                  particles: () => [particles[index]],
                  birthVisible: () => true,
                  pose: () => ({ x: 0, y: 0, facing: 0 }),
                },
                Surface = index === 0 ? SourceParticleSurfaces : before.SourceParticleSurfaces;
              return new Surface(scene, new THREE.Scene(), () => 0, program, assets);
            });
            try {
              for (const surface of surfaces) surface.update(world, 1, camera);
              const bounds = new THREE.Box3().setFromObject([...surfaces[0].models.values()][0]),
                center = bounds.getCenter(new THREE.Vector3()),
                radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, 0.01);
              camera.position
                .copy(center)
                .add(new THREE.Vector3(...direction).normalize().multiplyScalar(radius * 3));
              camera.lookAt(center);
              camera.updateMatrixWorld();
              for (const surface of surfaces) surface.update(world, 1, camera);
              const materials = surfaces.map((surface) => [...surface.models.values()][0].material),
                runtimeBlending = materials[0].blending;
              for (const blend of ['runtime', 'raw'])
                for (const size of [64, 127]) {
                  for (const material of materials)
                    material.blending = blend === 'raw' ? THREE.NoBlending : runtimeBlending;
                  renderer.setSize(size, size);
                  const target = new THREE.WebGLRenderTarget(size, size),
                    buffers = [];
                  try {
                    renderer.setRenderTarget(target);
                    for (const scene of scenes) {
                      renderer.clear();
                      renderer.render(scene, camera);
                      const b = new Uint8Array(size * size * 4);
                      renderer.readRenderTargetPixels(target, 0, 0, size, size, b);
                      buffers.push(b);
                    }
                    let changed = 0,
                      delta = 0,
                      oldChanged = 0,
                      nonzero = 0;
                    for (let i = 0; i < buffers[0].length; i++) {
                      const d = Math.abs(buffers[0][i] - buffers[1][i]);
                      if (d) changed++;
                      delta = Math.max(delta, d);
                      if (buffers[2][i] !== buffers[1][i]) oldChanged++;
                      if (i % 4 !== 3 && buffers[1][i]) nonzero++;
                    }
                    totalChanged += changed;
                    maxDelta = Math.max(maxDelta, delta);
                    oldPolicyChangedBytes += oldChanged;
                    if (nonzero) nonemptyCases++;
                    rows.push({
                      time,
                      direction,
                      blend,
                      size,
                      sourceSize: expectedSize,
                      changedBytes: changed,
                      maxDelta: delta,
                      oldPolicyChangedBytes: oldChanged,
                      nonzeroRgb: nonzero,
                    });
                  } finally {
                    renderer.setRenderTarget(null);
                    target.dispose();
                  }
                }
            } finally {
              for (const surface of surfaces) surface.dispose();
            }
          }
        return {
          rows,
          totalChanged,
          maxDelta,
          oldPolicyChangedBytes,
          nonemptyCases,
          glError: renderer.getContext().getError(),
          gameBooted: '__GAME__' in window,
        };
      } finally {
        renderer.dispose();
        for (const texture of textures.values()) texture.dispose();
      }
    },
    { times, sizes, referenceUrl }
  );
  writeFileSync(
    info.outputPath('ray-shape-pixels.json'),
    JSON.stringify({ ...reading, errors }, null, 2)
  );
  expect(reading.rows).toHaveLength(84);
  expect(reading.totalChanged).toBe(0);
  expect(reading.maxDelta).toBe(0);
  expect(reading.nonemptyCases).toBe(84);
  expect(reading.rows.every((row) => row.oldPolicyChangedBytes > 0)).toBe(true);
  expect(reading.glError).toBe(0);
  expect(reading.gameBooted).toBe(false);
  expect(errors).toEqual([]);
});
