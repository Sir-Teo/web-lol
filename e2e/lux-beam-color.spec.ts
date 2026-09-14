import { expect, test } from '@playwright/test';

test('Final Spark preserves authored texture products on the output canvas', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 3340, y: 0 } });
    w.step(30);
    g.view.render(w, 1, g.view.previousElapsed);
    const group = [...g.view.luxBeams.models.values()][0] as any;
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(1, 1);
    const source = new THREE.DataTexture(new Uint8Array([128, 96, 64, 128]), 1, 1);
    const mult = new THREE.DataTexture(new Uint8Array([192, 160, 224, 192]), 1, 1);
    source.needsUpdate = mult.needsUpdate = true;
    const plane = new THREE.PlaneGeometry(2, 2),
      scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 5;
    const results = [];
    for (const original of group.children) {
      const textureSettings = ['base', 'mult'].map((key) => {
        const texture = original.material.uniforms[key].value;
        return {
          raw: texture.colorSpace === THREE.NoColorSpace,
          flipY: texture.flipY,
          linear:
            texture.minFilter === THREE.LinearFilter && texture.magFilter === THREE.LinearFilter,
        };
      });
      const material = original.material.clone();
      material.blending = THREE.NoBlending;
      material.uniforms.base.value = source;
      material.uniforms.mult.value = mult;
      material.uniforms.tint.value.set(0.5, 0.75, 0.25, 0.5);
      const mesh = new THREE.Mesh(plane, material);
      scene.add(mesh);
      renderer.render(scene, camera);
      const pixel = new Uint8Array(4),
        gl = renderer.getContext();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      results.push({ name: original.name, textureSettings, pixel: [...pixel] });
      scene.remove(mesh);
      material.dispose();
    }
    plane.dispose();
    source.dispose();
    mult.dispose();
    renderer.dispose();
    return { results };
  });
  expect(result.results).toHaveLength(6);
  const source = [128, 96, 64, 128],
    mult = [192, 160, 224, 192],
    tint = [0.5, 0.75, 0.25, 0.5];
  for (const layer of result.results) {
    for (const texture of layer.textureSettings)
      expect(texture).toEqual({ raw: true, flipY: false, linear: true });
    layer.pixel.forEach((value, channel) =>
      expect(
        Math.abs(value - ((source[channel] * mult[channel]) / 255) * tint[channel]),
        `${layer.name} channel ${channel}`
      ).toBeLessThanOrEqual(1)
    );
  }
});
