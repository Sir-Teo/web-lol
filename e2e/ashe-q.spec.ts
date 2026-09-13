import { expect, test } from '@playwright/test';

test('Q remains empowered after four seconds and expires at six', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    w.player.qStacks = 4;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.step();
    w.step(240);
  });
  const button = page.locator('[data-ability="q"]');
  await expect(button).toHaveClass(/empowered/);
  await page.evaluate(() => (window as any).__GAME__.world.step(119));
  await expect(button).toHaveClass(/empowered/);
  await page.evaluate(() => (window as any).__GAME__.world.step());
  await expect(button).not.toHaveClass(/empowered/);
});
