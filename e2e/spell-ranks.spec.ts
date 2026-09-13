import { expect, test } from '@playwright/test';

test('HUD follows owned spell ranks, including live tooltip resources and unlearned spells', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  const volley = page.getByRole('button', { name: 'Volley', exact: true });
  const tip = page.getByRole('tooltip');
  await volley.focus();
  await expect(tip).toContainText('75 MANA');
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.player.spellRanks = { q: 5, w: 5, e: 5, r: 3 };
    g.hud.update(60);
  });
  await expect(tip).toContainText('11 frost arrows');
  await expect(tip).toContainText('200 physical damage');
  await expect(tip).toContainText('55 MANA');
  await expect(tip).toContainText('4s COOLDOWN');
  await expect(volley.locator('.ability-cost')).toHaveText('55');
  await page.getByRole('button', { name: 'Ranger’s Focus', exact: true }).focus();
  await expect(tip).toContainText('60% attack speed');
  await expect(tip).toContainText('130% damage');
  await page.getByRole('button', { name: /^Hawkshot/ }).focus();
  await expect(tip).toContainText('every 50 seconds');
  await page.getByRole('button', { name: 'Enchanted Crystal Arrow', exact: true }).focus();
  await expect(tip).toContainText('600 magic damage');
  await expect(tip).toContainText('60s COOLDOWN');
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.player.spellRanks.r = 0;
    g.hud.update(60);
  });
  await expect(tip).toContainText('This ability has not been learned.');
  expect(errors).toEqual([]);
});
