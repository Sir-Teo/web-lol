import { expect, test } from '@playwright/test';

test('Sapphire Crystal shop purchase and sale update the visible mana pool', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const base = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.hero.mana = 40;
    g.world.player.gold = 300;
    return g.world.hero.maxMana;
  });
  await page.keyboard.press('p');
  const crystal = page.locator('[data-buy="sapphire"]');
  await expect(crystal).toContainText('+300 Mana');
  await expect(crystal.locator('b')).toHaveText('◆ 300');
  expect(
    await crystal.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)
  ).toBeGreaterThan(0);
  await crystal.click();
  await expect(page.locator('#mana-text')).toHaveText(`340 / ${base + 300}`);
  await expect(page.locator('.shop-balance b')).toHaveText('◆ 0');
  await page.screenshot({ path: 'artifacts/mana-shop.png' });
  await page
    .getByRole('button', { name: 'Sell Sapphire Crystal, slot 1, for 210 gold', exact: true })
    .click();
  await expect(page.locator('#mana-text')).toHaveText(`40 / ${base}`);
  await expect(page.locator('.shop-balance b')).toHaveText('◆ 210');
  await expect(page.locator('.shop-owned')).toHaveText('No items owned.');
});
