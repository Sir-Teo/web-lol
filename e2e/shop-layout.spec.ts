import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 600, height: 700 },
]) {
  test(`shop keeps controls visible while browsing at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?scene=fixture');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      game.setPaused(true);
      game.world.player.gold = 10000;
      for (let i = 0; i < 6; i++) game.world.buy('sword');
    });
    await page.keyboard.press('p');
    const close = page.getByRole('button', { name: 'Close menu' });
    const originalClose = await close.boundingBox();
    await page.locator('[data-buy="vest"]').scrollIntoViewIfNeeded();
    await page.locator('[data-sell="5"]').scrollIntoViewIfNeeded();
    for (const selector of ['.close-button', '.shop-balance', '.shop-message', '.shop-panels h3']) {
      for (const locator of await page.locator(selector).all()) {
        await expect(locator).toBeInViewport({ ratio: 1 });
      }
    }
    expect(await close.boundingBox()).toEqual(originalClose);
    expect(await page.locator('.game-dialog').evaluate((el) => el.scrollTop)).toBe(0);
    expect(
      await page.locator('.game-dialog').evaluate((el) => el.scrollWidth <= el.clientWidth)
    ).toBe(true);
    await page.locator('[data-sell="5"]').click();
    await expect(page.locator('[data-sell]')).toHaveCount(5);
    await page.screenshot({ path: `artifacts/shop-layout-${viewport.width}.png` });
    await close.click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}
