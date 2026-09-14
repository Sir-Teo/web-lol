import { expect, test } from '@playwright/test';
test('all ground charge materials retain source UV rotation, multiplier scale and phase', async ({
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
    const models = [...g.view.luxGroundCharge.models.values()] as any[];
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
    const geometry = new T.PlaneGeometry(2, 2);
    for (let i = 0; i < 4; i++) geometry.getAttribute('uv').setXY(i, 0.25, 0.25);
    const mesh = new T.Mesh(geometry);
    scene.add(mesh);
    const pixels = [];
    for (const m of models) {
      const material = m.material.clone();
      material.blending = T.NoBlending;
      mesh.material = material;
      material.uniforms.base.value = base;
      material.uniforms.mult.value = mult;
      material.uniforms.tint.value.set(0.5, 0.75, 0.25, 0.5);
      renderer.render(scene, camera);
      const pixel = new Uint8Array(4);
      renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
      material.uniforms.base.value = white;
      material.uniforms.mult.value = grid;
      material.uniforms.tint.value.set(1, 1, 1, 1);
      renderer.render(scene, camera);
      const phase = new Uint8Array(4);
      renderer.readRenderTargetPixels(target, 0, 0, 1, 1, phase);
      const offset = material.uniforms.offset.value.toArray(),
        scale = material.uniforms.multScale.value.toArray();
      const axes = scale.map((s: number, i: number) => {
        const at = -0.25 * s + 0.5 + offset[i];
        return Math.floor((at - Math.floor(at)) * 4);
      });
      pixels.push({
        turn: material.uniforms.turn.value,
        pixel: [...pixel],
        phase: [...phase],
        expected: [(axes[0] + 1) * 40, (axes[1] + 1) * 40, 128, 255],
      });
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
  expect(result.pixels).toHaveLength(14);
  for (const p of result.pixels) {
    expect(p.turn).toBeCloseTo(Math.PI / 2, 10);
    p.pixel.forEach((v, i) => expect(Math.abs(v - [0, 120, 0, 96][i])).toBeLessThanOrEqual(1));
    expect(p.phase).toEqual(p.expected);
  }
});
