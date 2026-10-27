import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { grompRayReference } from '../tools/qa/lib/prepare-gromp-ray-reference.mjs';

for (const profileIndex of [6])
  test(`Gromp complex mesh ${profileIndex} matches independent C float color`, async ({
    page,
  }, info) => {
    test.setTimeout(180000);
    const reference = await grompRayReference(
      info.outputPath('reference'),
      '891abcc0d25eb0dfbf2af7d18a62d8235fbb8d8c'
    );
    const before = await import(pathToFileURL(reference.module).href),
      profile = before.data.profiles[profileIndex];
    const born = before
      .grompDeathParticles(100, 101, 91)
      .find((p) => p.profileIndex === profileIndex);
    const ticks = [0.111, 0.713, 0.737, 0.773, 0.813, 0.857, 0.911].map(
      (phase) => 101 + phase * born.life * 60
    );
    const raw = ticks.map((tick) =>
      before.grompDeathParticles(100, tick, 91).filter((p) => p.profileIndex === profileIndex)
    );
    expect(raw.every((p) => p.length > 0)).toBe(true);
    const input = info.outputPath('inputs.json'),
      output = info.outputPath('expected.json');
    writeFileSync(input, JSON.stringify(raw.flat().map((p) => ({ profileIndex, phase: p.phase }))));
    execFileSync('python3', ['tools/qa/lib/legacy-mesh-color-reference.py', input, output]);
    const expected = JSON.parse(readFileSync(output, 'utf8'));
    let offset = 0;
    const colors = raw.map((particles) => {
      const values = expected.slice(offset, offset + particles.length);
      offset += particles.length;
      return values;
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/gromp-mesh-probe', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html><canvas></canvas>' })
    );
    await page.goto('/gromp-mesh-probe');
    const reading = await page.evaluate(
      async ({ profileIndex, profile, ticks, raw, colors }) => {
        const THREE = await import('/node_modules/three/build/three.module.js');
        const { GrompDeath, loadGrompDeath } = await import('/src/render/gromp-death.ts');
        await loadGrompDeath();
        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true }),
          scene = new THREE.Scene(),
          controller = new GrompDeath(scene);
        const root = new THREE.Object3D(),
          bone = new THREE.Object3D();
        bone.name = 'Buffbone_Glb_Ground_Loc';
        root.add(bone);
        root.updateMatrixWorld(true);
        const models = new Map([[91, { root }]]),
          unit = {
            id: 91,
            kind: 'monster',
            monster: { species: 'gromp' },
            deadAt: 100,
            facing: 0.4,
          };
        const world = { tick: 101, units: [unit], visible: () => true };
        renderer.setPixelRatio(1);
        renderer.setClearColor(0, 0);
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        const rows = [];
        let changed = 0,
          oldChanged = 0,
          maxDelta = 0,
          nonempty = 0;
        try {
          for (let sample = 0; sample < ticks.length; sample++)
            for (const direction of [
              [3, 2, 4],
              [-3, 1, 2],
              [1, 4, -2],
            ]) {
              const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1000);
              camera.position.set(...direction);
              camera.lookAt(0, 0, 0);
              camera.updateMatrixWorld();
              world.tick = ticks[sample];
              controller.update(world, 1, camera, models);
              const mesh = [...controller.models.values()].find(
                (m) => m.name === 'Gromp death ' + profile.name
              );
              if (!mesh) throw Error('Missing actual mesh batch');
              const tint = mesh.geometry.getAttribute('particleTint');
              if (
                !(tint?.array instanceof Float32Array) ||
                tint.normalized ||
                mesh.geometry.hasAttribute('_source_vertex_bgra')
              )
                throw Error('Mesh float stream changed');
              if (mesh.userData.particleCount !== raw[sample].length)
                throw Error('Sampler count differs');
              const oldTint = new Float32Array(tint.array.length),
                referenceTint = new Float32Array(tint.array.length);
              const lookup = mesh.geometry.getAttribute('particleLookupUv');
              const vertices = mesh.geometry.drawRange.count / raw[sample].length;
              if (!Number.isInteger(vertices) || vertices <= 0)
                throw Error('Invalid mesh vertex count');
              for (let i = 0; i < raw[sample].length; i++)
                for (let vertex = i * vertices; vertex < (i + 1) * vertices; vertex++) {
                  referenceTint.set(colors[sample][i].rgba, vertex * 4);
                  oldTint.set(raw[sample][i].color, vertex * 4);
                  if (
                    lookup.getX(vertex) !== Math.fround(raw[sample][i].phase) ||
                    lookup.getY(vertex) !== 0.5
                  )
                    throw Error('Lookup changed outside color scope');
                }
              for (let i = 0; i < mesh.geometry.drawRange.count * 4; i++)
                if (tint.array[i] !== referenceTint[i]) throw Error('Actual float differs from C');
              const candidateScene = new THREE.Scene(),
                refScene = new THREE.Scene(),
                oldScene = new THREE.Scene();
              const refGeometry = mesh.geometry.clone(),
                oldGeometry = mesh.geometry.clone(),
                refMaterial = mesh.material.clone(),
                oldMaterial = mesh.material.clone();
              // The reference float tint comes from independent host-C RGBA.
              // The native mesh reading does not support quad byte packing here.
              refGeometry.setAttribute(
                'particleTint',
                new THREE.Float32BufferAttribute(referenceTint, 4)
              );
              oldGeometry.setAttribute(
                'particleTint',
                new THREE.Float32BufferAttribute(oldTint, 4)
              );
              const candidate = mesh.clone(),
                ref = mesh.clone(),
                old = mesh.clone();
              ref.geometry = refGeometry;
              ref.material = refMaterial;
              old.geometry = oldGeometry;
              old.material = oldMaterial;
              candidateScene.add(candidate);
              refScene.add(ref);
              oldScene.add(old);
              const bounds = new THREE.Box3(),
                position = mesh.geometry.getAttribute('position'),
                point = new THREE.Vector3();
              // Frame the first retained shard so sparse debris remains visible
              // at both target sizes. Keep the actual complete batch untouched.
              for (let vertex = 0; vertex < vertices; vertex++)
                bounds.expandByPoint(
                  point.fromBufferAttribute(position, vertex).add(mesh.position)
                );
              const center = bounds.getCenter(new THREE.Vector3()),
                radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, 0.01);
              camera.position
                .copy(center)
                .add(new THREE.Vector3(...direction).normalize().multiplyScalar(radius * 3));
              camera.lookAt(center);
              camera.updateMatrixWorld();
              try {
                for (const blend of ['runtime', 'raw'])
                  for (const size of [64, 127]) {
                    const target = new THREE.WebGLRenderTarget(size, size),
                      buffers = [];
                    renderer.setSize(size, size);
                    for (const material of [mesh.material, refMaterial, oldMaterial])
                      material.blending = blend === 'raw' ? THREE.NoBlending : THREE.CustomBlending;
                    try {
                      renderer.setRenderTarget(target);
                      for (const drawScene of [candidateScene, refScene, oldScene]) {
                        renderer.clear();
                        renderer.render(drawScene, camera);
                        const pixels = new Uint8Array(size * size * 4);
                        renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
                        buffers.push(pixels);
                      }
                      let differences = 0,
                        oldDifferences = 0,
                        delta = 0,
                        rgb = 0,
                        alpha = 0;
                      for (let i = 0; i < buffers[0].length; i++) {
                        const d = Math.abs(buffers[0][i] - buffers[1][i]);
                        if (d) differences++;
                        delta = Math.max(delta, d);
                        if (buffers[2][i] !== buffers[1][i]) oldDifferences++;
                        if (i % 4 !== 3 && buffers[1][i]) rgb++;
                        if (i % 4 === 3 && buffers[1][i]) alpha++;
                      }
                      changed += differences;
                      oldChanged += oldDifferences;
                      maxDelta = Math.max(maxDelta, delta);
                      if (rgb || alpha) nonempty++;
                      rows.push({
                        sample,
                        direction,
                        blend,
                        size,
                        particles: raw[sample].length,
                        changedBytes: differences,
                        maxDelta: delta,
                        oldFloatChangedBytes: oldDifferences,
                        nonzeroRgb: rgb,
                        nonzeroAlpha: alpha,
                      });
                    } finally {
                      renderer.setRenderTarget(null);
                      target.dispose();
                    }
                  }
              } finally {
                refGeometry.dispose();
                oldGeometry.dispose();
                refMaterial.dispose();
                oldMaterial.dispose();
              }
            }
          return {
            profileIndex,
            rows,
            changed,
            oldChanged,
            maxDelta,
            nonempty,
            glError: renderer.getContext().getError(),
          };
        } finally {
          world.units = [];
          controller.update(world, 1, new THREE.Camera(), models);
          renderer.dispose();
        }
      },
      { profileIndex, profile, ticks, raw, colors }
    );
    writeFileSync(
      info.outputPath('mesh-pixels.json'),
      JSON.stringify({ ...reading, errors }, null, 2) + '\n'
    );
    expect(reading.rows).toHaveLength(ticks.length * 12);
    expect(reading.nonempty).toBe(ticks.length * 12);
    expect(reading.changed).toBe(0);
    expect(reading.maxDelta).toBe(0);
    expect(reading.oldChanged).toBeGreaterThanOrEqual(0);
    expect(reading.glError).toBe(0);
    expect(errors).toEqual([]);
  });
