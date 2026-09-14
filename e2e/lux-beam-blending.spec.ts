import { expect, test } from '@playwright/test';
import { LUX_BEAM_LAYERS } from '../src/content/lux-beam-layers';

test('all Final Spark layers use source-alpha factors on both framebuffer channels', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const results = await page.evaluate(async () => {
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
    const renderer = new THREE.WebGLRenderer({ antialias: false, premultipliedAlpha: false });
    renderer.setSize(1, 1);
    renderer.setClearColor(new THREE.Color().setRGB(0.1, 0.2, 0.3), 0.25);
    const buffer = new THREE.WebGLRenderTarget(1, 1);
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.needsUpdate = true;
    const plane = new THREE.PlaneGeometry(2, 2);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 5;
    const results = [];
    for (const source of group.children) {
      const material = source.material.clone();
      material.uniforms.base.value = white;
      material.uniforms.mult.value = white;
      material.uniforms.tint.value.set(0.8, 0.4, 0.2, 0.5);
      const mesh = new THREE.Mesh(plane, material);
      scene.add(mesh);
      renderer.setRenderTarget(buffer);
      renderer.render(scene, camera);
      const pixel = new Uint8Array(4);
      renderer.readRenderTargetPixels(buffer, 0, 0, 1, 1, pixel);
      results.push({ name: source.name, pixel: [...pixel] });
      scene.remove(mesh);
      material.dispose();
    }
    renderer.setRenderTarget(null);
    plane.dispose();
    white.dispose();
    buffer.dispose();
    renderer.dispose();
    return results;
  });
  expect(results).toHaveLength(6);
  for (const result of results) {
    const layer = LUX_BEAM_LAYERS.find((layer) => layer.name === result.name)!;
    const expected = layer.blend === 4 ? [0.5, 0.4, 0.4, 0.5] : [0.45, 0.3, 0.25, 0.375];
    result.pixel.forEach((value, channel) =>
      expect(
        Math.abs(value - expected[channel] * 255),
        `${result.name} channel ${channel}: ${result.pixel}`
      ).toBeLessThanOrEqual(1.5)
    );
  }
});
