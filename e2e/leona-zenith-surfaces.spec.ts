import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const supported = [1, 2, 3, 4, 6, 7, 8, 9, 10, 12, 13, 15, 16, 17, 19];
async function open(page: Page) {
  await page.setViewportSize({ width: 1100, height: 750 });
  await page.goto('/?scene=fixture&npc=leona');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.units.find((u: any) => u.champion === 'leona');
    g.setPaused(true);
    w.units = [w.hero, u];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 800, y: -100, previous: { x: 800, y: -100 } });
    Object.assign(u, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const target = w.spawn('champion', 'red', { x: 800, y: 0 }, 'lux');
    target.hp = target.maxHp = 100000;
    for (const v of w.units) v.ai = false;
    if (!w.championState(u.id).spellRanks.e) w.learnSpell('e', u.id);
    w.enqueue({ type: 'cast', unit: u.id, ability: 'e', point: { x: 900, y: 0 } });
    w.step();
    g.view.locked = false;
    g.view.zoom = 0.55;
    g.view.recenter({ x: 450, y: 0 });
    g.view.render(w, 1, 22.5);
    return {
      caster: u.id,
      target: target.id,
      start: w.tick,
      heroBrush: w.battlefield.inBrush?.(w.hero),
      targetBrush: w.battlefield.inBrush?.(target),
      targetVisible: w.visible(target),
    };
  });
}
async function sourcePixels(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      v = g.view;
    v.render(g.world, 1, 22.5);
    const gl = v.renderer.getContext(),
      models = [...v.leonaZenithSurfaces.models.values()] as any[],
      read = () => {
        const p = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
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
      },
      draw = () => {
        v.renderer.render(v.scene, v.camera);
        return read();
      };
    for (const m of models) m.visible = false;
    const baseline = draw(),
      profiles = [];
    for (const profile of new Set(models.map((m) => m.userData.profileIndex))) {
      for (const m of models) m.visible = m.userData.profileIndex === profile;
      const pixels = draw();
      let changed = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (
          pixels[i] !== baseline[i] ||
          pixels[i + 1] !== baseline[i + 1] ||
          pixels[i + 2] !== baseline[i + 2]
        )
          changed++;
      const m = models.find((m) => m.userData.profileIndex === profile);
      profiles.push({
        profile,
        changed,
        count: models.filter((m) => m.userData.profileIndex === profile).length,
        name: m.name,
        mesh: m.userData.sourceMesh,
        vertexBgra: !!m.material.defines.SOURCE_VERTEX_BGRA,
        soft: !!m.material.uniforms.softDepth,
        vertices: m.geometry.getAttribute('position').count,
        ...(profile === 3
          ? {
              position: m.position.toArray(),
              scale: m.scale.toArray(),
              color: m.material.uniforms.particleColor.value.toArray(),
              uv: m.material.uniforms.sourceUvTransform.value.toArray(),
              erosion: m.material.uniforms.erosionParameters.value.toArray(),
            }
          : {}),
      });
    }
    for (const m of models) m.visible = true;
    v.render(g.world, 1, 22.5);
    return {
      tick: g.world.tick,
      totalPixels: gl.drawingBufferWidth * gl.drawingBufferHeight,
      profiles,
      error: gl.getError(),
    };
  });
}
async function capture(page: Page) {
  return page.evaluate(async () => {
    const g = (window as any).__GAME__,
      v = g.view;
    v.render(g.world, 1, 22.5);
    const gl = v.renderer.getContext(),
      p = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(
      0,
      0,
      gl.drawingBufferWidth,
      gl.drawingBufferHeight,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      p
    );
    const models = [...v.leonaZenithSurfaces.models].map(([key, m]: any) => ({
      key,
      ...m.userData,
      position: m.position.toArray(),
      quaternion: m.quaternion.toArray(),
      scale: m.scale.toArray(),
      color: m.material.uniforms.particleColor.value.toArray(),
      uv: m.material.uniforms.sourceUvTransform.value.toArray(),
      mult: m.material.uniforms.multiplierUvTransform.value.toArray(),
      erosion: m.material.uniforms.erosionParameters?.value.toArray(),
      lookup: m.material.uniforms.lookupUv.value.toArray(),
      vertices: m.userData.ownedGeometry ? [...m.geometry.getAttribute('position').array] : null,
    }));
    return {
      models,
      hash: [...new Uint8Array(await crypto.subtle.digest('SHA-256', p))].join(','),
      snapshot: g.world.snapshot(),
      error: gl.getError(),
    };
  });
}

test('all fifteen nonreflective source families contribute localized pixels through flight, dash and contact', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const ids = await open(page),
    stages = [];
  for (const age of [
    13, 15, 18, 20, 24, 29, 34, 38, 42, 46, 50, 54, 58, 62, 66, 70, 75, 85, 100, 120,
  ]) {
    await page.evaluate(
      ({ start, age }) => {
        const w = (window as any).__GAME__.world;
        w.step(start + age - w.tick);
      },
      { start: ids.start, age }
    );
    stages.push({ age, ...(await sourcePixels(page)) });
    if (age === 29 || age === 54 || age === 75)
      await page.screenshot({ path: info.outputPath(`source-${age}.png`) });
  }
  const seen = new Map<number, number>();
  for (const stage of stages) {
    expect(stage.error).toBe(0);
    for (const p of stage.profiles) {
      expect(p.changed).toBeLessThan(stage.totalPixels * 0.5);
      seen.set(p.profile, Math.max(seen.get(p.profile) ?? 0, p.changed));
    }
  }
  writeFileSync(
    info.outputPath('families.json'),
    JSON.stringify({ ids, stages, seen: [...seen], errors }, null, 2)
  );
  expect([...seen.keys()].sort((a, b) => a - b)).toEqual(supported);
  expect([...seen].filter(([, changed]) => changed === 0)).toEqual([]);
  expect(errors).toEqual([]);
});

for (const age of [29, 54])
  test(`surface age ${age} restores exact source state and pixels through Save/reload and graphics recovery`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const ids = await open(page);
    await page.evaluate(
      ({ start, age }) => {
        const w = (window as any).__GAME__.world;
        w.step(start + age - w.tick);
      },
      { start: ids.start, age }
    );
    const before = await capture(page);
    expect(before.models.length).toBeGreaterThan(0);
    expect(before.error).toBe(0);
    expect(await capture(page)).toEqual(before);
    if (!(await page.getByRole('button', { name: 'Save match', exact: true }).isVisible()))
      await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    await page.reload();
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    await page.evaluate(() => {
      const g = (window as any).__GAME__;
      g.setPaused(true);
      g.view.locked = false;
      g.view.zoom = 0.55;
      g.view.recenter({ x: 450, y: 0 });
    });
    const restored = await capture(page);
    writeFileSync(
      info.outputPath('pre-recovery.json'),
      JSON.stringify({ age, before, restored, errors }, null, 2)
    );
    expect(restored).toEqual(before);
    await page.evaluate(async () => {
      const v = (window as any).__GAME__.view;
      await new Promise<void>((resolve) => {
        v.renderer.domElement.addEventListener(
          'webglcontextrestored',
          () => setTimeout(resolve, 100),
          { once: true }
        );
        v.renderer.forceContextLoss();
        setTimeout(() => v.renderer.forceContextRestore(), 250);
      });
    });
    const recovered = await capture(page);
    expect(recovered).toEqual(before);
    expect(errors).toEqual([]);
    writeFileSync(
      info.outputPath('restore-recovery.json'),
      JSON.stringify({ age, before, restored, recovered, errors }, null, 2)
    );
  });

test('repeated hits and misses retire ground grids, materials and soft-depth targets with bounded GPU memory', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ids = await open(page);
  const rounds = await page.evaluate(({ caster, target, start }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view,
      u = w.unit(caster),
      t = w.unit(target),
      state = w.championState(caster),
      rounds = [];
    for (let i = 0; i < 6; i++) {
      let begun = start;
      if (i) {
        Object.assign(u, { x: 0, y: 0, previous: { x: 0, y: 0 }, mana: u.maxMana });
        Object.assign(t, {
          x: i % 2 ? 3000 : 800,
          y: 0,
          previous: { x: i % 2 ? 3000 : 800, y: 0 },
        });
        state.cooldowns.e = 0;
        w.enqueue({ type: 'cast', unit: caster, ability: 'e', point: { x: 900, y: 0 } });
        w.step();
        begun = w.tick;
      }
      w.step(begun + 29 - w.tick);
      v.render(w, 1, 22.5);
      const models = [...v.leonaZenithSurfaces.models.values()] as any[],
        owned = models.filter((m) => m.userData.ownedGeometry);
      let materials = 0,
        geometry = 0;
      for (const m of models) m.material.addEventListener('dispose', () => materials++);
      for (const m of owned) m.geometry.addEventListener('dispose', () => geometry++);
      const depthActive = !!v.leonaZenithSurfaces.renderer.depth.target;
      w.step(begun + 75 - w.tick);
      v.render(w, 1, 22.5);
      w.step(240);
      v.render(w, 1, 22.5);
      rounds.push({
        outcome: i % 2 ? 'miss' : 'hit',
        active: models.length,
        owned: owned.length,
        materials,
        geometry,
        depthActive,
        depthRemaining: !!v.leonaZenithSurfaces.renderer.depth.target,
        remaining: v.leonaZenithSurfaces.models.size,
        memory: { ...v.renderer.info.memory },
      });
    }
    return rounds;
  }, ids);
  for (const r of rounds) {
    expect(r.active).toBeGreaterThan(0);
    expect(r.owned).toBe(3);
    expect(r.depthActive).toBe(true);
    expect(r.depthRemaining).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.materials).toBe(r.active);
    expect(r.geometry).toBeGreaterThanOrEqual(r.owned);
  }
  expect(
    rounds.slice(1).every((r) => JSON.stringify(r.memory) === JSON.stringify(rounds[1].memory))
  ).toBe(true);
  expect(errors).toEqual([]);
  writeFileSync(info.outputPath('storage.json'), JSON.stringify({ rounds, errors }, null, 2));
});
