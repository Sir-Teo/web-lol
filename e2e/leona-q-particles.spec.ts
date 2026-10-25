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
    const u = w.units.find((u: any) => u.champion === 'leona');
    w.units = [w.hero, u];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    for (const v of w.units) v.ai = false;
    Object.assign(w.hero, { x: -300, y: 0, previous: { x: -300, y: 0 } });
    Object.assign(u, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const target = w.spawn('champion', 'red', { x: 150, y: 0 }, 'lux');
    target.ai = false;
    target.hp = target.maxHp = 100000;
    g.view.zoom = 0.45;
    g.view.locked = false;
    g.view.recenter(u);
    g.view.render(w, 1, g.view.previousElapsed);
    return { caster: u.id, target: target.id };
  });
}
async function capture(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      v = g.view;
    v.render(g.world, 1, v.previousElapsed);
    return [...v.leonaDaybreak.models].map(([key, m]: any) => ({
      key,
      profile: m.userData.profileIndex,
      position: m.position.toArray(),
      rotation: m.quaternion.toArray(),
      scale: m.scale.toArray(),
      tint: m.material.uniforms.particleColor.value.toArray(),
      lookup: m.material.uniforms.lookupUv.value.toArray(),
      owned: !!m.userData.ownedGeometry,
      count: m.geometry.drawRange.count,
      vertices: m.userData.ownedGeometry ? Array.from(m.geometry.attributes.position.array) : [],
      indices: m.userData.ownedGeometry
        ? Array.from(m.geometry.index.array).slice(0, m.geometry.drawRange.count)
        : [],
    }));
  });
}
async function pixels(page: Page, offsetTicks = 0) {
  return page.evaluate((offsetTicks) => {
    const g = (window as any).__GAME__,
      v = g.view;
    // A narrow growing birth can project below one pixel at a single age.
    // Sample a saved future without advancing the match under review.
    const world = offsetTicks
      ? g.world.constructor.fromSnapshot(g.world.snapshot(), g.world.battlefield)
      : g.world;
    if (offsetTicks) world.step(offsetTicks);
    v.render(world, 1, v.previousElapsed);
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
    for (const m of v.leonaDaybreak.models.values()) m.visible = false;
    v.renderer.render(v.scene, v.camera);
    const baseline = read(),
      profiles = [];
    for (const profile of new Set(
      [...v.leonaDaybreak.models.values()].map((m: any) => m.userData.profileIndex)
    )) {
      for (const m of v.leonaDaybreak.models.values())
        m.visible = m.userData.profileIndex === profile;
      v.renderer.render(v.scene, v.camera);
      const current = read();
      let changed = 0;
      for (let i = 0; i < size; i += 4)
        if (
          current[i] !== baseline[i] ||
          current[i + 1] !== baseline[i + 1] ||
          current[i + 2] !== baseline[i + 2]
        )
          changed++;
      profiles.push({ profile, changed });
    }
    for (const m of v.leonaDaybreak.models.values()) m.visible = true;
    v.render(g.world, 1, v.previousElapsed);
    return { offsetTicks, profiles, error: gl.getError() };
  }, offsetTicks);
}
async function saveReload(page: Page) {
  if (!(await page.getByRole('button', { name: 'Save match', exact: true }).isVisible()))
    await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  // Close the restored menu and retain the pause in the same JS task, so no
  // simulation update can advance the pose between save and inspection.
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.hud.closeModal();
    g.setPaused(true);
    g.view.locked = false;
    g.view.zoom = 0.45;
    g.view.recenter(g.world.units.find((u: any) => u.champion === 'leona'));
  });
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  return saved;
}
test('six shield layers and seven enabled contact layers draw source pixels and restore exact saved geometry', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await open(page);
  await page.evaluate(({ caster, target }) => {
    const w = (window as any).__GAME__.world;
    w.enqueue({ type: 'cast', unit: caster, ability: 'q', point: w.unit(target) });
    w.step(20);
  }, ids);
  const armed = await capture(page),
    castPixels = await pixels(page);
  writeFileSync(
    info.outputPath('cast.json'),
    JSON.stringify({ armed, castPixels, errors }, null, 2)
  );
  expect([...new Set(armed.map((m) => m.profile))]).toEqual([0, 1, 2, 3, 4, 5]);
  expect(castPixels.profiles.every((p) => p.changed > 0)).toBe(true);
  await page.screenshot({ path: info.outputPath('shield.png') });
  await saveReload(page);
  expect(await capture(page)).toEqual(armed);
  await page.evaluate(({ caster, target }) => {
    const w = (window as any).__GAME__.world;
    w.setOrder(w.unit(caster), { type: 'attack', target });
    w.step(23);
  }, ids);
  const hit = await capture(page),
    hitPixels = await pixels(page),
    growthPixels = [await pixels(page, 1), await pixels(page, 2), await pixels(page, 3)];
  writeFileSync(
    info.outputPath('contact.json'),
    JSON.stringify({ hit, hitPixels, growthPixels, errors }, null, 2)
  );
  expect([...new Set(hit.filter((m) => m.profile >= 6).map((m) => m.profile))]).toEqual([
    8, 9, 10, 11, 12, 13, 14,
  ]);
  for (const profile of [8, 9, 10, 11, 12, 13, 14])
    expect(
      [hitPixels, ...growthPixels].some((sample) =>
        sample.profiles.some((p) => p.profile === profile && p.changed > 0)
      ),
      `source profile ${profile}`
    ).toBe(true);
  expect(growthPixels.every((sample) => sample.error === 0)).toBe(true);
  expect(await capture(page)).toEqual(hit);
  expect(hitPixels.error).toBe(0);
  await page.screenshot({ path: info.outputPath('contact.png') });
  const saved = await saveReload(page);
  expect(await capture(page)).toEqual(hit);
  expect(errors).toEqual([]);
  writeFileSync(info.outputPath('saved.json'), JSON.stringify({ saved, errors }, null, 2));
});
test('Q particles preserve exact pixels across context recovery, freeze lethal endpoints and drain finite result tails', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await open(page);
  await page.evaluate(({ caster, target }) => {
    const w = (window as any).__GAME__.world;
    w.enqueue({ type: 'cast', unit: caster, ability: 'q', point: w.unit(target) });
    w.step();
    w.setOrder(w.unit(caster), { type: 'attack', target });
    w.step(23);
  }, ids);
  const before = await capture(page);
  const frame = () =>
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
  const original = await frame();
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
  const recovered = await frame();
  expect(recovered).toEqual(original);
  expect(await capture(page)).toEqual(before);
  const terminal = await page.evaluate(({ caster, target }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      u = w.unit(caster),
      t = w.unit(target);
    w.damage(t, u, 1e6, 'true');
    w.damage(w.hero, t, 1e6, 'true');
    const q = w.championState(caster).leonaQVisuals[0];
    const detached = { caster: q.detachedTick, target: q.impact.detachedTick };
    const gate = w.spawn('inhibitor', 'red', { x: 1000, y: 1000 });
    w.damage(w.hero, gate, 1e6, 'true');
    const nexus = w.spawn('nexus', 'red', { x: 1200, y: 1000 });
    w.damage(w.hero, nexus, 1e6, 'true');
    v.render(w, 1, v.previousElapsed);
    const active = v.leonaDaybreak.models.size;
    let materials = 0,
      owned = 0,
      shared = 0,
      textures = 0;
    const geometries = new Set(),
      images = new Set();
    for (const m of v.leonaDaybreak.models.values()) {
      m.material.addEventListener('dispose', () => materials++);
      if (!geometries.has(m.geometry)) {
        geometries.add(m.geometry);
        m.geometry.addEventListener('dispose', () =>
          m.userData.ownedGeometry ? owned++ : shared++
        );
      }
      for (const key of ['sourceTexture', 'particleColorTexture']) {
        const tex = m.material.uniforms[key].value;
        if (!images.has(tex)) {
          images.add(tex);
          tex.addEventListener('dispose', () => textures++);
        }
      }
    }
    const saved = w.snapshot();
    v.render(w, 1, v.previousElapsed + 3);
    return {
      detached,
      winner: w.winner,
      active,
      remaining: v.leonaDaybreak.models.size,
      materials,
      owned,
      shared,
      textures,
      sameSave: w.snapshot() === saved,
      restores: w.constructor.fromSnapshot(saved, w.battlefield).snapshot() === saved,
    };
  }, ids);
  expect(terminal.detached.caster).not.toBeNull();
  expect(terminal.detached.target).not.toBeNull();
  expect(terminal.winner).toBe('blue');
  expect(terminal.active).toBeGreaterThan(0);
  expect(terminal.remaining).toBe(0);
  expect(terminal.materials).toBe(terminal.active);
  expect(terminal.owned).toBeGreaterThan(0);
  expect(terminal.shared).toBe(0);
  expect(terminal.textures).toBe(0);
  expect(terminal.sameSave).toBe(true);
  expect(terminal.restores).toBe(true);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('recovery-terminal.json'),
    JSON.stringify({ original, recovered, terminal, errors }, null, 2)
  );
});
test('hidden shield births stay hidden while later visible continuous births can appear', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const ids = await open(page);
  const result = await page.evaluate(({ caster, target }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      u = w.unit(caster),
      visible = w.visible;
    w.visible = (t: any, team: any) => (t.id === caster ? false : visible.call(w, t, team));
    w.enqueue({ type: 'cast', unit: caster, ability: 'q', point: w.unit(target) });
    w.step(2);
    w.visible = visible;
    w.step(10);
    v.render(w, 1, v.previousElapsed);
    const hidden = v.leonaDaybreak.models.size;
    w.step(50);
    v.render(w, 1, v.previousElapsed);
    return {
      hidden,
      later: [
        ...new Set([...v.leonaDaybreak.models.values()].map((m: any) => m.userData.profileIndex)),
      ],
      firstAudience: w.championState(u.id).leonaQVisuals[0].frames[1].audience,
    };
  }, ids);
  expect(result.firstAudience).toEqual([]);
  expect(result.hidden).toBe(0);
  expect(result.later).toEqual([1, 2, 3]);
  writeFileSync(info.outputPath('visibility.json'), JSON.stringify(result, null, 2));
});
