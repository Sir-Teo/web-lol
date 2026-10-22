import { expect, test, type Page } from '@playwright/test';

async function poses(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.view.render(g.world, 1, g.view.previousElapsed);
    return [...g.view.grompDeath.models.entries()].map(([key, m]: any) => ({
      key,
      name: m.name,
      position: m.position.toArray(),
      scale: m.scale.toArray(),
      quaternion: m.quaternion.toArray(),
      color: m.material.uniforms.particleColor.value.toArray(),
      lookup: m.material.uniforms.lookupUv.value.toArray(),
      attachment: m.userData.attachment,
      priority: m.renderOrder,
      depthTest: m.material.depthTest,
    }));
  });
}

test('source Gromp death quads contribute pixels, use the posed bone and restore exactly across fog/save/reload', async ({
  page,
}) => {
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (r) => {
    if (r.url().includes('/gromp-legacy/')) requests.push(r.url());
  });
  await page.goto('/?scene=fixture&encounter=gromp');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const gpu = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.step(480);
    const u = w.units.find((u: any) => u.kind === 'monster');
    w.damage(w.hero, u, 99999, 'true');
    w.step(7);
    v.recenter(w.hero);
    v.render(w, 1, v.previousElapsed);
    g.hud.update(60);
    const meshes = [...v.grompDeath.models.values()] as any[];
    const bone = v.models.get(u.id).root.getObjectByName('Buffbone_Glb_Ground_Loc');
    bone.updateWorldMatrix(true, false);
    const anchor = bone.getWorldPosition(bone.position.clone());
    const anchored = meshes.every(
      (m) =>
        Math.abs(m.position.x - anchor.x) < 1e-9 &&
        Math.abs(m.position.y - anchor.y - 0.8) < 1e-9 &&
        Math.abs(m.position.z - anchor.z) < 1e-9
    );
    const renderer = v.renderer,
      gl = renderer.getContext(),
      width = gl.drawingBufferWidth,
      height = gl.drawingBufferHeight;
    const read = () => {
      renderer.render(v.scene, v.camera);
      const bytes = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      return bytes;
    };
    const combined = read();
    meshes.forEach((m) => {
      m.visible = false;
    });
    const absent = read();
    const difference = (pixels: Uint8Array) => {
      let changed = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (
          pixels[i] !== absent[i] ||
          pixels[i + 1] !== absent[i + 1] ||
          pixels[i + 2] !== absent[i + 2]
        )
          changed++;
      return changed;
    };
    const individual = meshes.map((m) => {
      m.visible = true;
      const pixels = difference(read());
      m.visible = false;
      return { name: m.name, pixels };
    });
    meshes.forEach((m) => {
      m.visible = true;
    });
    read();
    return { combined: difference(combined), individual, anchored };
  });
  expect(gpu.anchored).toBe(true);
  expect(gpu.combined).toBeGreaterThan(60);
  expect(gpu.individual).toHaveLength(3);
  for (const layer of gpu.individual) expect(layer.pixels, layer.name).toBeGreaterThan(20);
  const original = await poses(page);
  expect(original.map((p) => p.name)).toEqual([
    'Gromp death flash',
    'Gromp death lightring',
    'Gromp death flashfrog',
  ]);
  expect(original.map((p) => p.priority)).toEqual([10, 7, 9]);
  expect(original.map((p) => p.depthTest)).toEqual([false, true, true]);
  expect(new Set(requests.map((url) => new URL(url).pathname)).size).toBe(4);
  await page.screenshot({ path: 'artifacts/gromp-death-pop.png' });
  const fog = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    let disposed = 0;
    for (const m of v.grompDeath.models.values())
      m.material.addEventListener('dispose', () => disposed++);
    const point = { x: w.hero.x, y: w.hero.y };
    Object.assign(w.hero, { x: -3000, y: -2000, previous: { x: -3000, y: -2000 } });
    v.render(w, 1, v.previousElapsed);
    const hidden = v.grompDeath.models.size;
    Object.assign(w.hero, { ...point, previous: { ...point } });
    v.render(w, 1, v.previousElapsed);
    return { hidden, disposed, restored: v.grompDeath.models.size };
  });
  expect(fog).toEqual({ hidden: 0, disposed: 3, restored: 3 });
  expect(await poses(page)).toEqual(original);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  expect(await poses(page)).toEqual(original);
  const retired = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      v = g.view;
    let disposed = 0;
    for (const m of v.grompDeath.models.values())
      m.material.addEventListener('dispose', () => disposed++);
    g.world.step(20);
    v.render(g.world, 1, v.previousElapsed);
    return {
      count: v.grompDeath.models.size,
      disposed,
      attached: v.scene.children.filter((m: any) => m.name.startsWith('Gromp death ')).length,
    };
  });
  expect(retired).toEqual({ count: 0, disposed: 3, attached: 0 });
  expect(errors).toEqual([]);
});

test('legacy Gromp ADD, BLEND and ADD_BLEND materials retain their RGB source-alpha factors on the GPU', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tools/qa/particle-color-preview.html');
  await page.waitForFunction(() => (window as any).__PARTICLE_COLOR__?.ready);
  const samples = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js' as string),
      { createGrompDeathMaterial } = await import('/src/render/gromp-death.ts' as string);
    const renderer = new T.WebGLRenderer(),
      target = new T.WebGLRenderTarget(1, 1),
      scene = new T.Scene(),
      camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10),
      geometry = new T.PlaneGeometry(2, 2);
    camera.position.z = 1;
    const texture = (rgba: number[]) => {
      const t = new T.DataTexture(new Uint8Array(rgba), 1, 1);
      t.needsUpdate = true;
      return t;
    };
    const base = texture([128, 64, 32, 128]),
      lookup = texture([255, 255, 255, 255]),
      color = [0.5, 0.75, 1, 0.4],
      background = [0.1, 0.2, 0.3];
    renderer.setRenderTarget(target);
    renderer.setClearColor(new T.Color(...background), 1);
    const out = [];
    for (let i = 0; i < 3; i++) {
      const material = createGrompDeathMaterial(i, base, lookup);
      material.uniforms.particleColor.value.fromArray(color);
      const mesh = new T.Mesh(geometry, material);
      scene.add(mesh);
      renderer.render(scene, camera);
      const pixel = new Uint8Array(4);
      renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
      const source = [128, 64, 32].map((v, channel) => (v / 255) * color[channel]),
        alpha = (128 / 255) * color[3];
      // Profile order is ADD (0), ADD_BLEND (4), BLEND (1).
      const expected = source.map((v, channel) =>
        Math.round(
          255 * (v * (i === 0 ? 1 : alpha) + background[channel] * (i === 2 ? 1 - alpha : 1))
        )
      );
      out.push({ actual: [...pixel].slice(0, 3), expected });
      scene.remove(mesh);
      material.dispose();
    }
    geometry.dispose();
    base.dispose();
    lookup.dispose();
    target.dispose();
    renderer.dispose();
    return out;
  });
  for (const sample of samples)
    for (let i = 0; i < 3; i++)
      expect(Math.abs(sample.actual[i] - sample.expected[i])).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});
