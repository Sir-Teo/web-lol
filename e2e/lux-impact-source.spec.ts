import { expect, test } from '@playwright/test';

test('Lux impact audit distinguishes disabled layers and loads every source texture', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tools/qa/lux-impact-source.html');
  await page.waitForFunction(() => (window as any).__LUX_IMPACT_SOURCE__?.ready);
  expect(await page.evaluate(() => (window as any).__LUX_IMPACT_SOURCE__)).toEqual({
    ready: true,
    textures: 14,
    active: [3, 5],
  });
  await expect(page.locator('tr[data-disabled="true"]')).toHaveCount(5);
  expect(
    await page
      .locator('figure img')
      .evaluateAll((images) =>
        images.every(
          (image) =>
            (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0
        )
      )
  ).toBe(true);
  await page.screenshot({ path: 'artifacts/lux-impact-source.png', fullPage: true });
  expect(errors).toEqual([]);
});
