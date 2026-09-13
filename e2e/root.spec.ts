import { expect, test } from '@playwright/test';

test('root displays its own status, permits attacks and resumes movement after expiry', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const state = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const enemy = w.spawn('champion', 'red', { x: 200, y: 0 });
    w.applyRoot(w.hero, 120);
    w.setOrder(w.hero, { type: 'attack', target: enemy.id });
    w.step(40);
    g.view.render(w, 1, performance.now() / 1000);
    return { id: w.hero.id, hit: enemy.hp < enemy.maxHp, x: w.hero.x };
  });
  expect(state.hit).toBe(true);
  expect(state.x).toBe(0);
  await expect(page.locator(`.unit-bar[data-unit="${state.id}"] .unit-status`)).toHaveText(
    'ROOTED'
  );
  const resumed = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.setOrder(w.hero, { type: 'move', point: { x: -1000, y: 0 } });
    w.step(79);
    const held = w.hero.x;
    w.step();
    g.view.render(w, 1, performance.now() / 1000);
    return { held, x: w.hero.x };
  });
  expect(resumed.held).toBe(0);
  expect(resumed.x).toBeLessThan(0);
  await expect(page.locator(`.unit-bar[data-unit="${state.id}"] .unit-status`)).toHaveText('');
  expect(errors).toEqual([]);
});
