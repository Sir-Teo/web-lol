import { expect, test } from '@playwright/test';

test('streak material multiplies raw textures and vertex tint with red-channel erosion', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const data = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 3340, y: 0 } });
    w.step(67);
    g.view.render(w, 1, g.view.previousElapsed);
    const original = [...g.view.luxStreaks.models.values()][0] as any;
    const settings = ['base', 'mult', 'erosion'].map((k) => {
      const t = original.material.uniforms[k].value;
      return {
        raw: t.colorSpace === T.NoColorSpace,
        flip: t.flipY,
        linear: t.minFilter === T.LinearFilter && t.magFilter === T.LinearFilter,
      };
    });
    const material = original.material.clone();
    material.blending = T.NoBlending;
    const texture = (rgba: number[]) => {
      const t = new T.DataTexture(new Uint8Array(rgba), 1, 1);
      t.needsUpdate = true;
      return t;
    };
    const base = texture([128, 96, 64, 128]),
      mult = texture([192, 160, 224, 192]),
      erosion = texture([64, 192, 128, 255]);
    material.uniforms.base.value = base;
    material.uniforms.mult.value = mult;
    material.uniforms.erosion.value = erosion;
    const plane = new T.PlaneGeometry(2, 2);
    plane.setAttribute(
      'particleColor',
      new T.BufferAttribute(
        new Float32Array(Array.from({ length: 4 }, () => [0.5, 0.75, 0.25, 0.5]).flat()),
        4
      )
    );
    plane.setAttribute('particleOffset', new T.BufferAttribute(new Float32Array(8), 2));
    const renderer = new T.WebGLRenderer(),
      target = new T.WebGLRenderTarget(1, 1),
      scene = new T.Scene(),
      camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    renderer.setSize(1, 1);
    camera.position.z = 5;
    scene.add(new T.Mesh(plane, material));
    renderer.setRenderTarget(target);
    const pixels = [];
    for (const drive of [0, 0.3]) {
      material.uniforms.drive.value = drive;
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
    base.dispose();
    mult.dispose();
    erosion.dispose();
    return { settings, pixels };
  });
  expect(data.settings).toEqual(
    Array.from({ length: 3 }, () => ({ raw: true, flip: false, linear: true }))
  );
  for (let index = 0; index < 2; index++)
    for (let channel = 0; channel < 4; channel++) {
      const erosion = index === 0 ? 1 : 1 - (0.3 - 64 / 255) / 0.1;
      const expected =
        (([128, 96, 64, 128][channel] * [192, 160, 224, 192][channel]) / 255) *
        [0.5, 0.75, 0.25, 0.5][channel] *
        (channel === 3 ? erosion : 1);
      expect(Math.abs(data.pixels[index][channel] - expected)).toBeLessThanOrEqual(1);
    }
});
