import { expect, test } from '@playwright/test';

test('Krug parent deaths, saved pending waves and fractional descendant clears resume into a fresh camp', async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(r.url()));
  page.on('request', (r) => requests.push(r.url()));
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  const save = async () => {
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    return page.evaluate(() => (window as any).__GAME__.world.snapshot());
  };
  const reload = async (snapshot: string) => {
    await page.reload();
    await ready();
    expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(snapshot);
  };
  const rigs = async (ids: number[]) =>
    page.evaluate((ids) => {
      const g = (window as any).__GAME__;
      g.view.render(g.world, 1, g.view.previousElapsed);
      const models = ids.map((id) => g.view.models.get(id)),
        r = g.view.renderer,
        gl = r.getContext(),
        a = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4),
        b = new Uint8Array(a.length);
      r.render(g.view.scene, g.view.camera);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        a
      );
      for (const m of models) m.root.visible = false;
      r.render(g.view.scene, g.view.camera);
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        b
      );
      for (const m of models) m.root.visible = true;
      r.render(g.view.scene, g.view.camera);
      let pixels = 0;
      for (let i = 0; i < a.length; i += 4)
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) pixels++;
      return { assets: models.map((m) => m.referenceAsset), pixels };
    }, ids);
  await page.goto('/');
  await ready();
  // Rift practice prepares every scheduled camp before simulation resumes.
  expect(requests.some((u) => u.includes('sru-krug'))).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await page.getByRole('button', { name: 'Lux', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start 5v5 match', exact: true }).click(),
  ]);
  await ready();
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  const encounter = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world,
      { RIFT_CAMPS } = await import('/src/content/rift-camps.ts');
    const d = RIFT_CAMPS.find((c) => c.id === 'order-krugs')!;
    g.setPaused(true);
    for (const u of w.units) u.ai = false;
    w.nextWaveTick = 1_000_000_000;
    w.gainExperience(280);
    w.tick = d.firstReadyTick - 1;
    w.step();
    const c = w.jungleCamps.find((c: any) => c.id === d.id),
      units = c.unitIds.slice(0, 2).map((id: number) => w.unit(id)),
      big = units[0];
    let point;
    for (let x = -500; x <= 500 && !point; x += 50)
      for (let y = -500; y <= 500 && !point; y += 50) {
        const p = { x: big.x + x, y: big.y + y },
          distance = Math.hypot(x, y);
        if (
          distance > 180 &&
          distance < 500 &&
          w.battlefield.lineWalkable(p, p, w.hero.radius, 'blue') &&
          units.every(
            (u: any) =>
              Math.hypot(p.x - u.x, p.y - u.y) > u.radius + w.hero.radius + 20 &&
              w.battlefield.lineOfSight(p, u)
          )
        )
          point = p;
      }
    if (!point) throw new Error('No visible, separated Krug approach');
    Object.assign(w.hero, point, { previous: { ...point } });
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return { ids: units.map((u: any) => u.id), point, screen: g.view.screenPoint(big, 0.65) };
  });
  for (const slug of ['sru-krug-base', 'sru-krugmini-base', 'sru-krugminimini-base'])
    expect(requests.some((u) => u.endsWith(`/${slug}.glb`))).toBe(true);
  const initial = await rigs(encounter.ids);
  expect(initial.assets).toEqual(['sru-krug-base', 'sru-krugmini-base']);
  expect(initial.pixels).toBeGreaterThan(200);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.click(encounter.screen.x, encounter.screen.y, { button: 'right' });
  await page.waitForFunction(
    (ids) => {
      const w = (window as any).__GAME__.world;
      return (
        ids.every((id) => w.unit(id).monster.phase === 'engaged') &&
        w.hero.hp < w.hero.maxHp &&
        w.unit(ids[0]).hp < w.unit(ids[0]).maxHp
      );
    },
    encounter.ids,
    { timeout: 10000 }
  );
  await page.keyboard.press('Control+q');
  await page.mouse.move(encounter.screen.x, encounter.screen.y);
  await page.keyboard.press('q');
  await page.waitForFunction(
    (ids) => {
      const w = (window as any).__GAME__.world;
      return ids.some((id) => w.unit(id).rootUntil > w.tick);
    },
    encounter.ids,
    { timeout: 10000 }
  );
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  await page.keyboard.press('Escape');
  const fighting = await save();
  await reload(fighting);
  const pending = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.damage(w.hero, w.unit(id), 99999, 'true');
    g.hud.update(60);
    const c = w.jungleCamps.find((c: any) => c.id === 'order-krugs');
    return {
      wave: structuredClone(c.splitWaves[0]),
      ids: [...c.unitIds],
      tick: w.tick,
      next: c.nextSpawnTick,
    };
  }, encounter.ids[0]);
  expect(pending.wave).toMatchObject({
    parentSlot: 0,
    status: 'pending',
    readyTick: pending.tick + 60,
  });
  expect(pending.ids.slice(2)).toEqual(Array(6).fill(null));
  expect(pending.next).toBeNull();
  const pendingSave = await save();
  await reload(pendingSave);
  const split = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      c = w.jungleCamps.find((c: any) => c.id === 'order-krugs');
    w.step(59);
    if (c.unitIds.slice(2).some((id: any) => id !== null))
      throw new Error('Early Krug descendants');
    w.step();
    w.setOrder(w.hero, { type: 'idle' });
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    return { ids: c.unitIds.slice(2, 6), wave: structuredClone(c.splitWaves[0]), cs: w.player.cs };
  });
  expect(split.ids.every((id: any) => typeof id === 'number')).toBe(true);
  expect(split.wave.status).toBe('spawned');
  expect(split.cs).toBe(2);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  const descendants = await rigs(split.ids);
  expect(descendants.assets).toEqual(Array(4).fill('sru-krugminimini-base'));
  expect(descendants.pixels).toBeGreaterThan(100);
  const area = await page.evaluate((ids) => {
    const g = (window as any).__GAME__,
      units = ids.map((id) => g.world.unit(id));
    return g.view.screenPoint(
      { x: units.reduce((n, u) => n + u.x, 0) / 4, y: units.reduce((n, u) => n + u.y, 0) / 4 },
      0
    );
  }, split.ids);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.press('Control+e');
  await page.mouse.move(area.x, area.y);
  await page.keyboard.press('e');
  await page.keyboard.press('e');
  await page.waitForFunction(
    (ids) => {
      const w = (window as any).__GAME__.world;
      return ids.every((id) => w.unit(id).illumination.some((s: any) => s.sourceId === w.hero.id));
    },
    split.ids,
    { timeout: 10000 }
  );
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.view.selected = null;
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  await page.mouse.move(100, 100);
  for (const id of split.ids)
    await expect(page.locator(`.unit-bar[data-unit="${id}"] .unit-name`)).toBeHidden();
  await page.screenshot({ path: 'artifacts/krug-camps-split.png' });
  await page.keyboard.press('Escape');
  const partial = await page.evaluate(
    ({ medium, child }) => {
      const g = (window as any).__GAME__,
        w = g.world;
      w.damage(w.hero, w.unit(medium), 99999, 'true');
      w.damage(w.hero, w.unit(child), 99999, 'true');
      Object.assign(w.hero, w.battlefield.spawns.blue);
      w.step(300);
      g.hud.update(60);
      const c = w.jungleCamps.find((c: any) => c.id === 'order-krugs');
      return {
        ids: [...c.unitIds],
        cs: w.player.cs,
        parentsGone: !w.unit(medium),
        waves: c.splitWaves.map((s: any) => s.status),
      };
    },
    { medium: encounter.ids[1], child: split.ids[0] }
  );
  expect(partial.cs).toBe(2.75);
  expect(partial.ids.filter((id: any) => id !== null)).toHaveLength(5);
  expect(partial.parentsGone).toBe(true);
  expect(partial.waves).toEqual(['spawned', 'spawned']);
  await expect(page.locator('#cs')).toHaveText('2');
  const partialSave = await save();
  await reload(partialSave);
  const cleared = await page.evaluate(() => {
    const w = (window as any).__GAME__.world,
      c = w.jungleCamps.find((c: any) => c.id === 'order-krugs');
    for (const id of [...c.unitIds]) if (id !== null) w.damage(w.hero, w.unit(id), 99999, 'true');
    w.step(300);
    return { cs: w.player.cs, ids: [...c.unitIds], waves: c.splitWaves, next: c.nextSpawnTick };
  });
  expect(cleared.cs).toBe(4);
  expect(cleared.ids).toEqual(Array(8).fill(null));
  expect(cleared.waves).toEqual([]);
  expect(cleared.next).not.toBeNull();
  const clearSave = await save();
  await reload(clearSave);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  const fresh = await page.evaluate(async (point) => {
    const g = (window as any).__GAME__,
      w = g.world,
      { RIFT_CAMPS, campLeadupTicks } = await import('/src/content/rift-camps.ts'),
      d = RIFT_CAMPS.find((c) => c.id === 'order-krugs')!,
      c = w.jungleCamps.find((c: any) => c.id === d.id);
    g.setPaused(true);
    w.tick = c.nextSpawnTick - campLeadupTicks(d) - 1;
    w.step(campLeadupTicks(d) + 1);
    Object.assign(w.hero, point, { previous: { ...point } });
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      ids: c.unitIds.slice(0, 2),
      children: c.unitIds.slice(2),
      hp: c.unitIds.slice(0, 2).map((id: number) => w.unit(id).hp),
      waves: c.splitWaves,
    };
  }, encounter.point);
  expect(fresh.ids.every((id: number) => !encounter.ids.includes(id))).toBe(true);
  expect(fresh.children).toEqual(Array(6).fill(null));
  expect(fresh.hp).toEqual([1400, 650]);
  expect(fresh.waves).toEqual([]);
  await page.screenshot({ path: 'artifacts/krug-camps-respawn.png' });
  expect(errors).toEqual([]);
});
