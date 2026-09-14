import { expect, test } from '@playwright/test';

test('charge ray material applies base rotation and per-particle multiplier translation', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js'),
      g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 3340, y: 0 } });
    w.step(30);
    g.view.render(w, 1, g.view.previousElapsed);
    const original = g.view.luxChargeRays.models.get(lux.id),
      material = original.material.clone();
    material.blending = T.NoBlending;
    const settings = ['base', 'mult'].map((k) => {
      const t = original.material.uniforms[k].value;
      return {
        raw: t.colorSpace === T.NoColorSpace,
        flip: t.flipY,
        linear: t.minFilter === T.LinearFilter && t.magFilter === T.LinearFilter,
      };
    });
    const texture = (bytes: number[], width = 1, height = 1) => {
      const t = new T.DataTexture(new Uint8Array(bytes), width, height);
      t.needsUpdate = true;
      return t;
    };
    const white = texture([255, 255, 255, 255]),
      mult = texture([192, 160, 224, 192]),
      grid = texture([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255], 2, 2);
    const plane = new T.PlaneGeometry(2, 2),
      uv = plane.getAttribute('uv');
    for (let i = 0; i < 4; i++) uv.setXY(i, 0.25, 0.25);
    plane.setAttribute(
      'particleColor',
      new T.BufferAttribute(
        new Float32Array(Array.from({ length: 4 }, () => [0.5, 0.75, 0.25, 0.5]).flat()),
        4
      )
    );
    const offset = new T.BufferAttribute(new Float32Array(8), 2);
    plane.setAttribute('particleOffset', offset);
    const renderer = new T.WebGLRenderer(),
      target = new T.WebGLRenderTarget(1, 1),
      scene = new T.Scene(),
      camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    renderer.setSize(1, 1);
    camera.position.z = 5;
    scene.add(new T.Mesh(plane, material));
    renderer.setRenderTarget(target);
    const pixels = [];
    for (let variant = 0; variant < 3; variant++) {
      material.uniforms.base.value = variant === 0 ? grid : white;
      material.uniforms.mult.value = variant === 0 ? mult : grid;
      for (let i = 0; i < 4; i++) offset.setXY(i, variant === 2 ? 0.125 : 0, 0);
      offset.needsUpdate = true;
      renderer.render(scene, camera);
      const pixel = new Uint8Array(4);
      renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
      pixels.push([...pixel]);
    }
    renderer.setRenderTarget(null);
    renderer.dispose();
    target.dispose();
    plane.dispose();
    material.dispose();
    white.dispose();
    mult.dispose();
    grid.dispose();
    return { pixels, settings };
  });
  expect(result.settings).toEqual(
    Array.from({ length: 2 }, () => ({ raw: true, flip: false, linear: true }))
  );
  const expected = [
    [0, 120, 0, 96],
    [127.5, 0, 0, 127.5],
    [0, 191.25, 0, 127.5],
  ];
  result.pixels.forEach((pixel, i) =>
    pixel.forEach((channel, j) => expect(Math.abs(channel - expected[i][j])).toBeLessThanOrEqual(1))
  );
});
