import { expect, test } from '@playwright/test';

test('ParticleSurfaceBatcher renders pixel-identical output in WebGL2 while collapsing draw calls', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 120_000 });

  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { ParticleSurfaceBatcher } = await import('/src/render/particle-surface-batch.ts');
    const { createLeonaEclipseSurfaceMaterial } =
      await import('/src/render/leona-eclipse-surface-material.ts');
    const { createParticleColorProductMaterial } =
      await import('/src/render/particle-color-product.ts');

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setSize(64, 64);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    const target = new THREE.WebGLRenderTarget(64, 64);
    renderer.setRenderTarget(target);

    const makeTex = (rgba: number[]) => {
      const t = new THREE.DataTexture(new Uint8Array(rgba), 2, 2);
      t.minFilter = t.magFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
      return t;
    };
    const baseTex = makeTex([
      255, 180, 90, 220, 90, 210, 255, 180, 200, 80, 255, 240, 255, 255, 140, 160,
    ]);
    const rampTex = makeTex([
      255, 120, 60, 255, 80, 200, 255, 255, 255, 220, 120, 255, 180, 140, 255, 255,
    ]);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101820);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const quad = new THREE.PlaneGeometry(1.4, 1.4);
    for (let i = 0; i < 6; i++) {
      const m = createLeonaEclipseSurfaceMaterial({
        kind: 'quad',
        texture: baseTex,
        lookup: rampTex,
      });
      Object.assign(m, {
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneFactor,
      });
      m.uniforms.particleColor.value.set(0.4 + i * 0.08, 0.7 - i * 0.05, 0.9, 0.65);
      m.uniforms.lookupUv.value.set(0.15 * i, 0.8 - 0.1 * i);
      m.uniforms.sourceUvTransform.value.set(1.2, 0.1 * i, 0.05 * i, 0, 0.9, 0.2, 0, 0, 1);
      const mesh = new THREE.Mesh(quad, m);
      mesh.frustumCulled = false;
      mesh.position.set(-1.2 + i * 0.45, -0.8 + i * 0.28, -i * 0.2);
      mesh.rotation.set(0.1 * i, 0.15 * i, 0.3 * i);
      scene.add(mesh);
    }

    for (let i = 0; i < 5; i++) {
      const m = createParticleColorProductMaterial(baseTex, rampTex);
      Object.assign(m, {
        transparent: true,
        depthWrite: false,
        depthTest: true,
        forceSinglePass: true,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneFactor,
      });
      m.uniforms.particleColor.value.set(0.8, 0.3 + i * 0.1, 0.5, 0.7);
      m.uniforms.lookupUv.value.set(0.2 + i * 0.12, 0.4);
      m.uniforms.sourceUvOffset.value.set(0.1 * i, -0.15 * i);
      const mesh = new THREE.Mesh(quad, m);
      mesh.frustumCulled = false;
      mesh.position.set(1.0 - i * 0.4, -0.6 + i * 0.3, 0.5 - i * 0.15);
      mesh.rotation.set(0, 0, -0.25 * i);
      scene.add(mesh);
    }

    // Off-screen particle that should be culled to 0 draw calls
    const offscreenMat = createParticleColorProductMaterial(baseTex, rampTex);
    Object.assign(offscreenMat, {
      transparent: true,
      depthWrite: false,
      depthTest: true,
      forceSinglePass: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
    });
    const offscreen = new THREE.Mesh(quad, offscreenMat);
    offscreen.frustumCulled = false;
    offscreen.position.set(100, 100, 0);
    scene.add(offscreen);

    renderer.render(scene, camera);
    const unbatchedCalls = renderer.info.render.calls;
    const unbatchedPixels = new Uint8Array(64 * 64 * 4);
    renderer.readRenderTargetPixels(target, 0, 0, 64, 64, unbatchedPixels);

    const batcher = new ParticleSurfaceBatcher(scene);
    batcher.prepare(camera, false);
    renderer.render(scene, camera);
    const batchedCalls = renderer.info.render.calls;
    const batchedPixels = new Uint8Array(64 * 64 * 4);
    renderer.readRenderTargetPixels(target, 0, 0, 64, 64, batchedPixels);
    batcher.restore();

    let maxDiff = 0;
    let nonBackgroundPixels = 0;
    for (let i = 0; i < unbatchedPixels.length; i += 4) {
      if (
        unbatchedPixels[i] !== 16 ||
        unbatchedPixels[i + 1] !== 24 ||
        unbatchedPixels[i + 2] !== 32
      )
        nonBackgroundPixels++;
      for (let c = 0; c < 4; c++) {
        maxDiff = Math.max(maxDiff, Math.abs(unbatchedPixels[i + c] - batchedPixels[i + c]));
      }
    }

    batcher.dispose();
    target.dispose();
    baseTex.dispose();
    rampTex.dispose();
    quad.dispose();
    renderer.dispose();
    renderer.forceContextLoss();

    return { unbatchedCalls, batchedCalls, maxDiff, nonBackgroundPixels };
  });

  expect(result.nonBackgroundPixels).toBeGreaterThan(500);
  expect(result.unbatchedCalls).toBe(12);
  expect(result.batchedCalls).toBe(2);
  expect(result.maxDiff).toBeLessThanOrEqual(1);
});
