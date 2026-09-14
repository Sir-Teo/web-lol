import { expect, test } from '@playwright/test';

test('ribbon motion preview preserves geometry on seek, plays, and retires without allocations', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tools/qa/lux-trail-playback.html');
  await page.waitForFunction(() => (window as any).__TRAIL__?.ready);
  const state = () => page.evaluate(() => (window as any).__TRAIL__.state());
  const initial = await state();
  expect(initial.vertices.length).toBeGreaterThan(30);
  expect(initial.calls).toBe(2);
  await page.screenshot({ path: 'artifacts/lux-trail-preview.png' });
  await page.getByLabel('Show mesh').check();
  await page.screenshot({ path: 'artifacts/lux-trail-wireframe.png' });
  await page.getByLabel('Show mesh').uncheck();
  await page.getByLabel('Effect time').fill('0.9');
  expect((await state()).points.every((p: any) => p.birthTick <= 42)).toBe(true);
  await page.getByLabel('Effect time').fill('1.3');
  expect((await state()).vertices).toEqual([]);
  expect((await state()).calls).toBe(1);
  await page.getByLabel('Effect time').fill('0.3');
  expect((await state()).vertices).toEqual(initial.vertices);
  expect((await state()).geometries).toBe(initial.geometries);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(async () => (await state()).seconds).toBeGreaterThan(0.35);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  expect((await state()).vertices).toEqual([]);
  expect(errors).toEqual([]);
});
