import { expect, test } from '@playwright/test';

test('shield capacity is visible above health, absorbs damage and disappears on expiry', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const id = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const lux = w.spawn('champion', 'blue', { x: -200, y: 0 }, 'lux');
    w.applyShield(lux, w.hero, 200, 150);
    g.view.render(w, 1, performance.now() / 1000);
    return w.hero.id;
  });
  const shield = page.locator(`.unit-bar[data-unit="${id}"] .unit-shield`);
  await expect(shield).toBeVisible();
  await expect(shield).toHaveAttribute('title', '200 shield');
  const widths = await page.locator(`.unit-bar[data-unit="${id}"]`).evaluate((bar) => ({
    health: parseFloat((bar.querySelector('.unit-hp i') as HTMLElement).style.width),
    shield: parseFloat((bar.querySelector('.unit-shield') as HTMLElement).style.width),
  }));
  expect(widths.health + widths.shield).toBeCloseTo(100);
  expect(widths.shield).toBeCloseTo((200 / 810) * 100);
  await page.screenshot({ path: 'artifacts/shield-health-bar.png' });
  const hpUnchanged = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const enemy = w.spawn('champion', 'red', { x: 500, y: 0 });
    w.damage(enemy, w.hero, 100, 'true');
    g.view.render(w, 1, performance.now() / 1000);
    return w.hero.hp === w.hero.maxHp;
  });
  expect(hpUnchanged).toBe(true);
  await expect(shield).toHaveAttribute('title', '100 shield');
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(150);
    g.view.render(g.world, 1, performance.now() / 1000);
  });
  await expect(shield).toBeHidden();
  expect(errors).toEqual([]);
});
