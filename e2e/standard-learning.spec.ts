import { expect, test } from '@playwright/test';

test('full Rift requires first learning and then casts the learned Hawkshot', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const before = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    return { ranks: w.player.spellRanks, points: w.player.skillPoints, charges: w.player.eCharges };
  });
  expect(before).toEqual({ ranks: { q: 0, w: 0, e: 0, r: 0 }, points: 1, charges: 0 });
  await expect(page.getByRole('button', { name: 'Upgrade Enchanted Crystal Arrow' })).toBeHidden();
  await expect(page.locator('.spell-learn:visible')).toHaveCount(3);
  await page.getByRole('button', { name: /^Hawkshot/ }).focus();
  await expect(page.getByRole('tooltip')).toContainText('not been learned');
  await page.getByRole('button', { name: 'Upgrade Hawkshot', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.player.spellRanks.e))
    .toBe(1);
  await expect(page.locator('.spell-learn:visible')).toHaveCount(0);
  await page.mouse.move(1000, 440);
  await page.keyboard.press('e');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.player.eCharges))
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__GAME__.world.projectiles.some((p: any) => p.type === 'hawkshot')
      )
    )
    .toBe(true);
  await page.screenshot({ path: 'artifacts/standard-learning.png' });
  expect(errors).toEqual([]);
});

test('unlearned spell previews show real mechanics and explain changing learning availability', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const tip = page.getByRole('tooltip');
  await page.getByRole('button', { name: 'Enchanted Crystal Arrow', exact: true }).focus();
  await expect(tip).toContainText('Rank 1 preview');
  await expect(tip).toContainText('200 magic damage');
  await expect(tip).toContainText('100 MANA');
  await expect(tip).toContainText('Requires champion level 6');
  await page.getByRole('button', { name: 'Volley', exact: true }).focus();
  await expect(tip).toContainText('7 frost arrows');
  await expect(tip).toContainText('60 physical damage');
  await expect(tip).toContainText('75 MANA');
  await expect(tip).toContainText('18s COOLDOWN');
  await expect(tip).toContainText('Press Ctrl+W to learn');
  await page.screenshot({ path: 'artifacts/unlearned-volley-tooltip.png' });
  await page.keyboard.press('Control+e');
  await expect(tip).toContainText('No skill points available');
  await expect(tip).toContainText('75 MANA');
  await expect(tip).toContainText('Rank 1 preview');
  expect(errors).toEqual([]);
});
