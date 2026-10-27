import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { remainingRayReference } from '../tools/qa/lib/prepare-remaining-ray-reference.mjs';

for (const [family, profileIndex] of [
  ['W', 3],
  ['W', 8],
  ['AA', 9],
  ['Q', 3],
  ['R', 18],
] as const)
  test(`${family} ray ${profileIndex} uses native byte colors and half lookup coordinates`, async ({
    page,
  }, info) => {
    test.setTimeout(180000);
    const reference = await remainingRayReference(info.outputPath('reference')),
      before = await import(pathToFileURL(reference.module).href),
      data = {
        profiles:
          family === 'W'
            ? before.ECLIPSE_PROFILES
            : family === 'AA'
              ? before.aaData.profiles
              : family === 'Q'
                ? before.qProfiles
                : before.rProfiles,
      },
      profile = data.profiles[profileIndex],
      aaRecord = {
        startTick: 100,
        endTick: 160,
        releaseTick: 129,
        poseStopTick: null,
        impact: { tick: 129, radius: 30 },
        kind: 'crit',
      },
      qRecord = [
        {
          startTick: 100,
          attacks: [
            { startTick: 110, impact: { tick: 129, point: { x: 100, y: 30 }, facing: 1.2 } },
          ],
        },
      ],
      rRecord = {
        startTick: 100,
        targetId: 2,
        facing: 0.2,
        point: { x: 200, y: 0 },
        releaseTick: 127,
        stopTick: null,
        killed: true,
      },
      sample = (time: number) =>
        family === 'W'
          ? before.eclipseParticles(profile.role, 91, time)
          : family === 'AA'
            ? before.garenAAParticles(91, [aaRecord], 129 + time * 60)
            : family === 'Q'
              ? before.garenQImpactParticles(91, qRecord, 129 + time * 60)
              : before.garenJusticeParticles(91, rRecord, 127 + time * 60),
      born = Math.max(1, Math.ceil((profile.delay ?? 0) * 60 - 1e-5)) / 60,
      probe = sample(born + 1e-6).find((p) => p.profileIndex === profileIndex),
      life = probe.life,
      times = [0.111, 0.137, 0.173, 0.357, 0.519, 0.623, 0.719].map((phase) => born + phase * life),
      raw = times.map((time) => sample(time).find((p) => p.profileIndex === profileIndex));
    expect(raw.every(Boolean)).toBe(true);
    const input = info.outputPath('packet-inputs.json'),
      output = info.outputPath('packet-reference.json');
    writeFileSync(
      input,
      JSON.stringify(
        raw.map((p) => ({
          kind: 'ray',
          cell: p.uv?.cell ?? [0, 0],
          color: p.color,
          lookup: p.lookup,
          blend: profile.blend,
        }))
      )
    );
    execFileSync('python3', ['tools/qa/lib/primary-hit-packet-reference.py', input, output]);
    const packets = JSON.parse(readFileSync(output, 'utf8')),
      errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/ray-packet-probe', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Ray packet calibration</title>',
      })
    );
    await page.goto('/ray-packet-probe');
    const reading = await page.evaluate(
      async ({ times, packets, raw, profileIndex, family, aaRecord, qRecord, rRecord }) => {
        const THREE = await import('/node_modules/three/build/three.module.js'),
          { SourceParticleSurfaces } = await import('/src/render/source-particle-surfaces.ts'),
          module = await import(
            family === 'W'
              ? '/src/render/leona-eclipse-particles.ts'
              : family === 'AA'
                ? '/src/render/garen-aa-particles.ts'
                : family === 'Q'
                  ? '/src/render/garen-q-impact-particles.ts'
                  : '/src/render/garen-justice-particles.ts'
          ),
          { loadLuxParticleTextures } = await import('/src/render/lux-particle-textures.ts'),
          data = {
            profiles:
              family === 'W'
                ? module.ECLIPSE_PROFILES
                : (
                    await import(
                      family === 'AA'
                        ? '/src/content/garen-aa-particles.json'
                        : family === 'Q'
                          ? '/src/content/garen-q-impact-particles.json'
                          : '/src/content/garen-r-particles.json'
                    )
                  ).default,
          },
          profiles = family === 'AA' ? data.profiles.profiles : data.profiles,
          profile = profiles[profileIndex],
          sampler = (time) =>
            family === 'W'
              ? module.eclipseParticles(profile.role, 91, time)
              : family === 'AA'
                ? module.garenAAParticles(91, [aaRecord], 129 + time * 60)
                : family === 'Q'
                  ? module.garenQImpactParticles(91, qRecord, 129 + time * 60)
                  : module.garenJusticeParticles(91, rRecord, 127 + time * 60),
          white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1),
          textures = new Map([['', white]]),
          rows = [],
          renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
        const { writeRayColor } = await import('/src/render/particle-ray-color.ts');
        let policy;
        if (family === 'W') {
          const { LeonaEclipseSurfaces } = await import('/src/render/leona-eclipse-surfaces.ts'),
            controller = new LeonaEclipseSurfaces(new THREE.Scene(), new THREE.Scene(), () => 0);
          policy = (controller as any).program;
          controller.dispose();
        }
        white.needsUpdate = true;
        renderer.setPixelRatio(1);
        renderer.setClearColor(0, 0);
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
        const loaded = await loadLuxParticleTextures([
          profile.texture,
          ...(profile.lookup ? [profile.lookup] : []),
          ...(profile.multiplier?.texture ? [profile.multiplier.texture] : []),
        ]);
        for (const [path, texture] of loaded) {
          texture.wrapS = texture.wrapT =
            path && path !== profile.lookup ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
          textures.set(path, texture);
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
                particle = sampler(time).find((p) => p.profileIndex === profileIndex),
                scene = new THREE.Scene(),
                refScene = new THREE.Scene(),
                oldScene = new THREE.Scene(),
                camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1000),
                group = { key: 'ray-packet', startTick: 0, stopTick: 100, radius: 30, seed: 91 };
              if (!particle) throw Error('Missing live ray');
              if (JSON.stringify(particle.color) !== JSON.stringify(original.color))
                throw Error('Browser sampler differs from independent packet reference');
              camera.position.set(...direction);
              camera.lookAt(0, 0.5, 0);
              camera.updateMatrixWorld();
              let mesh, surfaces;
              if (family === 'W') {
                const program = {
                  name: 'ray packet',
                  attachment: 'fixture',
                  profiles,
                  assets: () => assets,
                  accepts: () => true,
                  vertexColor: policy.vertexColor,
                  material: policy.material,
                  tint: policy.tint,
                  records: () => [{ sourceId: 1, castTick: 0, group }],
                  particles: () => [particle],
                  birthVisible: () => true,
                  pose: () => ({ x: 0, y: 0, facing: 0 }),
                };
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
                mesh = [...surfaces.models.values()][0];
              } else {
                const materials = await import(
                    family === 'AA'
                      ? '/src/render/garen-basic-attacks.ts'
                      : family === 'Q'
                        ? '/src/render/garen-decisive-strike.ts'
                        : '/src/render/garen-justice.ts'
                  ),
                  factory =
                    materials[
                      family === 'AA'
                        ? 'createGarenAAMaterial'
                        : family === 'Q'
                          ? 'createGarenQImpactMaterial'
                          : 'createGarenJusticeMaterial'
                    ],
                  geometry = new THREE.PlaneGeometry(2, 2).toNonIndexed(),
                  attribute = new THREE.Uint8BufferAttribute(new Uint8Array(24), 4, true),
                  material = factory(
                    profileIndex,
                    assets.texture(profile.texture),
                    assets.texture(profile.lookup ?? '')
                  );
                geometry.setAttribute('_source_vertex_bgra', attribute);
                writeRayColor(attribute.array, 0, attribute.count, particle.color, profile.blend);
                material.uniforms.particleColor.value.set(1, 1, 1, 1);
                material.uniforms.lookupUv.value.fromArray(particle.lookup);
                mesh = new THREE.Mesh(geometry, material);
                scene.add(mesh);
                surfaces = {
                  dispose() {
                    geometry.dispose();
                    material.dispose();
                  },
                };
              }
              const bounds = new THREE.Box3().setFromObject(mesh),
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
              refMaterial.defines = {
                ...refMaterial.defines,
                [family === 'W' ? 'SOURCE_VERTEX_BGRA' : 'VERTEX_BGRA']: 1,
              };
              refMaterial.uniforms.particleColor.value.set(1, 1, 1, 1);
              refMaterial.uniforms.lookupUv.value.fromArray(packet.lookup);
              ref.geometry = refGeometry;
              ref.material = refMaterial;
              refScene.add(ref);
              delete oldMaterial.defines.SOURCE_VERTEX_BGRA;
              delete oldMaterial.defines.VERTEX_BGRA;
              delete oldMaterial.defines.VERTEX_TINT;
              oldMaterial.uniforms.particleColor.value.fromArray(original.color);
              if (profile.blend === 0) {
                const c = oldMaterial.uniforms.particleColor.value;
                c.x *= c.w;
                c.y *= c.w;
                c.z *= c.w;
                if (family !== 'W') c.w = 1;
              }
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
      { times, packets, raw, profileIndex, family, aaRecord, qRecord, rRecord }
    );
    writeFileSync(
      info.outputPath('remaining-ray-packet-pixels.json'),
      JSON.stringify({ ...reading, errors }, null, 2)
    );
    expect(reading.rows).toHaveLength(84);
    expect(reading.totalChanged).toBe(0);
    expect(reading.maxDelta).toBe(0);
    expect(reading.oldPolicyChangedBytes).toBeGreaterThan(0);
    expect(reading.nonemptyCases).toBe(84);
    expect(errors).toEqual([]);
    expect(reading.glError).toBe(0);
  });
