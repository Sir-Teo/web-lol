import { expect, test } from '@playwright/test';

test('level progression updates readable resources, stats, regeneration and the capped XP bar', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.gainExperience(280);
    g.hud.update(60);
  });
  await expect(page.locator('#level')).toHaveText('2');
  await expect(page.locator('#health-text')).toHaveText('683 / 683');
  await expect(page.locator('#mana-text')).toHaveText('305 / 305');
  await expect(page.locator('#ad')).toHaveText('62');
  await expect(page.locator('#armor')).toHaveText('29');
  await expect(page.locator('#health-regen')).toHaveText('+0.8');
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.gainExperience(1e6);
    g.hud.update(60);
  });
  await expect(page.locator('#level')).toHaveText('18');
  await expect(page.locator('#health-text')).toHaveText('2327 / 2327');
  await expect(page.locator('#mana-text')).toHaveText('875 / 875');
  await expect(page.locator('#ad')).toHaveText('119');
  await expect(page.locator('#armor')).toHaveText('104');
  await expect(page.locator('#health-regen')).toHaveText('+2.6');
  await expect(page.locator('#xp-fill')).toHaveCSS(
    'width',
    await page.locator('#xp-fill').evaluate((element) => `${element.parentElement!.clientWidth}px`)
  );
  await page.screenshot({ path: 'artifacts/browser-level-18.png' });
});
