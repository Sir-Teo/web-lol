import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function poses(page: Page) {
  return page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.view.render(g.world, 1, g.view.previousElapsed);
    return Promise.all(
      [...g.view.grompDeath.models.entries()].map(async ([key, m]: any) => ({
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
        particleCount: m.userData.particleCount,
        ordinals: m.userData.ordinals,
        drawCount: m.geometry.drawRange.count,
        buffers: await Promise.all(
          ['position', 'uv', 'particleTint', 'particleLookupUv'].map(async (name) => {
            const a = m.geometry.getAttribute(name),
              bytes = new Uint8Array(
                a.array.buffer,
                a.array.byteOffset,
                m.geometry.drawRange.count * a.itemSize * 4
              ),
              hash = await crypto.subtle.digest('SHA-256', bytes);
            return {
              name,
              hash: [...new Uint8Array(hash)].map((v) => v.toString(16).padStart(2, '0')).join(''),
            };
          })
        ),
      }))
    );
  });
}

test('all eight Gromp death batches contribute pixels, use the posed bone and restore exact buffers across fog/save/reload', async ({
  page,
}) => {
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (r) => {
    if (r.url().includes('/gromp-legacy/') || r.url().endsWith('/gromp-death-paper01.glb'))
      requests.push(r.url());
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
    v.recenter(w.hero);
    w.step(1);
    v.render(w, 1, v.previousElapsed);
    const births = [...v.grompDeath.models.values()].map((m: any) => m.userData.particleCount);
    const birthVertices = [...v.grompDeath.models.values()].reduce(
      (sum: number, m: any) => sum + m.geometry.drawRange.count,
      0
    );
    const vertexCapacity = [...v.grompDeath.models.values()].reduce(
      (sum: number, m: any) => sum + m.geometry.getAttribute('position').count,
      0
    );
    w.step(6);
    v.render(w, 1, v.previousElapsed);
    g.hud.update(60);
    const meshes = [...v.grompDeath.models.values()] as any[];
    const bone = v.models.get(u.id).root.getObjectByName('Buffbone_Glb_Ground_Loc');
    bone.updateWorldMatrix(true, false);
    const anchor = bone.getWorldPosition(bone.position.clone());
    const anchored = meshes.every(
      (m) =>
        Math.abs(m.position.x - anchor.x) < 1e-9 &&
        Math.abs(m.position.y - anchor.y) < 1e-9 &&
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
    const combinedCalls = renderer.info.render.calls;
    meshes.forEach((m) => {
      m.visible = false;
    });
    const absent = read();
    const absentCalls = renderer.info.render.calls;
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
    return {
      combined: difference(combined),
      individual,
      anchored,
      births,
      birthVertices,
      vertexCapacity,
      effectDraws: combinedCalls - absentCalls,
    };
  });
  writeFileSync(
    'artifacts/gromp-death-burst-diagnostics.json',
    JSON.stringify(gpu, null, 2) + '\n'
  );
  expect(gpu.anchored).toBe(true);
  expect(gpu.combined).toBeGreaterThan(60);
  expect(gpu.births).toEqual([1, 1, 1, 150, 1, 15, 20, 35]);
  expect(gpu.birthVertices).toBe(3744);
  expect(gpu.vertexCapacity).toBe(3744);
  expect(gpu.effectDraws).toBe(8);
  expect(gpu.individual).toHaveLength(8);
  for (const layer of gpu.individual) expect(layer.pixels, layer.name).toBeGreaterThan(20);
  const original = await poses(page);
  expect(original.map((p) => p.name)).toEqual([
    'Gromp death flash',
    'Gromp death lightring',
    'Gromp death flashfrog',
    'Gromp death chunks',
    'Gromp death shadow',
    'Gromp death pop',
    'Gromp death skinshards',
    'Gromp death popshards',
  ]);
  expect(original.map((p) => p.priority)).toEqual([10, 7, 9, 16, -50, -5, 2, 0]);
  expect(original.map((p) => p.depthTest)).toEqual([
    false,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
  ]);
  expect(new Set(requests.map((url) => new URL(url).pathname)).size).toBe(13);
  await page.screenshot({ path: 'artifacts/gromp-death-burst.png' });
  const fog = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    let disposed = 0,
      geometries = 0;
    for (const m of v.grompDeath.models.values()) {
      m.material.addEventListener('dispose', () => disposed++);
      m.geometry.addEventListener('dispose', () => geometries++);
    }
    const point = { x: w.hero.x, y: w.hero.y };
    Object.assign(w.hero, { x: -3000, y: -2000, previous: { x: -3000, y: -2000 } });
    v.render(w, 1, v.previousElapsed);
    const hidden = v.grompDeath.models.size;
    Object.assign(w.hero, { ...point, previous: { ...point } });
    v.render(w, 1, v.previousElapsed);
    return { hidden, disposed, geometries, restored: v.grompDeath.models.size };
  });
  expect(fog).toEqual({ hidden: 0, disposed: 8, geometries: 8, restored: 8 });
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
    let disposed = 0,
      geometries = 0;
    for (const m of v.grompDeath.models.values()) {
      m.material.addEventListener('dispose', () => disposed++);
      m.geometry.addEventListener('dispose', () => geometries++);
    }
    g.world.step(310);
    v.render(g.world, 1, v.previousElapsed);
    return {
      count: v.grompDeath.models.size,
      disposed,
      geometries,
      attached: v.scene.children.filter((m: any) => m.name.startsWith('Gromp death ')).length,
    };
  });
  expect(retired).toEqual({ count: 0, disposed: 8, geometries: 8, attached: 0 });
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
