import { expect, test } from '@playwright/test';

test('three source wolves share combat and preserve partial and complete clears through saved reloads', async ({
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
  await page.goto('/');
  await ready();
  expect(requests.some((u) => u.includes('sru-murkwolf'))).toBe(false);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await page.getByRole('button', { name: 'Lux', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start lane match', exact: true }).click(),
  ]);
  await ready();
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  const encounter = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    const { RIFT_CAMPS } = await import('/src/content/rift-camps.ts');
    const definition = RIFT_CAMPS.find((c) => c.id === 'order-wolves')!;
    g.setPaused(true);
    for (const u of w.units) u.ai = false;
    w.nextWaveTick = 1_000_000_000;
    w.tick = definition.firstReadyTick - 1;
    w.step();
    const camp = w.jungleCamps.find((c: any) => c.id === definition.id),
      units = camp.unitIds.map((id: number) => w.unit(id));
    const big = units[0];
    const candidates = [
      [320, 0],
      [-320, 0],
      [0, 320],
      [0, -320],
      [250, 250],
      [-250, -250],
    ].map(([x, y]) =>
      w.battlefield.reachable({ x: big.x + x, y: big.y + y }, w.hero.radius, 'blue')
    );
    const point = candidates.find(
      (p) =>
        Math.hypot(p.x - big.x, p.y - big.y) > 180 &&
        Math.hypot(p.x - big.x, p.y - big.y) < 500 &&
        units.every(
          (u: any) => Math.hypot(p.x - u.x, p.y - u.y) > 120 && w.battlefield.lineOfSight(p, u)
        )
    );
    if (!point) throw new Error('No separated, visible wolf approach');
    Object.assign(w.hero, point, { previous: { ...point } });
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const models = units.map((u: any) => g.view.models.get(u.id)),
      renderer = g.view.renderer,
      gl = renderer.getContext();
    const a = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4),
      b = new Uint8Array(a.length);
    renderer.render(g.view.scene, g.view.camera);
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
    renderer.render(g.view.scene, g.view.camera);
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
    renderer.render(g.view.scene, g.view.camera);
    let pixels = 0;
    for (let i = 0; i < a.length; i += 4)
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) pixels++;
    return {
      ids: [...camp.unitIds],
      rigs: models.map((m: any) => m.referenceAsset),
      pixels,
      point,
      screen: g.view.screenPoint(big, 0.65),
    };
  });
  expect(encounter.rigs).toEqual([
    'sru-murkwolf-base',
    'sru-murkwolfmini-base',
    'sru-murkwolfmini-base',
  ]);
  expect(encounter.pixels).toBeGreaterThan(300);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.click(encounter.screen.x, encounter.screen.y, { button: 'right' });
  await page.waitForFunction(
    (ids) => {
      const w = (window as any).__GAME__.world;
      return (
        ids.every((id) => w.unit(id).monster.phase === 'engaged') &&
        w.hero.hp < w.hero.maxHp &&
        ids.some((id) => w.unit(id).hp < w.unit(id).maxHp)
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
  await page.mouse.move(100, 100);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.view.selected = null;
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  for (const id of encounter.ids.slice(1))
    await expect(page.locator(`.unit-bar[data-unit="${id}"] .unit-name`)).toBeHidden();
  await expect(page.locator(`.unit-bar[data-unit="${encounter.ids[0]}"] .unit-name`)).toBeVisible();
  await page.evaluate((id) => {
    const g = (window as any).__GAME__;
    g.view.selected = id;
    g.view.render(g.world, 1, g.view.previousElapsed);
  }, encounter.ids[1]);
  await expect(page.locator(`.unit-bar[data-unit="${encounter.ids[1]}"] .unit-name`)).toBeVisible();
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.view.selected = null;
    g.view.render(g.world, 1, g.view.previousElapsed);
  });
  await page.screenshot({ path: 'artifacts/wolf-camps-combat.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const fighting = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await ready();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(fighting);
  const partial = await page.evaluate((ids) => {
    const w = (window as any).__GAME__.world,
      camp = w.jungleCamps.find((c: any) => c.id === 'order-wolves');
    w.damage(w.hero, w.unit(ids[0]), 99999, 'true');
    Object.assign(w.hero, w.battlefield.spawns.blue);
    w.step(400);
    return { camp: structuredClone(camp), corpseGone: !w.unit(ids[0]) };
  }, encounter.ids);
  expect(partial.camp.unitIds).toEqual([null, ...encounter.ids.slice(1)]);
  expect(partial.camp.nextSpawnTick).toBeNull();
  expect(partial.corpseGone).toBe(true);
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const partialSave = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.reload();
  await ready();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(partialSave);
  const cleared = await page.evaluate(() => {
    const w = (window as any).__GAME__.world,
      camp = w.jungleCamps.find((c: any) => c.id === 'order-wolves');
    for (const id of [...camp.unitIds])
      if (id !== null) w.damage(w.hero, w.unit(id), 99999, 'true');
    w.step(400);
    return { camp: structuredClone(camp), cs: w.player.cs };
  });
  expect(cleared.camp.unitIds).toEqual([null, null, null]);
  expect(cleared.cs).toBe(4);
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready();
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  const respawn = await page.evaluate(async (point) => {
    const g = (window as any).__GAME__,
      w = g.world;
    const { RIFT_CAMPS, campLeadupTicks } = await import('/src/content/rift-camps.ts');
    const definition = RIFT_CAMPS.find((c) => c.id === 'order-wolves')!,
      camp = w.jungleCamps.find((c: any) => c.id === definition.id);
    g.setPaused(true);
    w.tick = camp.nextSpawnTick - campLeadupTicks(definition) - 1;
    w.step();
    const phases = camp.unitIds.map((id: number) => w.unit(id).monster.phase);
    w.step(campLeadupTicks(definition));
    Object.assign(w.hero, point, { previous: { ...point } });
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      ids: [...camp.unitIds],
      phases,
      hp: camp.unitIds.map((id: number) => w.unit(id).hp),
      species: camp.unitIds.map((id: number) => w.unit(id).monster.species),
    };
  }, encounter.point);
  expect(respawn.ids.every((id: number) => !encounter.ids.includes(id))).toBe(true);
  expect(respawn.phases).toEqual(['spawning', 'spawning', 'spawning']);
  expect(respawn.hp).toEqual([1600, 630, 630]);
  expect(respawn.species).toEqual(['wolf', 'wolf-mini', 'wolf-mini']);
  await page.screenshot({ path: 'artifacts/wolf-camps-respawn.png' });
  expect(errors).toEqual([]);
});
