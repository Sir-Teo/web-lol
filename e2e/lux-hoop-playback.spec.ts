import { expect, test } from '@playwright/test';

test('hoop cloud renders moving instances, preserves seeded seeks and retires after emission stops', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/tools/qa/lux-hoop-playback.html');
  await page.waitForFunction(() => (window as any).__HOOP__?.ready);
  const state = () => page.evaluate(() => (window as any).__HOOP__.state());
  const initial = await state();
  expect(initial.particles.length).toBeGreaterThan(10);
  expect(initial.instances).toBe(initial.particles.length);
  expect(initial.calls).toBe(2);
  await page.getByLabel('Effect time').fill('0.6');
  const tail = await state();
  expect(tail.particles.every((p: any) => p.birthTick <= 30)).toBe(true);
  expect(tail.particles).not.toEqual(initial.particles);
  await page.getByLabel('Effect time').fill('1.2');
  expect((await state()).instances).toBe(0);
  expect((await state()).calls).toBe(1);
  await page.getByLabel('Effect time').fill('0.3');
  expect((await state()).particles).toEqual(initial.particles);
  await page.getByLabel('Seed').fill('43');
  expect((await state()).particles).not.toEqual(initial.particles);
  await page.getByLabel('Seed').fill('42');
  expect((await state()).particles).toEqual(initial.particles);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(async () => (await state()).seconds).toBeGreaterThan(0.35);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  expect((await state()).playing).toBe(false);
  await page.getByLabel('Effect time').fill('0.3');
  expect((await state()).geometries).toBe(initial.geometries);
  await page.screenshot({ path: 'artifacts/lux-hoop-cloud.png', fullPage: true });
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  expect((await state()).instances).toBe(0);
  expect(errors).toEqual([]);
});
