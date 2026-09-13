import { expect, test } from '@playwright/test';

test('Frost Shot changes applied speed with level and clears at expiry', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  const results = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    const result = [];
    for (const level of [1, 18]) {
      if (level === 18) w.gainExperience(1e6);
      const target = w.spawn('dummy', 'red', { x: w.hero.x + 400, y: w.hero.y });
      target.speed = 325;
      w.setOrder(w.hero, { type: 'attack', target: target.id });
      for (let i = 0; i < 150 && !target.slowUntil; i++) w.step();
      w.setOrder(w.hero, { type: 'idle' });
      const ratio = w.movementSpeed(target) / target.speed;
      w.step(120);
      result.push({ ratio, expired: w.movementSpeed(target) === target.speed });
    }
    return result;
  });
  expect(results[0].ratio).toBeCloseTo(0.8);
  expect(results[1].ratio).toBeCloseTo(0.7);
  expect(results.every((result) => result.expired)).toBe(true);
});
