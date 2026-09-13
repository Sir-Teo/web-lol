import { expect, test } from '@playwright/test';

test('earned points upgrade through HUD and Ctrl hotkeys without casting', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const upgradeW = page.getByRole('button', { name: 'Upgrade Volley', exact: true });
  await expect(upgradeW).toBeHidden();
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.nextWaveTick = Infinity;
    g.world.gainExperience(660);
    g.hud.update(60);
  });
  await expect(upgradeW).toBeVisible();
  await expect(upgradeW).toBeInViewport({ ratio: 1 });
  const titleBounds = await page.locator('.champion-title').boundingBox();
  const upgradeBounds = await upgradeW.boundingBox();
  expect(upgradeBounds!.y).toBeGreaterThanOrEqual(titleBounds!.y + titleBounds!.height);
  await page.screenshot({ path: 'artifacts/spell-learning-controls.png' });
  await upgradeW.click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.player.spellRanks.w))
    .toBe(2);
  await expect(upgradeW).toBeHidden();
  await expect(page.locator('[data-ability="w"] .ability-cost')).toHaveText('70');
  await page.keyboard.press('Control+q');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.player.spellRanks.q))
    .toBe(2);
  const state = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return {
      points: g.world.player.skillPoints,
      castEvents: g.world.events.filter((e: any) => e.type === 'cast').length,
    };
  });
  expect(state).toEqual({ points: 0, castEvents: 0 });
  await expect(page.locator('.spell-learn:visible')).toHaveCount(0);
  expect(errors).toEqual([]);
});
