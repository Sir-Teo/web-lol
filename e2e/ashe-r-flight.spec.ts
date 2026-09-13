import { expect, test } from '@playwright/test';

test('a distant enemy is revealed by the traveling arrow and hidden after it is removed', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    w.units = [w.hero];
    const enemy = w.spawn('dummy', 'red', { x: 3600, y: 0 });
    const before = w.visible(enemy);
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: 'r',
      point: { x: w.hero.x + 10000, y: w.hero.y },
    });
    w.step();
    Object.assign(w.projectiles[0], { x: 3000, y: 0, previous: { x: 3000, y: 0 } });
    g.view.render(w, 1, 0);
    const during = w.visible(enemy);
    w.projectiles.length = 0;
    g.view.render(w, 1, 0);
    return { before, during, after: w.visible(enemy) };
  });
  expect(result).toEqual({ before: false, during: true, after: false });
});

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
