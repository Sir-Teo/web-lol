import { expect, test } from '@playwright/test';

test('champion divisions follow maximum health through leveling and item purchases', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const id = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.view.render(g.world, 1, 0);
    return g.world.hero.id;
  });
  const bar = page.locator(`.unit-bar[data-unit="${id}"]`);
  for (const [stage, maxHp] of [
    ['base', 610],
    ['level18', 2327],
    ['item', 2407],
  ] as const) {
    await page.evaluate((stage) => {
      const g = (window as any).__GAME__;
      if (stage === 'level18') g.world.gainExperience(1e6);
      if (stage === 'item') g.world.buy('blade');
      g.view.render(g.world, 1, 0);
    }, stage);
    await expect(bar).toBeVisible();
    const metrics = await bar.evaluate((element) => {
      const hp = element.querySelector('.unit-hp')!;
      return {
        max: Number((element as HTMLElement).dataset.maxHealth),
        minor: parseFloat(getComputedStyle(hp, '::before').backgroundSize),
        major: parseFloat(getComputedStyle(hp, '::after').backgroundSize),
        width: element.getBoundingClientRect().width,
      };
    });
    expect(metrics.max).toBe(maxHp);
    expect(metrics.minor).toBeCloseTo(10000 / maxHp, 3);
    expect(metrics.major).toBeCloseTo(100000 / maxHp, 3);
    expect(metrics.width).toBe(86);
    await bar.screenshot({ path: `artifacts/health-divisions-${stage}.png` });
  }
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    const target = g.world.spawn('champion', 'red', { x: g.world.hero.x + 100, y: g.world.hero.y });
    target.maxHp = 682.72;
    target.hp = 582.72;
    g.view.selected = target.id;
    g.hud.update(60);
  });
  await expect(page.locator('#target-hp')).toHaveText('583 / 683');
});
