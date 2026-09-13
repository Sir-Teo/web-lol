import { expect, test } from '@playwright/test';

test('real Heal input grants support assist HUD credit after an ally kill', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const setup = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    for (const unit of w.units) unit.ai = false;
    const ally = w.spawn('champion', 'blue', { x: w.hero.x + 400, y: w.hero.y });
    const victim = w.spawn('champion', 'red', { x: w.hero.x + 700, y: w.hero.y });
    ally.ai = victim.ai = false;
    ally.hp = 100;
    return { ally: ally.id, victim: victim.id, point: g.view.screenPoint(ally, 0.65) };
  });
  await page.mouse.move(setup.point.x, setup.point.y);
  await page.keyboard.press('f');
  await expect
    .poll(() =>
      page.evaluate(
        (id) => (window as any).__GAME__.world.championState(id).supportContributors.length,
        setup.ally
      )
    )
    .toBe(1);
  await page.evaluate(({ ally, victim }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.damage(w.unit(ally), w.unit(victim), 10000, 'true');
    g.hud.update(60);
  }, setup);
  await expect(page.locator('#personal')).toHaveText('0 / 0 / 1');
  await expect(page.locator('#kills')).toHaveText('1');
  expect(errors).toEqual([]);
});
