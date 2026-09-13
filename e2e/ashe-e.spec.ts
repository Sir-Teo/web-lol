import { expect, test } from '@playwright/test';

test('Hawkshot displays charges, cast delay, recharge and practice reset', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.nextWaveTick = Infinity;
  });
  const button = page.locator('[data-ability="e"]');
  await expect(button.locator('.ability-charges')).toHaveText('2');
  await expect(button.locator('.ability-recharge')).toBeHidden();
  // Real keyboard input is disabled while paused, so run briefly for each cast.
  await page.mouse.move(700, 400);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.press('e');
  await expect(button.locator('.ability-charges')).toHaveText('1');
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  await expect(button.locator('.cooldown-text')).toHaveText('5');
  await expect(button.locator('.ability-recharge')).toBeVisible();
  await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.step(w.player.cooldowns.e - w.tick);
  });
  await expect(button).not.toHaveClass(/cooling/);
  await expect(button.locator('.cooldown-text')).toHaveText('');
  await page.screenshot({ path: 'artifacts/browser-hawkshot-one-charge.png' });
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.press('e');
  await expect(button.locator('.ability-charges')).toHaveText('0');
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  await expect(button.locator('.cooldown-text')).toHaveText('85');
  await expect(button).toHaveClass(/cooling/);
  await expect(button).toHaveAccessibleName('Hawkshot, 0 of 2 charges, next charge in 85 seconds');
  await page.screenshot({ path: 'artifacts/browser-hawkshot-empty.png' });
  await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.step(w.player.eRechargeTick - w.tick);
  });
  await expect(button.locator('.ability-charges')).toHaveText('1');
  await expect(button).not.toHaveClass(/cooling/);
  await expect(button).toHaveAccessibleName('Hawkshot, 1 of 2 charges, next charge in 90 seconds');
  await page.getByRole('button', { name: /Practice tools/ }).click();
  await page.getByRole('button', { name: 'Reset cooldowns', exact: true }).click();
  await expect(button.locator('.ability-charges')).toHaveText('2');
  await expect(button.locator('.ability-recharge')).toBeHidden();
  await expect(button).not.toHaveClass(/cooling/);
});
