import { expect, test } from '@playwright/test';

test('ribbon GPU product preserves vertex RGBA and source-alpha additive blending', async ({
  page,
}) => {
  await page.goto('/tools/qa/lux-hoop-playback.html');
  await page.waitForFunction(() => (window as any).__HOOP__?.ready);
  const result = await page.evaluate(async () => {
    const threePath = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .find((name) => /\/three\.js(?:\?|$)/.test(name));
    if (!threePath) throw new Error('Missing loaded Three.js module');
    const materialPath = '/src/render/lux-attack-trails.ts';
    const T = await import(threePath);
    const { createLuxTrailMaterial } = await import(materialPath);
    const renderer = new T.WebGLRenderer({ premultipliedAlpha: false });
    renderer.setSize(1, 1);
    const target = new T.WebGLRenderTarget(1, 1);
    const scene = new T.Scene();
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;
    const texture = (bytes: number[]) => {
      const t = new T.DataTexture(new Uint8Array(bytes), 1, 1);
      t.colorSpace = T.NoColorSpace;
      t.needsUpdate = true;
      return t;
    };
    const base = texture([160, 80, 40, 128]),
      mult = texture([128, 160, 200, 192]);
    const material = createLuxTrailMaterial(base, mult);
    const geometry = new T.PlaneGeometry(2, 2);
    geometry.setAttribute(
      'particleLookupUv',
      new T.Float32BufferAttribute([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 2)
    );
    geometry.setAttribute(
      'particleTint',
      new T.Float32BufferAttribute(
        [0.5, 0.25, 0.75, 0.5, 0.5, 0.25, 0.75, 0.5, 0.5, 0.25, 0.75, 0.5, 0.5, 0.25, 0.75, 0.5],
        4
      )
    );
    scene.add(new T.Mesh(geometry, material));
    renderer.setRenderTarget(target);
    const read = () => {
      const p = new Uint8Array(4);
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(target, 0, 0, 1, 1, p);
      return [...p];
    };
    renderer.setClearColor(new T.Color(0.1, 0.2, 0.3), 0.25);
    const blended = read();
    material.blending = T.NoBlending;
    const raw = read();
    geometry.dispose();
    material.dispose();
    base.dispose();
    mult.dispose();
    target.dispose();
    renderer.dispose();
    return { raw, blended };
  });
  const product = [160 * 128 * 0.5, 80 * 160 * 0.25, 40 * 200 * 0.75, 128 * 192 * 0.5].map(
    (v) => v / (255 * 255)
  );
  product.forEach((v, i) =>
    expect(Math.abs(result.raw[i] - Math.round(v * 255))).toBeLessThanOrEqual(1)
  );
  const background = [0.1, 0.2, 0.3, 0.25];
  product.forEach((v, i) =>
    expect(
      Math.abs(result.blended[i] - Math.round((background[i] + v * product[3]) * 255))
    ).toBeLessThanOrEqual(1)
  );
});
