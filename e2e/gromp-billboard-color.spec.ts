import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { grompRayReference } from '../tools/qa/lib/prepare-gromp-ray-reference.mjs';

for (const profileIndex of [1, 2, 3])
  test(`Gromp complex billboard ${profileIndex} matches independent C color bytes`, async ({
    page,
  }, info) => {
    test.setTimeout(180000);
    const reference = await grompRayReference(
      info.outputPath('reference'),
      '46e69f71b258b86e3bfa25032bc69515ba28b718'
    );
    const before = await import(pathToFileURL(reference.module).href),
      profile = before.data.profiles[profileIndex];
    const born = before
      .grompDeathParticles(100, 101, 91)
      .find((p) => p.profileIndex === profileIndex);
    const ticks = [0.111, 0.137, 0.173, 0.213, 0.257, 0.319, 0.357].map(
      (phase) => 101 + phase * born.life * 60
    );
    const raw = ticks.map((tick) =>
      before.grompDeathParticles(100, tick, 91).filter((p) => p.profileIndex === profileIndex)
    );
    expect(raw.every((p) => p.length > 0)).toBe(true);
    const input = info.outputPath('inputs.json'),
      output = info.outputPath('expected.json');
    writeFileSync(input, JSON.stringify(raw.flat().map((p) => ({ profileIndex, phase: p.phase }))));
    execFileSync('python3', ['tools/qa/lib/legacy-billboard-color-reference.py', input, output]);
    const expected = JSON.parse(readFileSync(output, 'utf8'));
    let offset = 0;
    const packets = raw.map((particles) => {
      const values = expected.slice(offset, offset + particles.length);
      offset += particles.length;
      return values;
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/gromp-billboard-probe', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html><canvas></canvas>' })
    );
    await page.goto('/gromp-billboard-probe');
    const reading = await page.evaluate(
      async ({ profileIndex, profile, ticks, raw, packets }) => {
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
              if (!mesh) throw Error('Missing actual billboard batch');
              const tint = mesh.geometry.getAttribute('_source_vertex_bgra');
              if (
                !(tint?.array instanceof Uint8Array) ||
                !tint.normalized ||
                mesh.geometry.hasAttribute('particleTint')
              )
                throw Error('Incorrect byte stream');
              if (mesh.userData.particleCount !== raw[sample].length)
                throw Error('Sampler count differs');
              const bytes = new Uint8Array(tint.array.length),
                oldTint = new Float32Array(tint.array.length),
                referenceTint = new Float32Array(tint.array.length);
              const lookup = mesh.geometry.getAttribute('particleLookupUv');
              for (let i = 0; i < raw[sample].length; i++)
                for (let vertex = i * 6; vertex < (i + 1) * 6; vertex++) {
                  bytes.set(packets[sample][i].bgra, vertex * 4);
                  const bgra = packets[sample][i].bgra;
                  referenceTint.set(
                    [bgra[2] / 255, bgra[1] / 255, bgra[0] / 255, bgra[3] / 255],
                    vertex * 4
                  );
                  oldTint.set(raw[sample][i].color, vertex * 4);
                  if (
                    lookup.getX(vertex) !== Math.fround(raw[sample][i].phase) ||
                    lookup.getY(vertex) !== 0.5
                  )
                    throw Error('Lookup changed outside color scope');
                }
              for (let i = 0; i < mesh.geometry.drawRange.count * 4; i++)
                if (tint.array[i] !== bytes[i]) throw Error('Actual byte differs from C');
              const candidateScene = new THREE.Scene(),
                refScene = new THREE.Scene(),
                oldScene = new THREE.Scene();
              const refGeometry = mesh.geometry.clone(),
                oldGeometry = mesh.geometry.clone(),
                refMaterial = mesh.material.clone(),
                oldMaterial = mesh.material.clone();
              // The reference bypasses byte normalization and BGRA decoding;
              // its float tint comes directly from independent C packet bytes.
              refGeometry.deleteAttribute('_source_vertex_bgra');
              refGeometry.setAttribute(
                'particleTint',
                new THREE.Float32BufferAttribute(referenceTint, 4)
              );
              delete refMaterial.defines.VERTEX_BGRA;
              oldGeometry.deleteAttribute('_source_vertex_bgra');
              oldGeometry.setAttribute(
                'particleTint',
                new THREE.Float32BufferAttribute(oldTint, 4)
              );
              delete oldMaterial.defines.VERTEX_BGRA;
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
              for (let vertex = 0; vertex < mesh.geometry.drawRange.count; vertex++)
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
                        rgb = 0;
                      for (let i = 0; i < buffers[0].length; i++) {
                        const d = Math.abs(buffers[0][i] - buffers[1][i]);
                        if (d) differences++;
                        delta = Math.max(delta, d);
                        if (buffers[2][i] !== buffers[1][i]) oldDifferences++;
                        if (i % 4 !== 3 && buffers[1][i]) rgb++;
                      }
                      changed += differences;
                      oldChanged += oldDifferences;
                      maxDelta = Math.max(maxDelta, delta);
                      if (rgb) nonempty++;
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
      { profileIndex, profile, ticks, raw, packets }
    );
    writeFileSync(
      info.outputPath('billboard-pixels.json'),
      JSON.stringify({ ...reading, errors }, null, 2) + '\n'
    );
    expect(reading.rows).toHaveLength(ticks.length * 12);
    expect(reading.nonempty).toBe(ticks.length * 12);
    expect(reading.changed).toBe(0);
    expect(reading.maxDelta).toBe(0);
    expect(reading.oldChanged).toBeGreaterThan(0);
    expect(reading.glError).toBe(0);
    expect(errors).toEqual([]);
  });
