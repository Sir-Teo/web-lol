import { expect, test } from '@playwright/test';

test('Lux R presents charge and beam around its source cast animation, then cleans up', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const charge = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    [300, 650, 1000].forEach((x) => w.spawn('dummy', 'red', { x, y: 0 }));
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'r', point: { x: 3340, y: 0 } });
    w.step(30);
    g.view.render(w, 1, performance.now() / 1000);
    return {
      animation: g.view.models.get(lux.id).actionName,
      visible: [...g.view.luxBeams.models.values()].some((mesh: any) => mesh.visible),
      released: w.luxBeams.length,
    };
  });
  expect(charge).toEqual({ animation: 'spell4', visible: true, released: 0 });
  const fired = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(32);
    g.view.render(w, 1, performance.now() / 1000);
    return {
      beams: w.luxBeams.length,
      models: g.view.luxBeams.models.size,
      hit: w.units.filter((u: any) => u.kind === 'dummy').map((u: any) => u.hp < u.maxHp),
    };
  });
  expect(fired).toEqual({ beams: 1, models: 1, hit: [true, true, true] });
  await page.screenshot({ path: 'artifacts/lux-r-match.png' });
  const remaining = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(18);
    g.view.render(g.world, 1, performance.now() / 1000);
    return g.view.luxBeams.models.size;
  });
  expect(remaining).toBe(0);
  expect(errors).toEqual([]);
});
