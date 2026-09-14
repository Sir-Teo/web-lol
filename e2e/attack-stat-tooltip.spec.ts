import { expect, test } from '@playwright/test';

test('attack stat inspection tracks crit items, supports keyboard dismissal and hides for dialogs', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.player.gold = 10000;
  });
  const stat = page.locator('.champion-stats [aria-label="Attack damage"]');
  const tip = page.locator('#attack-stat-tooltip');
  await stat.hover();
  await expect(tip).toBeVisible();
  await expect(tip.locator('p')).toContainText('Critical strike chance: 0%. Frost Shot: 100%');
  await stat.focus();
  await page.mouse.move(20, 20);
  await expect(tip).toBeVisible();
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.buy('infinity-edge');
    g.hud.update(60);
  });
  await expect(tip.locator('p')).toContainText('Critical strike chance: 25%. Frost Shot: 132.5%');
  await expect(stat).toHaveAttribute('aria-describedby', 'attack-stat-tooltip');
  await page.screenshot({ path: 'artifacts/attack-stat-tooltip.png' });
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  expect(await page.evaluate(() => (window as any).__GAME__.hud.modal)).toBeNull();
  await expect(stat).not.toHaveAttribute('aria-describedby');
  await page.locator('#shop-button').focus();
  await stat.focus();
  await expect(tip).toBeVisible();
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.sell(0);
    g.hud.update(60);
  });
  await expect(tip.locator('p')).toContainText('Critical strike chance: 0%. Frost Shot: 100%');
  await page.keyboard.press('p');
  await expect(tip).toBeHidden();
});

test('Lux stat tooltip reports ordinary critical damage and stays inside a smaller viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1120, height: 720 });
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  await page.goto('/');
  await ready();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await page.getByRole('button', { name: 'Lux', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Start practice', exact: true }).click(),
  ]);
  await ready();
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.player.gold = 3500;
    g.world.buy('infinity-edge');
    g.hud.update(60);
  });
  await page.locator('.champion-stats [aria-label="Attack damage"]').focus();
  const tip = page.locator('#attack-stat-tooltip');
  await expect(tip.locator('p')).toHaveText(
    'Critical strike chance: 25%. Critical strikes: 230% of attack damage.'
  );
  const bounds = await tip.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(12);
  expect(bounds!.y).toBeGreaterThanOrEqual(12);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1108);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(708);
});
