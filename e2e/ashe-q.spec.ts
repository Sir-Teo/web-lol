import { expect, test } from '@playwright/test';

test('Focus pips fall off individually after inactivity', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    w.player.qStacks = 4;
    w.player.qStackExpiry = w.tick + 240;
    w.step(239);
  });
  await expect(page.locator('.focus-pips .charged')).toHaveCount(4);
  await page.evaluate(() => (window as any).__GAME__.world.step());
  await expect(page.locator('.focus-pips .charged')).toHaveCount(3);
  await page.evaluate(() => (window as any).__GAME__.world.step(60));
  await expect(page.locator('.focus-pips .charged')).toHaveCount(2);
});

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
