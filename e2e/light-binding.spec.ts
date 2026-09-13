import { expect, test } from '@playwright/test';

test('binding resolution crosses two enemies, displays roots and leaves the third untouched', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    w.setOrder(w.hero, { type: 'idle' });
    const enemies = [200, 500, 800].map((x) => w.spawn('champion', 'red', { x, y: 0 }));
    w.releaseLightBinding(w.hero, { x: 1300, y: 0 }, 80);
    w.step(5);
    g.view.render(w, 1, performance.now() / 1000);
    const visible = [...g.view.projectileModels.values()].some((model: any) => model.visible);
    w.step(25);
    g.view.render(w, 1, performance.now() / 1000);
    return {
      visible,
      ids: enemies.map((u: any) => u.id),
      hit: enemies.map((u: any) => u.hp < u.maxHp),
      remaining: w.projectiles.length,
    };
  });
  expect(result.visible).toBe(true);
  expect(result.hit).toEqual([true, true, false]);
  expect(result.remaining).toBe(0);
  for (const id of result.ids.slice(0, 2))
    await expect(page.locator(`.unit-bar[data-unit="${id}"] .unit-status`)).toHaveText('ROOTED');
  expect(errors).toEqual([]);
});
