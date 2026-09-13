import { expect, test } from '@playwright/test';

test('open shop availability follows gold, components, capacity and fountain access', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.keyboard.press('p');
  const belt = page.locator('[data-buy="belt"]');
  await expect(belt).toBeDisabled();
  await expect(belt).toHaveAttribute('title', 'Not enough gold');
  await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.player.gold = 5000;
    for (const id of ['ruby', 'sword', 'sword', 'sword', 'sword', 'sword']) w.buy(id);
    w.player.gold = 500;
  });
  await expect(belt).toBeEnabled();
  await expect(belt.locator('b')).toHaveText('◆ 500');
  await expect(page.locator('[data-buy="ruby"]')).toHaveAttribute('title', 'Inventory is full');
  await page.evaluate(() => {
    (window as any).__GAME__.world.hero.x += 1000;
  });
  await expect(belt).toBeDisabled();
  await expect(belt).toHaveAttribute('title', 'Return to your fountain to purchase items');
  await page.evaluate(() => {
    (window as any).__GAME__.world.hero.x -= 1000;
  });
  await expect(belt).toBeEnabled();
});
