import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page) {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    w.player = w.championState(lux.id);
    w.units = [lux];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    w.gainExperience(2400, lux.id);
    w.player.spellRanks = { q: 1, w: 1, e: 1, r: 1 };
    w.player.skillPoints = w.player.level - 4;
    lux.mana = lux.maxMana;
    const target = w.spawn('dummy', 'red', { x: 650, y: 0 });
    g.view.locked = false;
    g.view.center = { x: 300, y: 0 };
    g.view.render(w, 1, performance.now() / 1000);
    const p = g.view.screenPoint({ x: 650, y: 0 });
    g.setPaused(false);
    return { point: p, target: target.id };
  });
}

test('Lux Q holds a linear guide, releases Binding toward the cursor and can be cancelled', async ({
  page,
}) => {
  const { point, target } = await setup(page);
  await page.mouse.move(point.x, point.y);
  await page.keyboard.down('q');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.view.aimLine.geometry.drawRange.count))
    .toBe(5);
  const held = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return {
      mode: g.view.aimMode,
      count: g.view.aimLine.geometry.drawRange.count,
      cast: g.world.player.pendingCast,
      cd: g.world.player.cooldowns.q,
    };
  });
  expect(held).toEqual({ mode: 'q', count: 5, cast: null, cd: 0 });
  await page.screenshot({ path: 'artifacts/lux-player-binding-aim.png' });
  await page.keyboard.press('Escape');
  await page.keyboard.up('q');
  expect(await page.evaluate(() => (window as any).__GAME__.world.player.cooldowns.q)).toBe(0);
  await page.keyboard.down('q');
  await page.keyboard.up('q');
  await page.waitForFunction(
    (id) => (window as any).__GAME__.world.unit(id).rootUntil > (window as any).__GAME__.world.tick,
    target
  );
  expect(
    await page.evaluate((id) => (window as any).__GAME__.world.unit(id).illumination.length, target)
  ).toBe(1);
});

test('Lux W and R use straight corridors while E shows its circle and recasts without cursor targeting', async ({
  page,
}) => {
  const { point } = await setup(page);
  await page.mouse.move(point.x, point.y);
  for (const key of ['w', 'r']) {
    await page.keyboard.down(key);
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).__GAME__.view.aimLine.geometry.drawRange.count)
      )
      .toBe(5);
    await page.keyboard.press('Escape');
    await page.keyboard.up(key);
  }
  await page.keyboard.down('e');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.view.aimLine.geometry.drawRange.count))
    .toBe(33);
  await page.screenshot({ path: 'artifacts/lux-player-singularity-aim.png' });
  await page.keyboard.up('e');
  await page.waitForFunction(() =>
    (window as any).__GAME__.world.singularities.some((z: any) => z.arrivalTick !== null)
  );
  const before = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    return { mana: w.hero.mana, cd: w.player.cooldowns.e };
  });
  await page.mouse.move(15, 15);
  await page.keyboard.press('e');
  await page.waitForFunction(() =>
    (window as any).__GAME__.world.singularities.some((z: any) => z.detonatedTick !== null)
  );
  const after = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return { mode: g.view.aimMode, mana: g.world.hero.mana, cd: g.world.player.cooldowns.e };
  });
  expect(after.mode).toBeNull();
  expect(after.mana).toBeGreaterThanOrEqual(before.mana);
  expect(after.cd).toBe(before.cd);
});

test('Lux releases Barrier and Final Spark through normal player keys', async ({ page }) => {
  const { point, target } = await setup(page);
  await page.mouse.move(point.x, point.y);
  await page.keyboard.down('w');
  await page.keyboard.up('w');
  await page.waitForFunction(() => (window as any).__GAME__.world.hero.shields.length > 0);
  await page.waitForFunction(() => (window as any).__GAME__.world.player.pendingCast === null);
  await page.keyboard.down('r');
  await page.keyboard.up('r');
  await page.waitForFunction((id) => {
    const w = (window as any).__GAME__.world;
    return w.unit(id).hp < w.unit(id).maxHp;
  }, target);
  const result = await page.evaluate((id) => {
    const w = (window as any).__GAME__.world;
    return { hp: w.unit(id).hp, max: w.unit(id).maxHp, cd: w.player.cooldowns.r, tick: w.tick };
  }, target);
  expect(result.hp).toBeLessThan(result.max - 200);
  expect(result.cd).toBeGreaterThan(result.tick);
});

test('an early second E press requests detonation through the initial cast or flight', async ({
  page,
}) => {
  const { point, target } = await setup(page);
  await page.mouse.move(point.x, point.y);
  await page.keyboard.press('e');
  await page.waitForFunction(() => {
    const w = (window as any).__GAME__.world;
    return w.player.pendingCast?.ability === 'e' || w.singularities.length > 0;
  });
  await page.mouse.move(15, 15);
  await page.keyboard.press('e');
  await page.waitForFunction(() => {
    const w = (window as any).__GAME__.world;
    return (
      w.player.pendingCast?.detonateRequested ||
      w.singularities.some((z: any) => z.detonateRequested)
    );
  });
  await page.waitForFunction((id) => {
    const w = (window as any).__GAME__.world;
    return w.unit(id).hp < w.unit(id).maxHp;
  }, target);
  expect(await page.evaluate(() => (window as any).__GAME__.view.aimMode)).toBeNull();
});
