import { expect, test } from '@playwright/test';

test('Infinity Edge upgrades a full inventory and retains its modifiers through reload and sale', async ({
  page,
}) => {
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
  };
  await page.goto('/?scene=fixture');
  await ready();
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.player.gold = 6000;
  });
  await page.keyboard.press('p');
  for (const item of ['bf-sword', 'pickaxe', 'agility', 'agility', 'boots', 'sword'])
    await page.locator(`[data-buy="${item}"]`).click();
  await expect(page.locator('[data-buy="infinity-edge"] b')).toHaveText('◆ 725');
  await page.locator('[data-buy="infinity-edge"]').click();
  await expect(page.locator('.shop-balance b')).toHaveText('◆ 1250');
  const icon = page.locator('#inventory img[src$="3031.png"]');
  await expect(icon).toHaveCount(1);
  expect(
    await icon.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth === 64)
  ).toBe(true);
  const read = () =>
    page.evaluate(() => {
      const w = (window as any).__GAME__.world;
      return {
        inventory: w.player.inventory,
        damage: w.hero.damage,
        chance: w.criticalChance(),
        multiplier: w.basicAttackDamageMultiplier(),
      };
    });
  const before = await read();
  expect(before.chance).toBe(0.4);
  expect(before.multiplier).toBe(1.52);
  await page.screenshot({ path: 'artifacts/infinity-edge-shop.png' });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready();
  expect(await read()).toEqual(before);
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.hud.closeModal();
    g.setPaused(true);
  });
  await page.keyboard.press('p');
  await page
    .getByRole('button', { name: 'Sell Infinity Edge, slot 1, for 2450 gold', exact: true })
    .click();
  const after = await read();
  expect(after.damage).toBe(before.damage - 75);
  expect(after.chance).toBe(0.15);
  expect(after.multiplier).toBe(1.15);
  await expect(page.locator('.shop-balance b')).toHaveText('◆ 3700');
});
