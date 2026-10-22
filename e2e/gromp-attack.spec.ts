import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function poses(page: Page) {
  return page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.view.render(g.world, 1, g.view.previousElapsed);
    return Promise.all(
      [...g.view.grompAttack.models.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(async ([key, m]: any) => ({
          key,
          name: m.name,
          count: m.userData.particleCount,
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
                digest = await crypto.subtle.digest('SHA-256', bytes);
              return {
                name,
                hash: [...new Uint8Array(digest)]
                  .map((v) => v.toString(16).padStart(2, '0'))
                  .join(''),
              };
            })
          ),
        }))
    );
  });
}
async function reloadSaved(page: Page) {
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
}

test('released Gromp missiles survive Flash/reset and restore all four source layers through fog and saves', async ({
  page,
}) => {
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (r) => {
    if (/gromp_ba_(orb|flare)|morgana_skin05_q_black_mis/.test(r.url())) requests.push(r.url());
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
    const monster = w.units.find((u: any) => u.kind === 'monster');
    Object.assign(monster, { x: 210, y: 0, previous: { x: 210, y: 0 } });
    w.damage(w.hero, monster, 1, 'true');
    for (let i = 0; i < 100 && !w.grompAttackVisuals.length; i++) w.step();
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'd', point: { x: -400, y: 0 } });
    w.step(10);
    v.recenter(w.hero);
    v.render(w, 1, v.previousElapsed);
    g.hud.update(60);
    const visual = w.grompAttackVisuals[0],
      meshes = [...v.grompAttack.models.values()] as any[],
      renderer = v.renderer,
      gl = renderer.getContext(),
      width = gl.drawingBufferWidth,
      height = gl.drawingBufferHeight;
    const read = () => {
      renderer.render(v.scene, v.camera);
      const data = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      return data;
    };
    const combined = read(),
      shownCalls = renderer.info.render.calls;
    meshes.forEach((m) => {
      m.visible = false;
    });
    const absent = read(),
      absentCalls = renderer.info.render.calls;
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
      return { name: m.name, pixels, particles: m.userData.particleCount };
    });
    meshes.forEach((m) => {
      m.visible = true;
    });
    read();
    return {
      combined: difference(combined),
      individual,
      draws: shownCalls - absentCalls,
      genericPresent: v.projectileModels.has(visual.id),
      active: visual.stopTick === null,
      lifeFrames: visual.frames.length,
      projectileId: visual.id,
      flashed: w.hero.x === -400 && w.player.cooldowns.d > w.tick,
      reset: monster.monster.phase,
      depthTests: meshes.map((m) => m.material.depthTest),
    };
  });
  writeFileSync('artifacts/gromp-attack-diagnostics.json', JSON.stringify(gpu, null, 2) + '\n');
  expect(gpu.active).toBe(true);
  expect(gpu.genericPresent).toBe(false);
  expect(gpu.draws).toBe(4);
  expect(gpu.flashed).toBe(true);
  expect(gpu.reset).toBe('returning');
  expect(gpu.depthTests).toEqual([true, true, true, true]);
  expect(gpu.combined).toBeGreaterThan(20);
  expect(gpu.individual).toHaveLength(4);
  for (const layer of gpu.individual) expect(layer.pixels, layer.name).toBeGreaterThan(0);
  expect(gpu.individual.map((p) => p.particles)).toEqual([1, 1, 2, 4]);
  expect(new Set(requests).size).toBe(3);
  expect(requests).toHaveLength(3);
  await page.screenshot({ path: 'artifacts/gromp-attack-flight.png' });
  const original = await poses(page);
  const fog = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    let materials = 0,
      geometries = 0;
    const originalPoint = { x: w.hero.x, y: w.hero.y };
    for (const m of v.grompAttack.models.values()) {
      m.material.addEventListener('dispose', () => materials++);
      m.geometry.addEventListener('dispose', () => geometries++);
    }
    Object.assign(w.hero, { x: -3000, y: -2000, previous: { x: -3000, y: -2000 } });
    v.render(w, 1, v.previousElapsed);
    const hidden = v.grompAttack.models.size;
    Object.assign(w.hero, { ...originalPoint, previous: { ...originalPoint } });
    v.render(w, 1, v.previousElapsed);
    return { hidden, materials, geometries, restored: v.grompAttack.models.size };
  });
  expect(fog).toEqual({ hidden: 0, materials: 4, geometries: 4, restored: 4 });
  expect(await poses(page)).toEqual(original);
  await page.keyboard.press('Escape');
  await reloadSaved(page);
  expect(await poses(page)).toEqual(original);
  const stopped = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    for (let i = 0; i < 20 && w.grompAttackVisuals[0].stopTick === null; i++) w.step();
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      stopTick: w.grompAttackVisuals[0].stopTick,
      tick: w.tick,
      heroDamaged: w.hero.hp < w.hero.maxHp,
      names: [...g.view.grompAttack.models.values()].map((m: any) => m.name),
    };
  });
  expect(stopped.stopTick).toBe(stopped.tick);
  expect(stopped.heroDamaged).toBe(true);
  expect(stopped.names).toEqual(['Gromp attack black_background', 'Gromp attack trailorbs']);
  const terminal = await poses(page);
  await reloadSaved(page);
  expect(await poses(page)).toEqual(terminal);
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('#modal')!.hidden = true;
  });
  await page.screenshot({ path: 'artifacts/gromp-attack-tail.png' });
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('#modal')!.hidden = false;
  });
  const retired = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    let materials = 0,
      geometries = 0;
    for (const m of g.view.grompAttack.models.values()) {
      m.material.addEventListener('dispose', () => materials++);
      m.geometry.addEventListener('dispose', () => geometries++);
    }
    g.world.step(31);
    g.view.render(g.world, 1, g.view.previousElapsed);
    return {
      histories: g.world.grompAttackVisuals.length,
      models: g.view.grompAttack.models.size,
      nodes: g.view.scene.children.filter((m: any) => m.name.startsWith('Gromp attack ')).length,
      materials,
      geometries,
    };
  });
  expect(retired).toEqual({ histories: 0, models: 0, nodes: 0, materials: 2, geometries: 2 });
  expect(errors).toEqual([]);
});

test('Gromp missile GPU materials preserve ADD, SUBTRACT and ADD_BLEND RGB factors', async ({
  page,
}) => {
  await page.goto('/tools/qa/particle-color-preview.html');
  await page.waitForFunction(() => (window as any).__PARTICLE_COLOR__?.ready);
  const samples = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js' as string),
      { createGrompAttackMaterial } = await import('/src/render/gromp-attack.ts' as string),
      renderer = new T.WebGLRenderer(),
      target = new T.WebGLRenderTarget(1, 1),
      scene = new T.Scene(),
      camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10),
      geometry = new T.PlaneGeometry(2, 2),
      texture = new T.DataTexture(new Uint8Array([128, 64, 32, 128]), 1, 1);
    camera.position.z = 1;
    texture.needsUpdate = true;
    const color = [0.5, 0.75, 1, 0.4],
      background = [0.1, 0.2, 0.3];
    renderer.setRenderTarget(target);
    renderer.setClearColor(new T.Color(...background), 1);
    const out = [];
    for (let i = 0; i < 3; i++) {
      const material = createGrompAttackMaterial(i, texture),
        mesh = new T.Mesh(geometry, material);
      material.uniforms.particleColor.value.fromArray(color);
      scene.add(mesh);
      renderer.render(scene, camera);
      const pixel = new Uint8Array(4);
      renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
      const alpha = (128 / 255) * color[3],
        expected = [128, 64, 32].map((v, c) => {
          const src = (v / 255) * color[c];
          return Math.round(
            255 *
              (i === 1 ? background[c] * (1 - src) : background[c] + src * (i === 0 ? 1 : alpha))
          );
        });
      out.push({ actual: [...pixel].slice(0, 3), expected });
      scene.remove(mesh);
      material.dispose();
    }
    texture.dispose();
    geometry.dispose();
    target.dispose();
    renderer.dispose();
    return out;
  });
  for (const sample of samples)
    for (let i = 0; i < 3; i++)
      expect(Math.abs(sample.actual[i] - sample.expected[i])).toBeLessThanOrEqual(1);
});
