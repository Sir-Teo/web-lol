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
    const spatialMask = new THREE.DataTexture(
      new Uint8Array([0, 0, 0, 32, 0, 0, 0, 96, 0, 0, 0, 160, 0, 0, 0, 224]),
      2,
      2
    );
    spatialMask.needsUpdate = true;
    const results = [],
      spatial = [];
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
      material.uniforms.erosionMap.value = spatialMask;
      material.uniforms.erosionDrive.value = 0.5;
      const uv = plane.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.25, 0.25);
      uv.needsUpdate = true;
      for (const axis of [0, 1])
        for (const translation of [-2.5, -1.5, -0.5, 0, 0.5, 1.5, 2.5]) {
          material.uniforms.offset.value.set(
            axis === 0 ? translation : 0,
            axis === 1 ? translation : 0
          );
          renderer.render(scene, camera);
          const pixel = new Uint8Array(4);
          renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
          spatial.push({ name: source.name, axis, translation, pixel: [...pixel] });
        }
      scene.remove(mesh);
      material.dispose();
    }
    renderer.setRenderTarget(null);
    plane.dispose();
    white.dispose();
    mask.dispose();
    spatialMask.dispose();
    target.dispose();
    renderer.dispose();
    return { ramps: results, spatial };
  });
  expect(results.ramps).toHaveLength(45);
  for (const result of results.ramps) {
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
  expect(results.spatial).toHaveLength(42);
  for (const result of results.spatial) {
    // The source transform transposes translation axes before mirrored sampling.
    const coordinate = 0.25 + result.translation;
    const tile = Math.floor(coordinate),
      fraction = coordinate - tile;
    const folded = Math.abs(tile % 2) === 1 ? 1 - fraction : fraction;
    const column = result.axis === 1 ? Math.floor(folded * 2) : 0;
    const row = result.axis === 0 ? Math.floor(folded * 2) : 0;
    const maskAlpha = [32, 96, 160, 224][row * 2 + column] / 255;
    const expected = 255 * (1 - Math.min(1, Math.max(0, (0.5 - maskAlpha) / 0.30000001192092896)));
    expect(result.pixel.slice(0, 3)).toEqual([255, 255, 255]);
    expect(Math.abs(result.pixel[3] - expected), JSON.stringify(result)).toBeLessThanOrEqual(1);
  }
});
