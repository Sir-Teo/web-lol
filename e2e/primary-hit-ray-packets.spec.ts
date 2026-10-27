import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { placementReference } from '../tools/qa/lib/prepare-surface-placement-reference.mjs';

test('ray precision matches normalized BGRA attributes and half lookup coordinates on the GPU', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const reference = await placementReference(info.outputPath('reference')),
    before = await import(pathToFileURL(reference.module).href),
    times = [1 / 60 + 0.012, 0.035, 0.05, 0.08, 0.1, 0.13, 0.15],
    raw = times.map((time) =>
      before.primaryHitParticles(91, time, 'crit', 30).find((p) => p.profileIndex === 9)
    );
  expect(raw.every(Boolean)).toBe(true);
  const input = info.outputPath('packet-inputs.json'),
    output = info.outputPath('packet-reference.json');
  writeFileSync(
    input,
    JSON.stringify(
      raw.map((p) => ({ kind: 'ray', cell: p.uv.cell, color: p.color, lookup: p.lookup }))
    )
  );
  execFileSync('python3', ['tools/qa/lib/primary-hit-packet-reference.py', input, output]);
  const packets = JSON.parse(readFileSync(output, 'utf8'));
  await page.route('**/ray-packet-probe', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Ray packet calibration</title>',
    })
  );
  await page.goto('/ray-packet-probe');
  const reading = await page.evaluate(
    async ({ times, packets, raw }) => {
      const THREE = await import('/node_modules/three/build/three.module.js'),
        { SourceParticleSurfaces } = await import('/src/render/source-particle-surfaces.ts'),
        { primaryHitParticles } = await import('/src/render/masteryi-primary-hit-particles.ts'),
        { masterYiTextures } = await import('/src/render/masteryi-source-textures.ts'),
        data = (await import('/src/content/masteryi-primary-hit-particles.json')).default,
        profile = data.profiles[9],
        white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1),
        textures = new Map([['', white]]),
        rows = [],
        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
      white.needsUpdate = true;
      renderer.setPixelRatio(1);
      renderer.setClearColor(0, 0);
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      for (const path of [profile.texture, profile.lookup ?? '']) {
        if (textures.has(path)) continue;
        const asset = data.textures.find((a) => a.url === path);
        if (!asset) throw Error('Missing authored ray texture');
        textures.set(path, await masterYiTextures.load(asset, path === profile.lookup));
      }
      const assets = {
        texture(path) {
          const texture = textures.get(path);
          if (!texture) throw Error('Missing ray texture');
          return texture;
        },
        mesh() {
          throw Error('Unexpected source mesh');
        },
      };
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
              packet = packets[sample],
              original = raw[sample],
              particle = primaryHitParticles(91, time, 'crit', 30).find(
                (p) => p.profileIndex === 9
              ),
              scene = new THREE.Scene(),
              refScene = new THREE.Scene(),
              oldScene = new THREE.Scene(),
              camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1000),
              group = { key: 'ray-packet', startTick: 0, stopTick: 100, radius: 30, seed: 91 };
            if (!particle) throw Error('Missing live ray');
            if (
              JSON.stringify(particle.color) !== JSON.stringify(original.color) ||
              JSON.stringify(particle.lookup) !== JSON.stringify(packet.lookup)
            )
              throw Error('Browser sampler differs from independent packet reference');
            camera.position.set(...direction);
            camera.lookAt(0, 0.5, 0);
            camera.updateMatrixWorld();
            const program = {
                name: 'ray packet',
                attachment: 'fixture',
                profiles: data.profiles,
                assets: () => assets,
                accepts: () => true,
                vertexColor: () => 'bgra-unorm8',
                records: () => [{ sourceId: 1, castTick: 0, group }],
                particles: () => [particle],
                birthVisible: () => true,
                pose: () => ({ x: 0, y: 0, facing: 0 }),
              },
              surfaces = new SourceParticleSurfaces(
                scene,
                new THREE.Scene(),
                () => 0,
                program,
                assets
              );
            surfaces.update(
              { tick: time * 60 + 1, winner: null, pointVisible: () => true },
              1,
              camera
            );
            const mesh = [...surfaces.models.values()][0],
              bounds = new THREE.Box3().setFromObject(mesh),
              center = bounds.getCenter(new THREE.Vector3()),
              radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, 0.01),
              refGeometry = mesh.geometry.clone(),
              bytes = new Uint8Array(refGeometry.getAttribute('position').count * 4),
              rgba = packet.color.map((v) => Math.round(v * 255));
            for (let i = 0; i < bytes.length; i += 4)
              bytes.set([rgba[2], rgba[1], rgba[0], rgba[3]], i);
            refGeometry.setAttribute(
              '_source_vertex_bgra',
              new THREE.Uint8BufferAttribute(bytes, 4, true)
            );
            const refMaterial = mesh.material.clone(),
              oldMaterial = mesh.material.clone(),
              ref = mesh.clone(),
              old = mesh.clone(),
              runtimeBlending = mesh.material.blending;
            refMaterial.defines = { ...refMaterial.defines, SOURCE_VERTEX_BGRA: 1 };
            refMaterial.uniforms.particleColor.value.set(1, 1, 1, 1);
            refMaterial.uniforms.lookupUv.value.fromArray(packet.lookup);
            ref.geometry = refGeometry;
            ref.material = refMaterial;
            refScene.add(ref);
            delete oldMaterial.defines.SOURCE_VERTEX_BGRA;
            oldMaterial.uniforms.particleColor.value.fromArray(original.color);
            oldMaterial.uniforms.lookupUv.value.fromArray(original.lookup);
            old.material = oldMaterial;
            oldScene.add(old);
            camera.position
              .copy(center)
              .add(new THREE.Vector3(...direction).normalize().multiplyScalar(radius * 3));
            camera.lookAt(center);
            camera.updateMatrixWorld();
            try {
              for (const blend of ['runtime', 'raw'])
                for (const size of [64, 127]) {
                  for (const material of [mesh.material, refMaterial, oldMaterial])
                    material.blending = blend === 'raw' ? THREE.NoBlending : runtimeBlending;
                  renderer.setSize(size, size);
                  const target = new THREE.WebGLRenderTarget(size, size),
                    buffers = [];
                  try {
                    renderer.setRenderTarget(target);
                    for (const s of [scene, refScene, oldScene]) {
                      renderer.clear();
                      renderer.render(s, camera);
                      const buffer = new Uint8Array(size * size * 4);
                      renderer.readRenderTargetPixels(target, 0, 0, size, size, buffer);
                      buffers.push(buffer);
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
                      colorBytes: rgba,
                      lookup: packet.lookup,
                      nonzeroRgb: nonzero,
                      changedBytes: changed,
                      maxDelta: delta,
                      oldPolicyChangedBytes: oldChanged,
                    });
                  } finally {
                    renderer.setRenderTarget(null);
                    target.dispose();
                  }
                }
            } finally {
              refGeometry.dispose();
              refMaterial.dispose();
              oldMaterial.dispose();
              surfaces.dispose();
            }
          }
        return {
          rows,
          totalChanged,
          maxDelta,
          oldPolicyChangedBytes,
          nonemptyCases,
          glError: renderer.getContext().getError(),
        };
      } finally {
        renderer.dispose();
        for (const texture of textures.values()) texture.dispose();
      }
    },
    { times, packets, raw }
  );
  writeFileSync(info.outputPath('ray-packet-pixels.json'), JSON.stringify(reading, null, 2));
  expect(reading.rows).toHaveLength(84);
  expect(reading.totalChanged).toBe(0);
  expect(reading.maxDelta).toBe(0);
  expect(reading.oldPolicyChangedBytes).toBeGreaterThan(0);
  expect(reading.nonemptyCases).toBeGreaterThanOrEqual(42);
  expect(reading.glError).toBe(0);
});
