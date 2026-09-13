import { expect, test } from '@playwright/test';

test('closed shop stops purchase validation and refreshes current state when reopened', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.keyboard.press('p');
  await page.getByRole('button', { name: 'Close menu' }).click();
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const original = g.world.purchaseError;
    let calls = 0;
    g.world.purchaseError = function (...args: any[]) {
      calls++;
      return original.apply(this, args);
    };
    try {
      for (let i = 0; i < 100; i++) g.hud.update(60);
      return calls;
    } finally {
      g.world.purchaseError = original;
      g.world.player.gold = 850;
      g.world.buy('mantle');
    }
  });
  expect(result).toBe(0);
  await page.keyboard.press('p');
  await expect(page.locator('.shop-balance b')).toHaveText('◆ 450');
  await expect(page.locator('[data-buy="cloak"] b')).toHaveText('◆ 450');
  await expect(page.locator('[data-buy="cloak"]')).toBeEnabled();
  await expect(page.locator('[data-sell="0"] strong')).toHaveText('Null-Magic Mantle');
});
