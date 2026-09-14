import { LUX_BEAM_LAYERS } from '../src/content/lux-beam-layers';
import { expect, test } from '@playwright/test';

test('Final Spark transposes both texture translation axes after beam placement', async ({
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
    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(1, 1);
    const buffer = new THREE.WebGLRenderTarget(1, 1);
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.needsUpdate = true;
    const grid = new THREE.DataTexture(
      new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]),
      2,
      2
    );
    grid.needsUpdate = true;
    const plane = new THREE.PlaneGeometry(2, 2);
    const uv = plane.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.25, 0.25);
    const scene = new THREE.Scene(),
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 5;
    const results = [];
    for (const source of group.children) {
      const material = source.material.clone();
      material.blending = THREE.NoBlending;
      material.uniforms.tint.value.set(1, 1, 1, 1);
      const mesh = new THREE.Mesh(plane, material);
      scene.add(mesh);
      for (const layer of ['base', 'mult']) {
        material.uniforms.base.value = layer === 'base' ? grid : white;
        material.uniforms.mult.value = layer === 'mult' ? grid : white;
        for (const translation of [
          [0, 0],
          [0.5, 0],
          [0, 0.5],
        ]) {
          material.uniforms.offset.value.set(0, 0);
          material.uniforms.multOffset.value.set(0, 0);
          material.uniforms[layer === 'base' ? 'offset' : 'multOffset'].value.fromArray(
            translation
          );
          renderer.setRenderTarget(buffer);
          renderer.render(scene, camera);
          const pixel = new Uint8Array(4);
          renderer.readRenderTargetPixels(buffer, 0, 0, 1, 1, pixel);
          results.push({ name: source.name, layer, translation, pixel: [...pixel] });
        }
      }
      scene.remove(mesh);
      material.dispose();
    }
    renderer.setRenderTarget(null);
    plane.dispose();
    white.dispose();
    grid.dispose();
    buffer.dispose();
    renderer.dispose();
    return results;
  });
  expect(results).toHaveLength(LUX_BEAM_LAYERS.length * 6);
  for (const result of results) {
    const [along, across] = result.translation;
    const profile = LUX_BEAM_LAYERS.find((p) => p.name === result.name)!;
    const divisions = result.layer === 'base' ? profile.texDiv : profile.texDivMult;
    const x = Math.floor(((0.25 + across) * 2) / Math.max(1, Math.round(divisions[0])));
    const y = Math.floor(((0.25 + along) * 2) / Math.max(1, Math.round(divisions[1])));
    const expected = [
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 255],
      [255, 255, 255, 255],
    ][y * 2 + x];
    expect(result.pixel, `${result.name} ${result.layer} ${result.translation}`).toEqual(expected);
  }
});
