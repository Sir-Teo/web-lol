import { expect, test } from '@playwright/test';
test('armor purchases, upgrade and sale update the HUD', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    (window as any).__GAME__.world.player.gold = 800;
  });
  await page.keyboard.press('p');
  await page.locator('[data-buy="cloth"]').click();
  await expect(page.locator('#armor')).toHaveText('41');
  await expect(page.locator('[data-buy="vest"] b')).toHaveText('◆ 500');
  await page.locator('[data-buy="vest"]').click();
  await expect(page.locator('#armor')).toHaveText('66');
  await page.locator('[data-sell="0"]').click();
  await expect(page.locator('#armor')).toHaveText('26');
  await expect(page.locator('#gold')).toHaveText('560');
  await page.screenshot({ path: 'artifacts/armor-items-shop.png' });
});
