import { expect, test } from '@playwright/test';

test('shop loads mage icons and completes Deathcap from two rods with correct AP and ownership', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.player.gold = 5000;
    w.buy('rod');
    w.buy('tome');
    w.buy('rod');
    w.player.gold = 1100;
  });
  await page.keyboard.press('p');
  const cap = page.locator('[data-buy="deathcap"]');
  await expect(cap.locator('b')).toHaveText('◆ 1100');
  await expect(cap).toBeEnabled();
  for (const item of ['wand', 'rod', 'deathcap']) {
    await expect(page.locator(`[data-buy="${item}"] img`)).toHaveJSProperty('complete', true);
    expect(
      await page
        .locator(`[data-buy="${item}"] img`)
        .evaluate((img: HTMLImageElement) => img.naturalWidth)
    ).toBeGreaterThan(0);
  }
  await cap.click();
  await expect(page.locator('#ap')).toHaveText('195');
  const state = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    return { inventory: w.player.inventory, gold: w.player.gold };
  });
  expect(state.inventory.filter((id: string) => id === 'deathcap')).toHaveLength(1);
  expect(state.inventory).not.toContain('rod');
  expect(state.gold).toBe(0);
  await page.evaluate(() => {
    (window as any).__GAME__.world.player.gold = 3500;
  });
  await expect(cap).toBeDisabled();
  await expect(cap).toHaveAttribute('title', 'You already own Rabadon’s Deathcap');
  await page.screenshot({ path: 'artifacts/mage-shop.png' });
});
