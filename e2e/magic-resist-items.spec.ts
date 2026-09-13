import { expect, test } from '@playwright/test';

test('magic resistance component upgrades and sells through the shop', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const game = (window as any).__GAME__;
    game.setPaused(true);
    game.world.player.gold = 850;
  });
  await expect(page.locator('#mr')).toHaveText('33');
  await page.keyboard.press('p');
  await page.locator('[data-buy="mantle"]').click();
  await expect(page.locator('#mr')).toHaveText('53');
  await expect(page.locator('[data-buy="cloak"] b')).toHaveText('◆ 450');
  await page.locator('[data-buy="cloak"]').click();
  await expect(page.locator('#mr')).toHaveText('78');
  await expect(page.locator('[data-sell]')).toHaveCount(1);
  await expect(page.locator('[data-sell="0"] strong')).toHaveText('Negatron Cloak');
  expect(await page.evaluate(() => (window as any).__GAME__.world.hero.magicResist)).toBe(78);
  await page.screenshot({ path: 'artifacts/magic-resist-items-shop.png' });
  await page.locator('[data-sell="0"]').click();
  await expect(page.locator('.shop-balance b')).toHaveText('◆ 595');
  await expect(page.locator('#mr')).toHaveText('33');
  await page.getByRole('button', { name: 'Close menu' }).click();
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  await page.screenshot({ path: 'artifacts/magic-resist-hud.png' });
  for (const stat of ['ad', 'armor', 'mr', 'as', 'ms']) {
    await expect(page.locator(`#${stat}`)).toBeInViewport({ ratio: 1 });
  }
});
