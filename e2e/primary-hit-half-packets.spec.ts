import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('primary quad packets match shader-side frame flooring with authored GPU textures', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.route('**/packet-probe', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Quad packet probe</title>',
    })
  );
  await page.goto('/packet-probe');
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js'),
      { SourceParticleSurfaces } = await import('/src/render/source-particle-surfaces.ts'),
      { primaryHitParticles } = await import('/src/render/masteryi-primary-hit-particles.ts'),
      { luxHoopChance } = await import('/src/render/lux-hoop-particles.ts'),
      { masterYiTextures } = await import('/src/render/masteryi-source-textures.ts'),
      data = (await import('/src/content/masteryi-primary-hit-particles.json')).default,
      textures = new Map(),
      white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1),
      rows = [],
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    white.needsUpdate = true;
    renderer.setPixelRatio(1);
    renderer.setClearColor(0, 0);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    const assets = {
      texture(path) {
        const texture = textures.get(path);
        if (!texture) throw Error('Missing packet texture');
        return texture;
      },
      mesh() {
        throw Error('Unexpected mesh');
      },
    };
    let maximumDelta = 0,
      changedBytes = 0,
      oldPolicyChangedBytes = 0;
    try {
      for (const f of [
        { seed: 312, ordinal: 5, index: 0, age: 0, mode: 'atlas' },
        { seed: 47, ordinal: 3, index: 3, age: 0, mode: 'atlas' },
        { seed: 144, ordinal: 1, index: 2, age: 0.998, mode: 'atlas' },
        { seed: 91, ordinal: 1, index: 0, age: 0.08 - 1 / 60, mode: 'lookup' },
        { seed: 91, ordinal: 1, index: 2, age: 0.08 - 1 / 60, mode: 'lookup' },
      ]) {
        const time = 1 / 60 + f.age,
          profile = data.profiles[f.index],
          particle = primaryHitParticles(f.seed, time, 'attack1', 30).find(
            (p) => p.profileIndex === f.index && p.ordinal === f.ordinal
          );
        if (!particle) throw Error('Missing live packet boundary particle');
        for (const path of [profile.texture, profile.lookup]) {
          if (textures.has(path)) continue;
          const asset = data.textures.find((a) => a.url === path);
          if (!asset) throw Error('Missing source image');
          textures.set(path, await masterYiTextures.load(asset, path === profile.lookup));
        }
        const scene = new THREE.Scene(),
          camera = new THREE.OrthographicCamera(-1.05, 1.05, 1.05, -1.05, 0.1, 10),
          group = { key: 'packet', startTick: 0, stopTick: 100, radius: 30, seed: f.seed },
          program = {
            name: 'packet',
            attachment: 'packet',
            profiles: data.profiles,
            assets: () => assets,
            accepts: () => true,
            records: () => [{ sourceId: 1, castTick: 0, group }],
            particles: () => [particle],
            birthVisible: () => true,
            pose: () => ({ x: 0, y: 0, facing: 0 }),
          },
          surface = new SourceParticleSurfaces(scene, new THREE.Scene(), () => 0, program, assets);
        camera.position.set(0, 0, 3);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        surface.update({ tick: time * 60 + 1, winner: null, pointVisible: () => true }, 1, camera);
        const mesh = [...surface.models.values()][0];
        mesh.position.set(0, 0, 0);
        mesh.quaternion.identity();
        mesh.scale.set(1, 1, 1);
        // Normalize tint, blending and size to inspect the retained material's
        // UV/lookup arithmetic even at the final sub-tick of a fading particle.
        mesh.material.uniforms.particleColor.value.set(1, 1, 1, 1);
        mesh.material.blending = THREE.NoBlending;
        mesh.material.depthTest = false;
        const referenceMaterial = mesh.material.clone(),
          oldMaterial = mesh.material.clone(),
          referenceMesh = mesh.clone(),
          oldMesh = mesh.clone(),
          referenceScene = new THREE.Scene(),
          oldScene = new THREE.Scene(),
          emitter = f.seed ^ Math.imul(f.index + 1, 0x85ebca6b),
          roll = luxHoopChance(emitter ^ 0x27d4eb2d, f.ordinal),
          animation =
            profile.uv.frameRate > 0
              ? Math.fround(Math.fround(particle.age) * profile.uv.frameRate)
              : 0,
          continuous = Math.fround(
            profile.uv.startFrame +
              (Math.fround(
                (profile.uv.randomStart ? Math.fround(roll) * profile.uv.frames : 0) + animation
              ) %
                profile.uv.frames)
          ),
          packed = Math.f16round(continuous),
          columns = profile.uv.divisions[0],
          height = profile.uv.divisions[1],
          oldFrame =
            (profile.uv.startFrame +
              (profile.uv.randomStart ? Math.floor(roll * profile.uv.frames) : 0) +
              Math.floor(particle.age * profile.uv.frameRate)) %
            (columns * height);
        referenceMaterial.uniforms.packetFrame = { value: packed };
        referenceMaterial.uniforms.packetTextureInfo = {
          value: new THREE.Vector3(columns, 1 / columns, 1 / height),
        };
        referenceMaterial.vertexShader =
          'uniform float packetFrame;\nuniform vec3 packetTextureInfo;\n' +
          referenceMaterial.vertexShader.replace(
            'sourceUv = (sourceUvTransform * vec3(uv, 1.0)).xy;',
            'float frame=floor(packetFrame);float row=floor(frame*packetTextureInfo.y);sourceUv=vec2((frame+uv.x-row*packetTextureInfo.x)*packetTextureInfo.y,(row+uv.y)*packetTextureInfo.z);'
          );
        referenceMaterial.uniforms.lookupUv.value.set(
          Math.f16round(Math.fround(particle.phase)),
          Math.f16round(Math.fround(roll))
        );
        oldMaterial.uniforms.sourceUvTransform.value.set(
          1 / columns,
          0,
          (oldFrame % columns) / columns,
          0,
          1 / height,
          Math.floor(oldFrame / columns) / height,
          0,
          0,
          1
        );
        oldMaterial.uniforms.lookupUv.value.set(particle.phase, roll);
        // Atlas boundaries occur at black LUT endpoints. A neutral lookup
        // isolates authored atlas texels; separate midlife rows retain the LUT.
        if (f.mode === 'atlas')
          for (const material of [mesh.material, referenceMaterial, oldMaterial])
            material.uniforms.particleColorTexture.value = white;
        referenceMesh.material = referenceMaterial;
        oldMesh.material = oldMaterial;
        referenceScene.add(referenceMesh);
        oldScene.add(oldMesh);
        try {
          for (const size of [64, 127, 256]) {
            renderer.setSize(size, size);
            const target = new THREE.WebGLRenderTarget(size, size),
              buffers = [];
            try {
              renderer.setRenderTarget(target);
              for (const s of [scene, referenceScene, oldScene]) {
                renderer.clear();
                renderer.render(s, camera);
                const bytes = new Uint8Array(size * size * 4);
                renderer.readRenderTargetPixels(target, 0, 0, size, size, bytes);
                buffers.push(bytes);
              }
              let changed = 0,
                delta = 0,
                oldChanged = 0,
                nonzero = 0,
                oldNonzero = 0;
              for (let i = 0; i < buffers[0].length; i++) {
                const d = Math.abs(buffers[0][i] - buffers[1][i]);
                if (d) changed++;
                delta = Math.max(delta, d);
                if (buffers[2][i] !== buffers[1][i]) oldChanged++;
                if (i % 4 !== 3 && buffers[1][i]) nonzero++;
                if (i % 4 !== 3 && buffers[2][i]) oldNonzero++;
              }
              changedBytes += changed;
              oldPolicyChangedBytes += oldChanged;
              maximumDelta = Math.max(maximumDelta, delta);
              rows.push({
                ...f,
                size,
                packedFrame: packed,
                cell: particle.uv.cell,
                lookup: particle.lookup,
                nonzeroRgb: nonzero,
                oldNonzeroRgb: oldNonzero,
                changedBytes: changed,
                oldPolicyChangedBytes: oldChanged,
                maxDelta: delta,
              });
            } finally {
              renderer.setRenderTarget(null);
              target.dispose();
            }
          }
        } finally {
          referenceMaterial.dispose();
          oldMaterial.dispose();
          surface.dispose();
        }
      }
      return {
        rows,
        changedBytes,
        oldPolicyChangedBytes,
        maximumDelta,
        glError: renderer.getContext().getError(),
      };
    } finally {
      renderer.dispose();
      white.dispose();
      for (const t of textures.values()) t.dispose();
    }
  });
  writeFileSync(info.outputPath('quad-packet-pixels.json'), JSON.stringify(result, null, 2));
  expect(result.rows).toHaveLength(15);
  expect(result.changedBytes).toBe(0);
  expect(result.maximumDelta).toBe(0);
  expect(result.oldPolicyChangedBytes).toBeGreaterThan(0);
  expect(result.glError).toBe(0);
  for (const row of result.rows) expect(row.nonzeroRgb + row.oldNonzeroRgb).toBeGreaterThan(0);
});
