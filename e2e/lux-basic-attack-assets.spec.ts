import { expect, test } from '@playwright/test';
test('Lux basic-attack source mesh and all six textures load in the inspection view', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tools/qa/lux-basic-attack-preview.html');
  await page.waitForFunction(() => (window as any).__ASSET__?.ready);
  expect(await page.evaluate(() => (window as any).__ASSET__)).toEqual({
    ready: true,
    triangles: 120,
    vertices: 360,
    colors: 360,
  });
  await expect(page.locator('#textures img')).toHaveCount(6);
  await page.screenshot({ path: 'artifacts/lux-basic-attack-assets.png' });
  expect(errors).toEqual([]);
});
