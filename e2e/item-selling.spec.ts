import { expect, test } from '@playwright/test';

test('shop sells a selected owned item and refreshes balance and inventory', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.keyboard.press('p');
  await page.locator('[data-buy="sword"]').click();
  await expect(page.locator('.shop-balance b')).toHaveText('◆ 150');
  await page.screenshot({ path: 'artifacts/item-selling-shop.png' });
  await page
    .getByRole('button', { name: 'Sell Long Sword, slot 1, for 245 gold', exact: true })
    .click();
  await expect(page.locator('.shop-balance b')).toHaveText('◆ 395');
  await expect(page.locator('.shop-owned')).toHaveText('No items owned.');
  await expect(page.locator('.shop-message')).toHaveText('Item sold');
  await expect(page.locator('#gold')).toHaveText('395');
});
