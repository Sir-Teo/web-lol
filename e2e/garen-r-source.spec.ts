import { expect, test } from '@playwright/test';

test('Demacian Justice source inspection loads all meshes and texture roles without runtime dispatch', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/tools/qa/garen-r-source-preview.html');
  await page.waitForFunction(() => (window as any).__GAREN_R_SOURCE__?.ready);
  await expect(page.locator('#textures img')).toHaveCount(21);
  expect(
    await page
      .locator('#textures img')
      .evaluateAll((images) => images.every((i) => (i as HTMLImageElement).naturalWidth > 0))
  ).toBe(true);
  for (const [name, suffix, triangles] of [
    ['Sword', 'sword-plane', 2],
    ['Ground burst', 'praxis', 320],
    ['Half dome', 'halfdome', 380],
    ['Sphere', 'sphere', 2156],
  ] as const) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    const state = await page.evaluate(() => (window as any).__GAREN_R_SOURCE__);
    expect(state.selected).toBe(suffix);
    expect(state.triangles).toBe(triangles);
    expect(state.bounds.every(Number.isFinite)).toBe(true);
    expect(Math.max(...state.bounds)).toBeGreaterThan(0.5);
  }
  await page.getByLabel('Wireframe').check();
  expect(await page.evaluate(() => (window as any).__GAREN_R_SOURCE__.wireframe)).toBe(true);
  await page.getByLabel('Wireframe').uncheck();
  await page.getByRole('button', { name: 'Sword', exact: true }).click();
  await page.screenshot({ path: 'artifacts/garen-r-source-preview.png', fullPage: true });
  expect(errors).toEqual([]);
});
