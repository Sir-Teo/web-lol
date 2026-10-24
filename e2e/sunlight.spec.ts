import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function open(page: Page) {
  await page.goto('/?scene=fixture&npc=leona');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const leona = w.units.find((u: any) => u.champion === 'leona');
    w.units = [w.hero, leona];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    for (const u of w.units) u.ai = false;
    Object.assign(leona, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    Object.assign(w.hero, { x: -200, y: 0, previous: { x: -200, y: 0 } });
    const champion = w.spawn('champion', 'red', { x: 120, y: 0 }, 'lux');
    champion.ai = false;
    const dummy = w.spawn('dummy', 'red', { x: 120, y: 300 });
    w.applySunlight(leona, champion);
    w.applySunlight(leona, dummy);
    w.step(10);
    g.view.zoom = 0.6;
    g.view.recenter(champion);
    g.view.render(w, 1, g.view.previousElapsed);
    return { leona: leona.id, champion: champion.id, dummy: dummy.id };
  });
}
async function capture(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      v = g.view;
    v.render(g.world, 1, v.previousElapsed);
    return [...v.sunlight.models].map(([key, m]: any) => ({
      key,
      profile: m.userData.profileIndex,
      role: m.userData.role,
      position: m.position.toArray(),
      rotation: m.quaternion.toArray(),
      scale: m.scale.toArray(),
      tint: m.material.uniforms.particleColor.value.toArray(),
      lookup: m.material.uniforms.lookupUv.value.toArray(),
    }));
  });
}
async function pixels(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      v = g.view,
      w = g.world;
    v.render(w, 1, v.previousElapsed);
    const gl = v.renderer.getContext(),
      size = gl.drawingBufferWidth * gl.drawingBufferHeight * 4;
    const read = () => {
      const p = new Uint8Array(size);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        p
      );
      return p;
    };
    for (const m of v.sunlight.models.values()) m.visible = false;
    v.renderer.render(v.scene, v.camera);
    const hidden = read();
    const result = [];
    for (const profile of new Set(
      [...v.sunlight.models.values()].map((m: any) => m.userData.profileIndex)
    )) {
      for (const m of v.sunlight.models.values()) m.visible = m.userData.profileIndex === profile;
      v.renderer.render(v.scene, v.camera);
      const shown = read();
      let changed = 0;
      for (let i = 0; i < size; i += 4)
        if (
          shown[i] !== hidden[i] ||
          shown[i + 1] !== hidden[i + 1] ||
          shown[i + 2] !== hidden[i + 2]
        )
          changed++;
      result.push({ profile, changed });
    }
    for (const m of v.sunlight.models.values()) m.visible = true;
    v.render(w, 1, v.previousElapsed);
    return { profiles: result, error: gl.getError() };
  });
}

test('all nine Sunlight source layers draw pixels, save their placement and retire without disposing borrowed assets', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await open(page);
  const marks = await capture(page),
    markPixels = await pixels(page);
  expect(marks.map((m) => m.profile).sort()).toEqual([0, 1, 2]);
  expect(markPixels.profiles.every((p) => p.changed > 0)).toBe(true);
  await page.screenshot({ path: info.outputPath('marks.png') });
  await page.evaluate(({ champion, dummy }) => {
    const w = (window as any).__GAME__.world;
    w.damage(w.hero, w.unit(champion), 1, 'physical');
    w.damage(w.hero, w.unit(dummy), 1, 'physical');
    w.step(8);
  }, ids);
  const before = await capture(page),
    hitPixels = await pixels(page);
  writeFileSync(
    info.outputPath('layers.json'),
    JSON.stringify({ marks, markPixels, before, hitPixels, errors }, null, 2)
  );
  expect([...new Set(before.map((m) => m.profile))]).toEqual([3, 4, 5, 6, 7, 8]);
  expect(hitPixels.profiles.every((p) => p.changed > 0)).toBe(true);
  expect(hitPixels.error).toBe(0);
  await page.screenshot({ path: info.outputPath('burst.png') });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  expect(await capture(page)).toEqual(before);
  const disposed = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      v = g.view,
      w = g.world;
    let materials = 0,
      geometry = 0,
      textures = 0;
    const geometries = new Set(),
      images = new Set();
    for (const m of v.sunlight.models.values()) {
      m.material.addEventListener('dispose', () => materials++);
      if (!geometries.has(m.geometry)) {
        geometries.add(m.geometry);
        m.geometry.addEventListener('dispose', () => geometry++);
      }
      for (const name of ['sourceTexture', 'particleColorTexture']) {
        const t = m.material.uniforms[name].value;
        if (!images.has(t)) {
          images.add(t);
          t.addEventListener('dispose', () => textures++);
        }
      }
    }
    const count = v.sunlight.models.size;
    w.step(65);
    v.render(w, 1, v.previousElapsed);
    return {
      count,
      materials,
      geometry,
      textures,
      remaining: v.sunlight.models.size,
      histories: w.sunlightVisuals.length,
    };
  });
  expect(disposed.count).toBeGreaterThan(0);
  expect(disposed.materials).toBe(disposed.count);
  expect(disposed.geometry).toBe(0);
  expect(disposed.textures).toBe(0);
  expect(disposed.remaining).toBe(0);
  expect(disposed.histories).toBe(0);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('save-disposal.json'),
    JSON.stringify({ saved, disposed, errors }, null, 2)
  );
});

test('Sunlight graphics recovery preserves exact pixels and an unseen birth cannot appear on later reveal', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await open(page);
  await page.evaluate(({ champion }) => {
    const w = (window as any).__GAME__.world;
    w.damage(w.hero, w.unit(champion), 1, 'physical');
    w.step(7);
  }, ids);
  const before = await capture(page);
  const image = () =>
    page.evaluate(async () => {
      const g = (window as any).__GAME__,
        v = g.view;
      v.render(g.world, 1, v.previousElapsed);
      const gl = v.renderer.getContext(),
        a = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        a
      );
      return {
        hash: [...new Uint8Array(await crypto.subtle.digest('SHA-256', a))].join(','),
        snapshot: g.world.snapshot(),
        error: gl.getError(),
      };
    });
  const original = await image();
  await page.evaluate(async () => {
    const r = (window as any).__GAME__.view.renderer;
    const lost = new Promise((resolve) =>
      r.domElement.addEventListener('webglcontextlost', resolve, { once: true })
    );
    r.forceContextLoss();
    await lost;
  });
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextRestore());
  await page.waitForFunction(() => (window as any).__GAME__.hud.graphicsState === null);
  const recovered = await image();
  expect(recovered).toEqual(original);
  expect(await capture(page)).toEqual(before);
  const hidden = await page.evaluate(({ champion }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      target = w.unit(champion),
      source = w.units.find((u: any) => u.champion === 'leona');
    w.step(65);
    w.applySunlight(source, target);
    w.damage(w.hero, target, 1, 'physical');
    const original = w.visible;
    w.visible = (u: any, team: any) => (u.id === target.id ? false : original.call(w, u, team));
    w.step(1);
    w.visible = original;
    v.render(w, 1, v.previousElapsed);
    return {
      audience: w.sunlightVisuals[0].frames[1].audience,
      hits: [...v.sunlight.models.values()].filter((m: any) => m.userData.role === 'hit').length,
    };
  }, ids);
  expect(hidden.audience).toEqual([]);
  expect(hidden.hits).toBe(0);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('recovery-visibility.json'),
    JSON.stringify({ original, recovered, hidden, errors }, null, 2)
  );
});

test('a lethal Sunlight burst retains its posed death endpoint and result playback drains without changing the winning save', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await open(page);
  const death = await page.evaluate(({ champion }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      target = w.unit(champion);
    target.hp = 10;
    w.damage(w.hero, target, 1, 'physical');
    w.step(4);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      dead: target.deadAt,
      detached: w.sunlightVisuals[0].detachedTick,
      active: [...g.view.sunlight.models.values()].filter((m: any) => m.userData.role === 'hit')
        .length,
    };
  }, ids);
  expect(death.dead).not.toBeNull();
  expect(death.detached).not.toBeNull();
  expect(death.active).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('lethal-burst.png') });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    const inhibitor = w.spawn('inhibitor', 'red', { x: 1000, y: 1000 });
    w.damage(w.hero, inhibitor, 1e6, 'true');
    const nexus = w.spawn('nexus', 'red', { x: 1200, y: 1000 });
    w.damage(w.hero, nexus, 1e6, 'true');
    v.render(w, 1, v.previousElapsed);
    const active = v.sunlight.models.size,
      saved = w.snapshot();
    v.render(w, 1, v.previousElapsed + 3);
    return {
      winner: w.winner,
      active,
      remaining: v.sunlight.models.size,
      sameSave: w.snapshot() === saved,
      exactRestore: w.constructor.fromSnapshot(saved, w.battlefield).snapshot() === saved,
    };
  });
  expect(result.winner).toBe('blue');
  expect(result.active).toBeGreaterThan(0);
  expect(result.remaining).toBe(0);
  expect(result.sameSave).toBe(true);
  expect(result.exactRestore).toBe(true);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('terminal.json'),
    JSON.stringify({ death, result, errors }, null, 2)
  );
});
