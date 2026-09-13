import { expect, test } from '@playwright/test';

test('Tome purchase and sale change the live Crystal Arrow tooltip', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.keyboard.press('p');
  await page.locator('[data-buy="tome"]').click();
  await expect(page.locator('[data-sell="0"] strong')).toHaveText('Amplifying Tome');
  await page.getByRole('button', { name: 'Close menu' }).click();
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  await page.getByRole('button', { name: 'Enchanted Crystal Arrow', exact: true }).focus();
  await expect(page.getByRole('tooltip')).toContainText('224 magic damage');
  await page.screenshot({ path: 'artifacts/ability-power-tooltip.png' });
  await page.keyboard.press('p');
  await page.locator('[data-sell="0"]').click();
  await page.getByRole('button', { name: 'Close menu' }).click();
  await page.getByRole('button', { name: 'Enchanted Crystal Arrow', exact: true }).focus();
  await expect(page.getByRole('tooltip')).toContainText('200 magic damage');
});
