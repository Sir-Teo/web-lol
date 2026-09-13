import { expect, test } from '@playwright/test';

test('Volley champion slow eases to basic Frost strength before expiring', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const ratios = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    const target = w.spawn('champion', 'red', { x: w.hero.x + 400, y: w.hero.y });
    target.stunUntil = Infinity;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'w', point: target });
    for (let i = 0; i < 60 && !target.criticalSlow; i++) w.step();
    const values = [w.movementSpeed(target) / target.speed];
    for (const ticks of [30, 30, 60]) {
      w.step(ticks);
      g.view.render(w, 1, 0);
      values.push(w.movementSpeed(target) / target.speed);
    }
    return values;
  });
  for (const [i, expected] of [0.6, 0.7, 0.8, 1].entries()) expect(ratios[i]).toBeCloseTo(expected);
});

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
