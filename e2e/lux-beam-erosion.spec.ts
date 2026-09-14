import { expect, test } from '@playwright/test';

test('post-beam erosion cuts alpha using source map channel and feather ramps', async ({
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
    const target = new THREE.WebGLRenderTarget(1, 1),
      plane = new THREE.PlaneGeometry(2, 2),
      scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 5;
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.needsUpdate = true;
    const bytes = new Uint8Array([0, 0, 0, 0]),
      mask = new THREE.DataTexture(bytes, 1, 1);
    const results = [];
    for (const source of group.children.filter((m: any) => m.name.startsWith('Beam_Post_'))) {
      const material = source.material.clone();
      material.blending = THREE.NoBlending;
      material.uniforms.base.value = white;
      material.uniforms.mult.value = white;
      material.uniforms.tint.value.set(1, 1, 1, 1);
      material.uniforms.erosionMap.value = mask;
      const mesh = new THREE.Mesh(plane, material);
      scene.add(mesh);
      for (const alpha of [0, 128, 255])
        for (const drive of [0, 0.25, 0.5, 0.75, 1]) {
          bytes[3] = alpha;
          mask.needsUpdate = true;
          material.uniforms.erosionDrive.value = drive;
          renderer.setRenderTarget(target);
          renderer.render(scene, camera);
          const pixel = new Uint8Array(4);
          renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
          results.push({ name: source.name, alpha, drive, pixel: [...pixel] });
        }
      scene.remove(mesh);
      material.dispose();
    }
    renderer.setRenderTarget(null);
    plane.dispose();
    white.dispose();
    mask.dispose();
    target.dispose();
    renderer.dispose();
    return results;
  });
  expect(results).toHaveLength(45);
  for (const result of results) {
    const clamp = (x: number) => Math.min(1, Math.max(0, x)),
      v = result.alpha / 255,
      f = 0.30000001192092896;
    const kept = clamp((result.drive - v + 1.5) / f) - clamp((result.drive - v) / f);
    expect(result.pixel.slice(0, 3)).toEqual([255, 255, 255]);
    expect(
      Math.abs(result.pixel[3] - 255 * kept),
      `${result.name} ${result.alpha} ${result.drive}`
    ).toBeLessThanOrEqual(1);
  }
});
