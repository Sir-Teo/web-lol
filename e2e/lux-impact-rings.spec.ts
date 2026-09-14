import { expect, test } from '@playwright/test';
test('Lux ring composition seeks, plays and retires normal and critical layers', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tools/qa/lux-impact-rings.html');
  await page.waitForFunction(() => (window as any).__LUX_IMPACT_RINGS__?.ready);
  await expect(page.locator('#status')).toContainText('normal 2 layers · critical 4 layers');
  await page.screenshot({ path: 'artifacts/lux-impact-rings.png', fullPage: true });
  const initial = await page.evaluate(() => (window as any).__LUX_IMPACT_RINGS__.state());
  expect(initial.sparks[0]).toHaveLength(5);
  expect(initial.sparks[1]).toEqual(initial.sparks[0]);
  await page.locator('#seed').fill('73');
  expect(
    (await page.evaluate(() => (window as any).__LUX_IMPACT_RINGS__.state())).sparks[0]
  ).not.toEqual(initial.sparks[0]);
  await page.locator('#seed').fill('42');
  await page.locator('#age').fill('0.11');
  await expect(page.locator('#status')).toContainText('normal 2 layers · critical 3 layers');
  await page.locator('#age').fill('0.26');
  await expect(page.locator('#status')).toContainText('normal 1 layers · critical 2 layers');
  await page.locator('#age').fill('0.31');
  await expect(page.locator('#status')).toContainText('normal 0 layers · critical 1 layers');
  await page.locator('#age').fill('0.5');
  await expect(page.locator('#status')).toContainText('normal 0 layers · critical 0 layers');
  expect((await page.evaluate(() => (window as any).__LUX_IMPACT_RINGS__.state())).sparks).toEqual([
    [],
    [],
  ]);
  await page.locator('#age').fill('0.045');
  expect(await page.evaluate(() => (window as any).__LUX_IMPACT_RINGS__.state())).toEqual(initial);
  await page.getByRole('button', { name: 'Play at 0.25×' }).click();
  await expect.poll(() => page.locator('#age').inputValue()).not.toBe('0.045');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.locator('#chance').fill('0.8');
  expect(errors).toEqual([]);
});
