import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { grompRayReference } from '../tools/qa/lib/prepare-gromp-ray-reference.mjs';

for (const profileIndex of [5, 7])
  test(`Gromp Ray ${profileIndex} batches match independent native packet values`, async ({
    page,
  }, info) => {
    test.setTimeout(180000);
    const reference = await grompRayReference(info.outputPath('reference')),
      before = await import(pathToFileURL(reference.module).href),
      profile = before.data.profiles[profileIndex],
      born = before.grompDeathParticles(100, 101, 91).find((p) => p.profileIndex === profileIndex),
      ticks = (
        profileIndex === 5
          ? [0.111, 0.137, 0.173, 0.213, 0.257, 0.319, 0.357]
          : [0.111, 0.137, 0.173, 0.357, 0.519, 0.623, 0.719]
      ).map((phase) => 101 + phase * born.life * 60),
      cases = ticks.map((tick) => ({ tick, death: 100, id: 91 }));
    if (profileIndex === 7) cases.push({ tick: 8, death: 0, id: 0 });
    const raw = cases.map(({ tick, death, id }) =>
        before.grompDeathParticles(death, tick, id).filter((p) => p.profileIndex === profileIndex)
      ),
      input = info.outputPath('inputs.json'),
      output = info.outputPath('expected.json');
    expect(raw.every((p) => p.length > 0)).toBe(true);
    writeFileSync(
      input,
      JSON.stringify(
        raw.flat().map((p) => ({
          kind: 'ray',
          cell: [p.frame / 4, 0],
          lookup: [p.phase, 0.5],
          color: p.color,
          blend: profile.blend,
        }))
      )
    );
    execFileSync('python3', ['tools/qa/lib/primary-hit-packet-reference.py', input, output]);
    const oldAll = JSON.parse(readFileSync(output, 'utf8')),
      curveInput = info.outputPath('curve-inputs.json'),
      curveOutput = info.outputPath('curve-expected.json');
    writeFileSync(
      curveInput,
      JSON.stringify(raw.flat().map((p) => ({ profileIndex, phase: p.phase })))
    );
    execFileSync('python3', [
      'tools/qa/lib/legacy-ray-color-reference.py',
      curveInput,
      curveOutput,
    ]);
    const colors = JSON.parse(readFileSync(curveOutput, 'utf8')),
      all = oldAll.map((packet, index) => ({
        ...packet,
        color: [
          colors[index].bgra[2],
          colors[index].bgra[1],
          colors[index].bgra[0],
          colors[index].bgra[3],
        ].map((v) => v / 255),
      }));
    let offset = 0;
    const oldPackets = [];
    const packets = raw.map((p) => {
      const rows = all.slice(offset, offset + p.length);
      oldPackets.push(oldAll.slice(offset, offset + p.length));
      offset += p.length;
      return rows;
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/gromp-packet-probe', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Gromp batch packet calibration</title>',
      })
    );
    await page.goto('/gromp-packet-probe');
    const reading = await page.evaluate(
      async ({ profileIndex, cases, raw, packets, oldPackets, profile }) => {
        const THREE = await import('/node_modules/three/build/three.module.js'),
          { GrompDeath, loadGrompDeath } = await import('/src/render/gromp-death.ts');
        await loadGrompDeath();
        const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true }),
          scene = new THREE.Scene(),
          controller = new GrompDeath(scene),
          root = new THREE.Object3D(),
          bone = new THREE.Object3D();
        bone.name = 'Buffbone_Glb_Ground_Loc';
        root.add(bone);
        root.updateMatrixWorld(true);
        const models = new Map([
            [91, { root }],
            [0, { root }],
          ]),
          unit = {
            id: 91,
            kind: 'monster',
            monster: { species: 'gromp' },
            deadAt: 100,
            facing: 0.4,
          },
          world = { tick: 101, units: [unit], visible: () => true },
          rows = [];
        renderer.setPixelRatio(1);
        renderer.setClearColor(0, 0);
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        let changed = 0,
          maxDelta = 0,
          oldChanged = 0,
          oldCurveChanged = 0,
          nonempty = 0;
        try {
          for (let sample = 0; sample < cases.length; sample++)
            for (const direction of [
              [3, 2, 4],
              [-3, 1, 2],
              [1, 4, -2],
            ]) {
              const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1000);
              camera.position.set(...direction);
              camera.lookAt(0, 0, 0);
              camera.updateMatrixWorld();
              world.tick = cases[sample].tick;
              unit.id = cases[sample].id;
              unit.deadAt = cases[sample].death;
              controller.update(world, 1, camera, models);
              const mesh = [...controller.models.values()].find(
                (m) => m.name === 'Gromp death ' + profile.name
              );
              if (!mesh) throw Error('Missing live Gromp batch');
              const tint = mesh.geometry.getAttribute('_source_vertex_bgra');
              if (
                !(tint.array instanceof Uint8Array) ||
                !tint.normalized ||
                mesh.geometry.hasAttribute('particleTint')
              )
                throw Error('Incorrect byte stream');
              if (mesh.userData.particleCount !== raw[sample].length)
                throw Error('Sampler count differs');
              const candidateScene = new THREE.Scene(),
                refScene = new THREE.Scene(),
                oldScene = new THREE.Scene(),
                oldCurveScene = new THREE.Scene(),
                refGeometry = mesh.geometry.clone(),
                oldGeometry = mesh.geometry.clone(),
                oldCurveGeometry = mesh.geometry.clone(),
                bytes = new Uint8Array(tint.array.length),
                oldTint = new Float32Array(tint.array.length),
                oldCurveBytes = new Uint8Array(tint.array.length),
                refLookup = refGeometry.getAttribute('particleLookupUv'),
                oldLookup = oldGeometry.getAttribute('particleLookupUv');
              for (let i = 0; i < raw[sample].length; i++) {
                const p = raw[sample][i],
                  packet = packets[sample][i],
                  rgba = packet.color.map((v) => Math.round(v * 255)),
                  oldRgba = oldPackets[sample][i].color.map((v) => Math.round(v * 255)),
                  color = [...p.color];
                if (profile.blend === 0) {
                  for (let lane = 0; lane < 3; lane++) color[lane] *= color[3];
                  color[3] = 1;
                }
                for (let vertex = i * 6; vertex < (i + 1) * 6; vertex++) {
                  bytes.set([rgba[2], rgba[1], rgba[0], rgba[3]], vertex * 4);
                  oldTint.set(color, vertex * 4);
                  oldCurveBytes.set([oldRgba[2], oldRgba[1], oldRgba[0], oldRgba[3]], vertex * 4);
                  const actualLookup = mesh.geometry.getAttribute('particleLookupUv');
                  if (
                    actualLookup.getX(vertex) !== packet.lookup[0] ||
                    actualLookup.getY(vertex) !== packet.lookup[1]
                  )
                    throw Error('Actual lookup differs from C reference');
                  refLookup.setXY(vertex, ...packet.lookup);
                  oldLookup.setXY(vertex, p.phase, 0.5);
                }
              }
              const activeBytes = mesh.geometry.drawRange.count * 4;
              for (let i = 0; i < activeBytes; i++)
                if (tint.array[i] !== bytes[i])
                  throw Error('Actual batch byte differs from C reference');
              refGeometry.setAttribute(
                '_source_vertex_bgra',
                new THREE.Uint8BufferAttribute(bytes, 4, true)
              );
              oldGeometry.deleteAttribute('_source_vertex_bgra');
              oldGeometry.setAttribute(
                'particleTint',
                new THREE.Float32BufferAttribute(oldTint, 4)
              );
              oldCurveGeometry.setAttribute(
                '_source_vertex_bgra',
                new THREE.Uint8BufferAttribute(oldCurveBytes, 4, true)
              );
              const refMaterial = mesh.material.clone(),
                oldMaterial = mesh.material.clone(),
                oldCurveMaterial = mesh.material.clone(),
                candidate = mesh.clone(),
                ref = mesh.clone(),
                old = mesh.clone(),
                oldCurve = mesh.clone();
              delete oldMaterial.defines.VERTEX_BGRA;
              ref.geometry = refGeometry;
              ref.material = refMaterial;
              old.geometry = oldGeometry;
              old.material = oldMaterial;
              candidateScene.add(candidate);
              refScene.add(ref);
              oldScene.add(old);
              oldCurve.geometry = oldCurveGeometry;
              oldCurve.material = oldCurveMaterial;
              oldCurveScene.add(oldCurve);
              // Framing uses only active vertices: batch capacity can retain old positions.
              const bounds = new THREE.Box3(),
                position = mesh.geometry.getAttribute('position'),
                point = new THREE.Vector3();
              for (let v = 0; v < mesh.geometry.drawRange.count; v++)
                bounds.expandByPoint(point.fromBufferAttribute(position, v).add(mesh.position));
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
                    for (const material of [
                      mesh.material,
                      refMaterial,
                      oldMaterial,
                      oldCurveMaterial,
                    ])
                      material.blending = blend === 'raw' ? THREE.NoBlending : THREE.CustomBlending;
                    try {
                      renderer.setRenderTarget(target);
                      for (const s of [candidateScene, refScene, oldScene, oldCurveScene]) {
                        renderer.clear();
                        renderer.render(s, camera);
                        const b = new Uint8Array(size * size * 4);
                        renderer.readRenderTargetPixels(target, 0, 0, size, size, b);
                        buffers.push(b);
                      }
                      let differences = 0,
                        delta = 0,
                        oldDifferences = 0,
                        oldCurveDifferences = 0,
                        rgb = 0;
                      for (let i = 0; i < buffers[0].length; i++) {
                        const d = Math.abs(buffers[0][i] - buffers[1][i]);
                        if (d) differences++;
                        delta = Math.max(delta, d);
                        if (buffers[2][i] !== buffers[1][i]) oldDifferences++;
                        if (buffers[3][i] !== buffers[1][i]) oldCurveDifferences++;
                        if (i % 4 !== 3 && buffers[1][i]) rgb++;
                      }
                      changed += differences;
                      maxDelta = Math.max(maxDelta, delta);
                      oldChanged += oldDifferences;
                      oldCurveChanged += oldCurveDifferences;
                      if (rgb) nonempty++;
                      rows.push({
                        sample,
                        direction,
                        blend,
                        size,
                        particles: raw[sample].length,
                        changedBytes: differences,
                        maxDelta: delta,
                        oldChangedBytes: oldDifferences,
                        oldCurveChangedBytes: oldCurveDifferences,
                        sourceCase: cases[sample],
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
                oldCurveGeometry.dispose();
                refMaterial.dispose();
                oldMaterial.dispose();
                oldCurveMaterial.dispose();
              }
            }
          return {
            rows,
            changed,
            maxDelta,
            oldChanged,
            oldCurveChanged,
            nonempty,
            glError: renderer.getContext().getError(),
          };
        } finally {
          world.units = [];
          controller.update(world, 1, new THREE.Camera(), models);
          renderer.dispose();
        }
      },
      { profileIndex, cases, raw, packets, oldPackets, profile }
    );
    writeFileSync(
      info.outputPath('gromp-ray-pixels.json'),
      JSON.stringify({ ...reading, errors }, null, 2)
    );
    expect(reading.rows).toHaveLength(cases.length * 12);
    expect(reading.changed).toBe(0);
    expect(reading.maxDelta).toBe(0);
    expect(reading.nonempty).toBe(cases.length * 12);
    expect(reading.oldChanged).toBeGreaterThan(0);
    if (profileIndex === 7) expect(reading.oldCurveChanged).toBeGreaterThan(0);
    else expect(reading.oldCurveChanged).toBe(0);
    expect(reading.glError).toBe(0);
    expect(errors).toEqual([]);
  });
