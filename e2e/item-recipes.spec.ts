import { expect, test } from '@playwright/test';
test('shop shows remaining recipe cost and consumes the owned component', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    (window as any).__GAME__.world.player.gold = 900;
  });
  await page.keyboard.press('p');
  await expect(page.locator('[data-buy="belt"] b')).toHaveText('◆ 900');
  await page.locator('[data-buy="ruby"]').click();
  await expect(page.locator('[data-buy="belt"] b')).toHaveText('◆ 500');
  await page.locator('[data-buy="belt"]').click();
  await expect(page.locator('.shop-balance b')).toHaveText('◆ 0');
  await expect(page.locator('.shop-owned [data-sell]')).toHaveCount(1);
  await expect(page.locator('.shop-owned img')).toHaveAttribute('src', /1011\.png/);
  await expect(page.locator('[data-buy="belt"] b')).toHaveText('◆ 900');
  await page.screenshot({ path: 'artifacts/item-recipes-shop.png' });
});
