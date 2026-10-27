import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { grompAttackReference } from '../tools/qa/lib/prepare-gromp-attack-reference.mjs';

for (const profileIndex of [0, 1, 2, 3])
  test(`Gromp missile ${profileIndex} matches independent C premultiplication and truncating BGRA`, async ({
    page,
  }, info) => {
    test.setTimeout(180000);
    const reference = await grompAttackReference(info.outputPath('reference')),
      before = await import(pathToFileURL(reference.module).href),
      profile = before.data.profiles[profileIndex],
      effect = {
        id: 47,
        sourceId: 91,
        launchTick: 100,
        stopTick: null,
        frames: Array.from({ length: 121 }, (_, i) => ({
          tick: 100 + i,
          x: i * 3,
          y: Math.sin(i / 8) * 20,
          facing: i / 20,
        })),
      },
      ticks = [0.111, 0.213, 0.413, 0.613, 0.713, 0.813, 0.911].map((phase) => 101 + phase * 30),
      raw = ticks.map((tick) =>
        before.grompAttackParticles(effect, tick).filter((p) => p.profileIndex === profileIndex)
      );
    expect(raw.every((p) => p.length > 0)).toBe(true);
    const input = info.outputPath('inputs.json'),
      output = info.outputPath('expected.json');
    writeFileSync(input, JSON.stringify(raw.flat().map((p) => ({ profileIndex, phase: p.phase }))));
    execFileSync('python3', ['tools/qa/lib/legacy-gromp-attack-color-reference.py', input, output]);
    const expected = JSON.parse(readFileSync(output, 'utf8'));
    let offset = 0;
    const colors = raw.map((p) => {
      const r = expected.slice(offset, offset + p.length);
      offset += p.length;
      return r;
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/gromp-missile-color-probe', (r) =>
      r.fulfill({ contentType: 'text/html', body: '<!doctype html><canvas></canvas>' })
    );
    await page.goto('/gromp-missile-color-probe');
    const reading = await page.evaluate(
      async ({ profileIndex, profile, effect, ticks, raw, colors }) => {
        const THREE = await import('/node_modules/three/build/three.module.js'),
          { GrompAttack, loadGrompAttack } = await import('/src/render/gromp-attack.ts');
        await loadGrompAttack();
        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true }),
          scene = new THREE.Scene(),
          controller = new GrompAttack(scene, () => 0),
          world = { tick: 101, grompAttackVisuals: [effect], pointVisible: () => true };
        renderer.setPixelRatio(1);
        renderer.setClearColor(0, 0);
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        const rows = [];
        let changed = 0,
          oldChanged = 0,
          nonempty = 0,
          checkedVertices = 0;
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
              controller.update(world, 1, camera);
              const mesh = [...controller.models.values()].find(
                (m) => m.name === 'Gromp attack ' + profile.name
              );
              if (!mesh) throw Error('Missing actual missile batch');
              const tint = mesh.geometry.getAttribute('_source_vertex_bgra'),
                lookup = mesh.geometry.getAttribute('particleLookupUv');
              if (
                !(tint?.array instanceof Uint8Array) ||
                !tint.normalized ||
                mesh.geometry.hasAttribute('particleTint') ||
                mesh.material.defines.VERTEX_BGRA !== 1
              )
                throw Error('Incorrect packed stream');
              if (mesh.userData.particleCount !== raw[sample].length)
                throw Error('Particle count changed');
              const vertices = mesh.geometry.drawRange.count / raw[sample].length;
              if (vertices !== 6) throw Error('Missile geometry changed');
              const referenceTint = new Float32Array(tint.count * 4),
                oldTint = new Float32Array(tint.count * 4);
              for (let i = 0; i < raw[sample].length; i++)
                for (let v = i * vertices; v < (i + 1) * vertices; v++) {
                  const bgra = colors[sample][i].bgra;
                  for (let lane = 0; lane < 4; lane++)
                    if (tint.array[v * 4 + lane] !== bgra[lane])
                      throw Error('Actual BGRA differs from C');
                  referenceTint.set(
                    [bgra[2] / 255, bgra[1] / 255, bgra[0] / 255, bgra[3] / 255],
                    v * 4
                  );
                  const old = [...raw[sample][i].color];
                  if (profile.blend === 0 || profile.blend === 2) {
                    for (let lane = 0; lane < 3; lane++) old[lane] *= old[3];
                    old[3] = 1;
                  }
                  oldTint.set(old, v * 4);
                  checkedVertices++;
                  if (
                    lookup.getX(v) !== Math.fround(raw[sample][i].phase) ||
                    lookup.getY(v) !== 0.5
                  )
                    throw Error('Lookup changed outside color scope');
                }
              const candidateScene = new THREE.Scene(),
                refScene = new THREE.Scene(),
                oldScene = new THREE.Scene(),
                refGeometry = mesh.geometry.clone(),
                oldGeometry = mesh.geometry.clone(),
                refMaterial = mesh.material.clone(),
                oldMaterial = mesh.material.clone();
              for (const [geometry, material, values] of [
                [refGeometry, refMaterial, referenceTint],
                [oldGeometry, oldMaterial, oldTint],
              ]) {
                geometry.deleteAttribute('_source_vertex_bgra');
                geometry.setAttribute('particleTint', new THREE.Float32BufferAttribute(values, 4));
                delete material.defines.VERTEX_BGRA;
              }
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
              for (let vertex = 0; vertex < vertices; vertex++)
                bounds.expandByPoint(
                  point.fromBufferAttribute(position, vertex).add(mesh.position)
                );
              const center = bounds.getCenter(new THREE.Vector3()),
                radius = Math.max(bounds.getSize(new THREE.Vector3()).length() / 2, 0.01);
              const viewDirection = new THREE.Vector3(...direction).normalize();
              if (profile.kind === 'quad') {
                // Keep the color probe clear of edge-on planes. Derive oblique
                // views from the actual packet, retaining the complete batch.
                const origin = new THREE.Vector3().fromBufferAttribute(position, 0),
                  tangent = new THREE.Vector3()
                    .fromBufferAttribute(position, 1)
                    .sub(origin)
                    .normalize(),
                  normal = new THREE.Vector3()
                    .fromBufferAttribute(position, 2)
                    .sub(origin)
                    .cross(tangent)
                    .normalize(),
                  across = new THREE.Vector3().crossVectors(normal, tangent);
                viewDirection
                  .copy(normal)
                  .multiplyScalar(2)
                  .addScaledVector(tangent, direction[0] / 4)
                  .addScaledVector(across, direction[1] / 4)
                  .normalize();
              }
              camera.position.copy(center).add(viewDirection.multiplyScalar(radius * 3));
              camera.lookAt(center);
              camera.updateMatrixWorld();
              try {
                for (const blend of ['runtime', 'raw'])
                  for (const size of [64, 127]) {
                    const target = new THREE.WebGLRenderTarget(size, size),
                      buffers = [];
                    renderer.setSize(size, size);
                    for (const m of [mesh.material, refMaterial, oldMaterial])
                      m.blending = blend === 'raw' ? THREE.NoBlending : THREE.CustomBlending;
                    // Subtractive source mode2 requires a nonblack destination to contribute RGB.
                    renderer.setClearColor(
                      blend === 'runtime' && profile.blend === 2 ? 0xffffff : 0,
                      blend === 'runtime' && profile.blend === 2 ? 1 : 0
                    );
                    try {
                      renderer.setRenderTarget(target);
                      for (const drawScene of [candidateScene, refScene, oldScene]) {
                        renderer.clear();
                        renderer.render(drawScene, camera);
                        const pixels = new Uint8Array(size * size * 4);
                        renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
                        buffers.push(pixels);
                      }
                      // Compare against a cleared target, including subtractive contributions.
                      renderer.clear();
                      const clear = new Uint8Array(size * size * 4);
                      renderer.readRenderTargetPixels(target, 0, 0, size, size, clear);
                      let differences = 0,
                        oldDifferences = 0,
                        contribution = 0,
                        maxDelta = 0;
                      for (let i = 0; i < buffers[0].length; i++) {
                        const d = Math.abs(buffers[0][i] - buffers[1][i]);
                        if (d) differences++;
                        maxDelta = Math.max(maxDelta, d);
                        if (buffers[2][i] !== buffers[1][i]) oldDifferences++;
                        if (buffers[1][i] !== clear[i]) contribution++;
                      }
                      changed += differences;
                      oldChanged += oldDifferences;
                      if (contribution) nonempty++;
                      rows.push({
                        sample,
                        direction,
                        blend,
                        size,
                        particles: raw[sample].length,
                        changedBytes: differences,
                        oldFloatChangedBytes: oldDifferences,
                        contribution,
                        maxDelta,
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
            nonempty,
            checkedVertices,
            glError: renderer.getContext().getError(),
          };
        } finally {
          world.grompAttackVisuals = [];
          controller.update(world, 1, new THREE.Camera());
          renderer.dispose();
        }
      },
      { profileIndex, profile, effect, ticks, raw, colors }
    );
    writeFileSync(
      info.outputPath('missile-color-pixels.json'),
      JSON.stringify({ ...reading, errors }, null, 2) + '\n'
    );
    expect(reading.rows).toHaveLength(84);
    expect(reading.changed).toBe(0);
    expect(reading.nonempty).toBe(84);
    expect(reading.glError).toBe(0);
    expect(errors).toEqual([]);
  });
