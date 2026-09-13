import { expect, test } from '@playwright/test';

test('queued Lux Q leaves a visible mark after root ends, and her attack consumes it', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const ids = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    const target = w.spawn('dummy', 'red', { x: 200, y: 0 });
    Object.assign(target, { hp: 5000, maxHp: 5000, armor: 0, magicResist: 0 });
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'q', point: { x: 1300, y: 0 } });
    w.step(145);
    g.view.render(w, 1, performance.now() / 1000);
    return { lux: lux.id, target: target.id };
  });
  await expect(page.locator(`.unit-bar[data-unit="${ids.target}"] .unit-status`)).toHaveText(
    'ILLUMINATED'
  );
  const result = await page.evaluate(({ lux, target }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    const before = w.unit(target).hp;
    w.enqueue({ type: 'order', unit: lux, order: { type: 'attack', target } });
    w.step(30);
    g.view.render(w, 1, performance.now() / 1000);
    return { damage: before - w.unit(target).hp, marks: w.unit(target).illumination.length };
  }, ids);
  expect(result).toEqual({ damage: 84, marks: 0 });
  await expect(page.locator(`.unit-bar[data-unit="${ids.target}"] .unit-status`)).toHaveText('');
  expect(errors).toEqual([]);
});
