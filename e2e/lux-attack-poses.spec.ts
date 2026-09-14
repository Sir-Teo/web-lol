import { expect, test } from '@playwright/test';

test('Lux pose inspector seeks both source clips and exposes current release timing', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tools/qa/lux-attack-poses.html');
  await page.waitForFunction(() => (window as any).__LUX_POSES__?.ready);
  const state = () => page.evaluate(() => (window as any).__LUX_POSES__.state());
  const release = await state();
  expect(release.clips).toEqual(['attack1', 'attack2']);
  expect(release.phase).toBe(14 / 90);
  expect(Math.max(...release.errors)).toBeLessThanOrEqual(0.00001);
  for (const phase of [0, 0.5, 1, 0.25]) {
    await page.locator('#phase').fill(String(phase));
    const result = await state();
    expect(result.phase).toBe(phase);
    expect(Math.max(...result.errors)).toBeLessThanOrEqual(0.00001);
  }
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(() => (window as any).__LUX_POSES__.state().phase > 0.3);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  expect((await state()).playing).toBe(false);
  await page.locator('#paths').uncheck();
  expect((await state()).paths).toBe(false);
  await page.locator('#paths').check();
  await page.getByRole('button', { name: 'Current release' }).click();
  expect((await state()).phase).toBe(release.phase);
  await page.screenshot({ path: 'artifacts/lux-attack-poses.png' });
  expect(errors).toEqual([]);
});
