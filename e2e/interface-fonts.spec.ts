import { expect, test } from '@playwright/test';

test('cold boot waits for source interface fonts before exposing the match', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const request = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route('**/assets/fonts/beaufortforlol-medium.otf', async (route) => {
    requested();
    await held;
    await route.continue();
  });
  await page.goto('/?scene=fixture', { waitUntil: 'domcontentloaded' });
  await request;
  await expect(page.locator('#loading')).not.toHaveClass(/finished/);
  expect(await page.evaluate(() => !!(window as any).__GAME__?.ready)).toBe(false);
  release();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  expect(
    await page.evaluate(() =>
      [
        '500 14px "Beaufort for LOL"',
        '700 24px "Beaufort for LOL"',
        '400 14px "Spiegel"',
        '600 14px "Spiegel"',
        '700 14px "Spiegel"',
      ].every((face) => document.fonts.check(face))
    )
  ).toBe(true);
});

test('failed font download leaves the match playable with fallback text', async ({ page }) => {
  await page.route('**/assets/fonts/*.otf', (route) => route.abort());
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.keyboard.press('p');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('[data-buy="sword"]')).toBeVisible();
});
