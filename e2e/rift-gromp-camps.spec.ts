import { expect, test } from '@playwright/test';

test('scheduled Rift camps render, clear and respawn after a corpse-free saved reload', async ({
  page,
}) => {
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(r.url()));
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(requests.some((u) => u.endsWith('/sru-gromp-base.glb'))).toBe(false);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start lane match', exact: true }).click(),
  ]);
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(requests.some((u) => u.endsWith('/sru-gromp-base.glb'))).toBe(true);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  const spawned = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    const { GROMP_FIRST_SPAWN_TICK } = await import('/src/content/rift-gromp-camps.ts');
    g.setPaused(true);
    for (const u of w.units) u.ai = false;
    w.nextWaveTick = 1_000_000_000;
    w.tick = GROMP_FIRST_SPAWN_TICK - 1;
    w.step();
    const unit = w.unit(w.jungleCamps[0].unitId);
    const point = w.battlefield.reachable({ x: unit.x + 300, y: unit.y }, w.hero.radius, 'blue');
    Object.assign(w.hero, point, { previous: { ...point } });
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      camps: structuredClone(w.jungleCamps),
      models: w.jungleCamps.map((c: any) => g.view.models.get(c.unitId).referenceAsset),
      visible: g.view.models.get(unit.id).root.visible,
      hiddenOther: !g.view.models.get(w.jungleCamps[1].unitId).root.visible,
      home: unit.monster.home,
      screen: g.view.screenPoint(unit),
    };
  });
  expect(spawned.models).toEqual(['sru-gromp-base', 'sru-gromp-base']);
  expect(spawned.visible).toBe(true);
  expect(spawned.hiddenOther).toBe(true);
  await expect(page.locator('.unit-bar.neutral.monster:not([hidden])')).toBeVisible();
  await expect(page.locator('.unit-bar.neutral.monster[hidden]')).toHaveCount(1);
  await page.screenshot({ path: 'artifacts/rift-gromp-camp.png' });
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.click(spawned.screen.x, spawned.screen.y, { button: 'right' });
  await page.waitForFunction(() => {
    const w = (window as any).__GAME__.world,
      u = w.unit(w.jungleCamps[0].unitId);
    return u.hp < u.maxHp && u.monster.phase === 'engaged' && w.hero.hp < w.hero.maxHp;
  });
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  const waiting = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const unit = w.unit(w.jungleCamps[0].unitId);
    w.damage(w.hero, unit, 99999, 'true');
    w.step(400);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      camp: structuredClone(w.jungleCamps[0]),
      corpseGone: !w.unit(unit.id),
      gold: w.player.gold,
      cs: w.player.cs,
    };
  });
  expect(waiting.camp.unitId).toBeNull();
  expect(waiting.corpseGone).toBe(true);
  expect(waiting.cs).toBe(4);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  requests.length = 0;
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(requests.some((u) => u.endsWith('/sru-gromp-base.glb'))).toBe(true);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  const resumed = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const deadline = w.jungleCamps[0].nextSpawnTick;
    const savedCamp = structuredClone(w.jungleCamps[0]);
    g.setPaused(true);
    w.tick = deadline - 2;
    w.step();
    const before = w.unit(w.jungleCamps[0].unitId).monster.phase;
    w.step();
    const unit = w.unit(w.jungleCamps[0].unitId);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      savedCamp,
      before,
      camps: structuredClone(w.jungleCamps),
      home: unit.monster.home,
      hp: unit.hp,
      maxHp: unit.maxHp,
      model: g.view.models.get(unit.id).referenceAsset,
      visible: g.view.models.get(unit.id).root.visible,
      gold: w.player.gold,
      cs: w.player.cs,
    };
  });
  expect(resumed.savedCamp).toEqual(waiting.camp);
  expect(resumed.before).toBe('spawning');
  expect(resumed.camps[0].unitId).not.toBe(spawned.camps[0].unitId);
  expect(resumed.camps[1].unitId).toBe(spawned.camps[1].unitId);
  expect(resumed.home).toEqual(spawned.home);
  expect(resumed.hp).toBe(resumed.maxHp);
  expect(resumed.model).toBe('sru-gromp-base');
  expect(resumed.visible).toBe(true);
  expect(resumed.cs).toBe(waiting.cs);
  expect(resumed.gold).toBeGreaterThanOrEqual(waiting.gold);
  await expect(page.locator('.unit-bar.neutral.monster:not([hidden])')).toBeVisible();
  await page.screenshot({ path: 'artifacts/rift-gromp-respawn.png' });
  expect(errors).toEqual([]);
});
