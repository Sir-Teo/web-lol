import { expect, test } from '@playwright/test';

test('ability tooltips describe current mechanics and support keyboard focus', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const q = page.getByRole('button', { name: 'Ranger’s Focus', exact: true });
  await q.focus();
  const tip = page.getByRole('tooltip');
  await expect(q).toHaveAttribute('aria-describedby', 'ability-tooltip');
  await expect(tip).toContainText('20% attack speed');
  await expect(tip).toContainText('110% damage');
  await expect(tip).toContainText('resets your attack timer');
  await expect(tip).toContainText('NO COOLDOWN');
  await page.getByRole('button', { name: 'Heal', exact: true }).focus();
  await expect(q).not.toHaveAttribute('aria-describedby');
  await expect(tip).toContainText('one nearby allied champion');
  await expect(tip).toContainText('reduced by 50%');
  await expect(tip).toContainText('NO COST');
  await page.evaluate(() => (window as any).__GAME__.hud.update(60));
  await page.screenshot({ path: 'artifacts/heal-tooltip.png' });
  await page.getByRole('button', { name: 'Pause game' }).focus();
  await expect(tip).toBeHidden();
  expect(errors).toEqual([]);
});
