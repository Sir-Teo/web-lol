import { expect, test } from '@playwright/test';

test('crystal arrow reaches its source speed cap and survives presentation updates', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const startX = w.hero.x;
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: 'r',
      point: { x: startX + 10000, y: w.hero.y },
    });
    w.step(60);
    g.view.render(w, 1, 0);
    const early = { speed: w.projectiles[0].speed, distance: w.projectiles[0].x - startX };
    w.step(120);
    g.view.render(w, 1, 0);
    return { early, speed: w.projectiles[0].speed, distance: w.projectiles[0].x - startX };
  });
  expect(result.early.speed).toBeCloseTo(1700);
  expect(result.early.distance).toBeCloseTo(1600);
  expect(result.speed).toBeCloseTo(2100);
  expect(result.distance).toBeCloseTo(5400);
});
