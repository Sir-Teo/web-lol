import { expect, test } from '@playwright/test';

test('rank-one Volley creates seven arrows with its current damage and flight speed', async ({
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
    w.enqueue({
      type: 'cast',
      unit: w.hero.id,
      ability: 'w',
      point: { x: w.hero.x + 1200, y: w.hero.y },
    });
    w.step();
    g.view.render(w, 1, 0);
    return w.projectiles.map((p: any) => ({
      damage: p.damage,
      speed: p.speed,
      remaining: p.remaining,
    }));
  });
  expect(result).toHaveLength(7);
  for (const arrow of result) expect(arrow).toEqual({ damage: 60, speed: 1500, remaining: 1175 });
});
