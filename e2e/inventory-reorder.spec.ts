import { expect, test } from '@playwright/test';

test('dragging swaps occupied inventory slots and moves an item into an empty slot', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.player.gold = 2000;
    w.buy('sword');
    w.buy('boots');
  });
  const slots = page.locator('#inventory .item-slot');
  await expect(slots.nth(0).locator('img')).toHaveAttribute('src', /1036\.png/);
  await slots.nth(0).dragTo(slots.nth(1));
  await expect(slots.nth(0).locator('img')).toHaveAttribute('src', /1001\.png/);
  await expect(slots.nth(1).locator('img')).toHaveAttribute('src', /1036\.png/);
  await slots.nth(1).dragTo(slots.nth(5));
  await expect(slots.nth(1).locator('img')).toHaveCount(0);
  await expect(slots.nth(5).locator('img')).toHaveAttribute('src', /1036\.png/);
  const state = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    return {
      inventory: w.player.inventory,
      gold: w.player.gold,
      damage: w.hero.damage,
      speed: w.hero.speed,
    };
  });
  expect(state).toEqual({
    inventory: ['boots', null, null, null, null, 'sword'],
    gold: 1350,
    damage: 69,
    speed: 350,
  });
  await page.keyboard.press('p');
  await expect(page.locator('[data-sell="5"]')).toHaveAccessibleName(
    'Sell Long Sword, slot 6, for 245 gold'
  );
});
