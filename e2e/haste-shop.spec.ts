import { expect, test } from '@playwright/test';

test('Codex completion updates live spell cooldown and Hawkshot recharge tooltips', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.player.gold = 850;
    g.world.buy('tome');
    g.world.buy('mote');
  });
  await page.keyboard.press('p');
  const codex = page.locator('[data-buy="codex"]');
  await expect(codex.locator('b')).toHaveText('◆ 200');
  await expect(codex).toContainText('+10 Ability Haste');
  await codex.scrollIntoViewIfNeeded();
  await expect
    .poll(() => codex.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await codex.click();
  await expect(page.locator('#ap')).toHaveText('25');
  await page.keyboard.press('p');
  await page.locator('[data-ability="w"]').hover();
  await expect(page.getByRole('tooltip')).toContainText('16.36s COOLDOWN');
  await page.locator('[data-ability="e"]').hover();
  await expect(page.getByRole('tooltip')).toContainText('81.82 seconds');
  await page.screenshot({ path: 'artifacts/haste-tooltip.png' });
  await page.evaluate(() => {
    (window as any).__GAME__.world.sell(0);
  });
  await expect(page.getByRole('tooltip')).toContainText('90 seconds');
});
