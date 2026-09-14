import { expect, test } from '@playwright/test';
test('ground warning shaders transpose base scroll and clamp the independent mask', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 3340, y: 0 } });
    w.step(30);
    g.view.render(w, 1, g.view.previousElapsed);
    const models = [...g.view.luxGroundWarnings.models.values()] as any[];
    const flags = models.every((m) =>
      ['base', 'mult'].every((k) => {
        const t = m.material.uniforms[k].value;
        return (
          t.colorSpace === T.NoColorSpace &&
          !t.flipY &&
          !t.generateMipmaps &&
          t.minFilter === T.LinearFilter &&
          t.magFilter === T.LinearFilter
        );
      })
    );
    const texture = (data: number[], width: number, height: number) => {
      const t = new T.DataTexture(new Uint8Array(data), width, height);
      t.needsUpdate = true;
      return t;
    };
    const base = texture(
        [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255],
        2,
        2
      ),
      mult = texture([192, 160, 224, 192], 1, 1),
      white = texture([255, 255, 255, 255], 1, 1),
      grid = texture(
        Array.from({ length: 16 }, (_, i) => [
          ((i % 4) + 1) * 40,
          (Math.floor(i / 4) + 1) * 40,
          128,
          255,
        ]).flat(),
        4,
        4
      );
    const renderer = new T.WebGLRenderer(),
      target = new T.WebGLRenderTarget(1, 1),
      scene = new T.Scene(),
      camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 5;
    renderer.setSize(1, 1);
    renderer.setRenderTarget(target);
    const geometry = new T.PlaneGeometry(2, 2),
      mesh = new T.Mesh(geometry);
    scene.add(mesh);
    const uv = (x: number, y: number) => {
      for (let i = 0; i < 4; i++) geometry.getAttribute('uv').setXY(i, x, y);
      geometry.getAttribute('uv').needsUpdate = true;
    };
    const read = () => {
      renderer.render(scene, camera);
      const p = new Uint8Array(4);
      renderer.readRenderTargetPixels(target, 0, 0, 1, 1, p);
      return [...p];
    };
    const pixels = [];
    for (const m of models) {
      const material = m.material.clone();
      material.blending = T.NoBlending;
      mesh.material = material;
      uv(0.25, 0.25);
      material.uniforms.base.value = base;
      material.uniforms.mult.value = mult;
      material.uniforms.tint.value.set(0.5, 0.75, 0.25, 0.5);
      const shifted = [];
      for (const offset of [0.5, 1.5, -0.5]) {
        material.uniforms.offset.value.set(offset, 0);
        shifted.push(read());
      }
      material.uniforms.base.value = white;
      material.uniforms.mult.value = grid;
      material.uniforms.tint.value.set(1, 1, 1, 1);
      const center = read();
      uv(1.25, -0.25);
      const edge = read();
      pixels.push({ shifted, center, edge });
      material.dispose();
    }
    renderer.setRenderTarget(null);
    renderer.dispose();
    target.dispose();
    geometry.dispose();
    for (const t of [base, mult, white, grid]) t.dispose();
    return { flags, pixels };
  });
  expect(result.flags).toBe(true);
  expect(result.pixels).toHaveLength(2);
  for (const p of result.pixels) {
    for (const pixel of p.shifted)
      pixel.forEach((v, i) => expect(Math.abs(v - [0, 0, 56, 96][i])).toBeLessThanOrEqual(1));
    expect(p.center).toEqual([80, 80, 128, 255]);
    expect(p.edge).toEqual([160, 40, 128, 255]);
  }
});
