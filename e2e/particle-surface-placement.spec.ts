import { expect, test } from '@playwright/test';
import { relative, sep } from 'node:path';
import { writeFileSync } from 'node:fs';
import { placementReference } from '../tools/qa/lib/prepare-surface-placement-reference.mjs';

test('source placement retains frozen-renderer GPU pixels with authored textures', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const reference = await placementReference(info.outputPath('reference'));
  const referenceUrl = '/' + relative(process.cwd(), reference.module).split(sep).join('/');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/placement-probe', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Particle placement parity</title>',
    })
  );
  await page.goto('/placement-probe');
  const reading = await page.evaluate(async (referenceUrl) => {
    const THREE = await import('/node_modules/three/build/three.module.js'),
      before = await import(referenceUrl),
      after = await import('/src/render/source-particle-surfaces.ts'),
      { masterYiTextures } = await import('/src/render/masteryi-source-textures.ts'),
      data = before.data,
      textures = new Map(),
      samplers = new Map();
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.needsUpdate = true;
    textures.set('', white);
    for (const asset of data.textures)
      textures.set(
        asset.url,
        await masterYiTextures.load(
          asset,
          data.profiles.some((p) => p.lookup === asset.url)
        )
      );
    const assets = {
      texture(path, address = 0) {
        const loaded = textures.get(path);
        if (!loaded) throw Error('Missing source texture');
        const wrap = address === 2 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
        if (loaded.wrapS === wrap) return loaded;
        const key = path + ':' + address;
        if (!samplers.has(key)) {
          const texture = loaded.clone();
          texture.wrapS = texture.wrapT = wrap;
          texture.needsUpdate = true;
          samplers.set(key, texture);
        }
        return samplers.get(key);
      },
      mesh() {
        throw Error('Unexpected primary-hit mesh');
      },
    };
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setSize(128, 128);
    renderer.setPixelRatio(1);
    renderer.setClearColor(0, 0);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    document.body.append(renderer.domElement);
    const target = new THREE.WebGLRenderTarget(128, 128),
      aBytes = new Uint8Array(128 * 128 * 4),
      bBytes = new Uint8Array(aBytes.length),
      rows = [];
    let maxDelta = 0,
      totalChanged = 0,
      nonzeroCases = 0;
    for (const kind of ['attack1', 'attack2', 'crit'])
      for (const time of [0.05, 0.15, 0.4, 0.8])
        for (const view of [0, 1, 2])
          for (const tint of [false, true]) {
            const sceneA = new THREE.Scene(),
              sceneB = new THREE.Scene(),
              camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
            camera.position.set(
              ...[
                [4, 4, 5],
                [-3, 2, 5],
                [1, 5, -2],
              ][view]
            );
            camera.lookAt(1, 0.5, 2);
            camera.updateMatrixWorld();
            const particles = before.primaryHitParticles(91, time, kind, 30),
              group = { key: 'fixture', startTick: 0, stopTick: 100, radius: 30, seed: 91 },
              world = {
                tick: time * 60 + 1,
                winner: null,
                pointVisible: () => true,
                battlefield: { lineWalkable: () => true },
              },
              program = {
                name: 'placement',
                attachment: 'fixture',
                profiles: data.profiles,
                assets: () => assets,
                accepts: () => true,
                records: () => [{ sourceId: 1, castTick: 0, group }],
                particles: () => particles,
                birthVisible: () => true,
                pose: (_g, t) => ({ x: 100 + t * 3, y: 200 - t, facing: 0.2 + t * 0.01 }),
                ...(tint ? { tint: (_i, color) => color } : {}),
              };
            const a = new before.SourceParticleSurfaces(
                sceneA,
                new THREE.Scene(),
                () => 0.5,
                program,
                assets
              ),
              b = new after.SourceParticleSurfaces(
                sceneB,
                new THREE.Scene(),
                () => 0.5,
                program,
                assets
              );
            a.update(world, 1, camera);
            b.update(world, 1, camera);
            renderer.setRenderTarget(target);
            renderer.clear();
            renderer.render(sceneA, camera);
            renderer.readRenderTargetPixels(target, 0, 0, 128, 128, aBytes);
            renderer.clear();
            renderer.render(sceneB, camera);
            renderer.readRenderTargetPixels(target, 0, 0, 128, 128, bBytes);
            let changed = 0,
              delta = 0,
              nonzero = 0;
            for (let i = 0; i < aBytes.length; i++) {
              const d = Math.abs(aBytes[i] - bBytes[i]);
              if (d) changed++;
              delta = Math.max(delta, d);
              if (i % 4 !== 3 && aBytes[i]) nonzero++;
            }
            if (nonzero) nonzeroCases++;
            maxDelta = Math.max(maxDelta, delta);
            totalChanged += changed;
            rows.push({
              kind,
              time,
              view,
              tint,
              particles: particles.length,
              nonzeroRgbValues: nonzero,
              changedBytes: changed,
              maxDelta: delta,
            });
            a.dispose();
            b.dispose();
          }
    const gl = renderer.getContext(),
      error = gl.getError();
    target.dispose();
    renderer.dispose();
    return {
      cases: rows.length,
      rows,
      totalChanged,
      maxDelta,
      nonzeroCases,
      error,
      gameBooted: '__GAME__' in window,
      userAgent: navigator.userAgent,
    };
  }, referenceUrl);
  expect(errors).toEqual([]);
  expect(reading.cases).toBe(72);
  expect(reading.totalChanged).toBe(0);
  expect(reading.maxDelta).toBe(0);
  expect(reading.error).toBe(0);
  expect(reading.nonzeroCases).toBeGreaterThanOrEqual(30);
  expect(reading.gameBooted).toBe(false);
  const readingPath = info.outputPath('placement-pixels.json');
  writeFileSync(readingPath, JSON.stringify({ reference, ...reading, errors }, null, 2) + '\n');
  await info.attach('placement-pixels.json', {
    path: readingPath,
    contentType: 'application/json',
  });
});
