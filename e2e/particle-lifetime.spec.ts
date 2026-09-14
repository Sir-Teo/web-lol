import { expect, test } from '@playwright/test';

test('hoop lifetime preview seeks reproducibly and plays its source appearance', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/tools/qa/particle-color-preview.html');
  await page.waitForFunction(() => (window as any).__PARTICLE_COLOR__?.ready);
  await page.getByLabel('Emitter').selectOption('hoop');
  await expect(page.locator('#x')).toBeDisabled();
  const appearance = () => page.evaluate(() => (window as any).__PARTICLE_COLOR__.appearance());
  await page.getByLabel('Normalized age').fill('0.5');
  const middle = await appearance();
  expect(middle).toEqual({
    playing: false,
    age: 0.5,
    lookup: [0.5, 0.5],
    color: [1, 1, 1, 0.6500037908554077],
    scale: 0.75,
  });
  await page.getByLabel('Normalized age').fill('1');
  expect((await appearance()).scale).toBe(0.5);
  await page.getByLabel('Normalized age').fill('0');
  expect((await appearance()).lookup).toEqual([0, 0.5]);
  await page.getByLabel('Normalized age').fill('0.5');
  expect(await appearance()).toEqual(middle);
  await page.getByRole('button', { name: 'Play at 0.1×' }).click();
  await expect.poll(async () => (await appearance()).age).toBeGreaterThan(0.55);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  expect((await appearance()).playing).toBe(false);
  await page.getByLabel('Normalized age').fill('0.5');
  await page.screenshot({ path: 'artifacts/particle-hoop-lifetime.png', fullPage: true });
  await page.getByLabel('Use source lookup, color and relative scale').uncheck();
  await expect(page.locator('#x')).toBeEnabled();
  await page.locator('#x').fill('0.2');
  expect((await appearance()).lookup).toEqual([0.2, 0.5]);
  expect((await appearance()).color).toEqual([1, 1, 1, 1]);
  await page.getByLabel('Emitter').selectOption('trail');
  await expect(page.getByLabel('Normalized age')).toBeDisabled();
  expect((await appearance()).scale).toBe(1);
  expect(errors).toEqual([]);
});
