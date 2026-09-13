import { expect, test } from '@playwright/test';

test('open shop follows inventory changes and preserves usable keyboard focus', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const game = (window as any).__GAME__;
    game.setPaused(true);
    game.world.player.gold = 10000;
    game.world.buy('sword');
    game.world.buy('boots');
  });
  await page.keyboard.press('p');
  await page.locator('[data-sell="1"]').focus();
  await page.evaluate(() => (window as any).__GAME__.world.buy('cloth'));
  await expect(page.locator('[data-sell]')).toHaveCount(3);
  await expect(page.locator('[data-sell="1"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-sell="2"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-sell="0"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Close menu' })).toBeFocused();
  await expect(page.locator('.shop-owned')).toHaveText('No items owned.');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a stale sale control cannot sell a different item moved into its slot', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const game = (window as any).__GAME__;
    game.setPaused(true);
    game.world.player.gold = 10000;
    game.world.buy('sword');
    game.world.buy('boots');
  });
  await page.keyboard.press('p');
  await page.evaluate(() => {
    const world = (window as any).__GAME__.world;
    world.moveItem(0, 1);
    // Same task: exercise the interval before the next HUD animation frame.
    document.querySelector<HTMLButtonElement>('[data-sell="0"]')!.click();
  });
  await expect(page.locator('.shop-message')).toHaveText(
    'Inventory changed. Select the item again.'
  );
  await expect(page.locator('[data-sell="0"] strong')).toHaveText('Boots');
  await expect(page.locator('[data-sell="1"] strong')).toHaveText('Long Sword');
  await expect(page.locator('.shop-balance b')).toHaveText('◆ 9350');
});
