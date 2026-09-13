import { expect, test, type Page } from '@playwright/test';

async function boot(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await expect(page.locator('#loading')).toHaveCount(0);
}
const state = (page: Page) => page.evaluate(() => (window as any).__GAME__.snapshot());

test('boots with local assets, animated hero, and no runtime errors', async ({ page }) => {
  const errors: string[] = [],
    failed: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  await boot(page);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  await expect(page.getByRole('button', { name: 'Volley', exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => Object.keys((window as any).__GAME__.view.models.get(1).actions))
  ).toContain('run');
  await page.screenshot({ path: 'artifacts/browser-ready.png' });
});

test('right-click moves, stop halts, and attack targets receive damage', async ({ page }) => {
  await boot(page);
  const before = await state(page);
  const click = await page.evaluate(() =>
    (window as any).__GAME__.view.screenPoint({ x: -850, y: 640 })
  );
  await page.mouse.click(click.x, click.y, { button: 'right' });
  await expect
    .poll(async () => (await state(page)).units[0].x)
    .toBeGreaterThan(before.units[0].x + 100);
  await page.keyboard.press('s');
  await page.waitForTimeout(100);
  const stopped = (await state(page)).units[0];
  await page.waitForTimeout(300);
  expect((await state(page)).units[0].x).toBe(stopped.x);
  const dummy = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return g.view.screenPoint(
      g.world.units.find((u: any) => u.kind === 'dummy'),
      0.65
    );
  });
  await page.mouse.click(dummy.x, dummy.y, { button: 'right' });
  await expect
    .poll(async () => (await state(page)).units.find((u: any) => u.kind === 'dummy').hp, {
      timeout: 8000,
    })
    .toBeLessThan(1500);
});

test('holding a skill aims, release casts, and cooldown prevents repeat', async ({ page }) => {
  await boot(page);
  const dummy = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return g.view.screenPoint(g.world.units.find((u: any) => u.kind === 'dummy'));
  });
  await page.mouse.move(dummy.x, dummy.y);
  await page.keyboard.down('w');
  await expect(page.locator('#battlefield')).toHaveClass(/aiming/);
  await page.screenshot({ path: 'artifacts/browser-volley-aim.png' });
  await page.keyboard.up('w');
  await expect(page.locator('[data-ability="w"]')).toHaveClass(/cooling/);
  await expect
    .poll(async () => (await state(page)).units.find((u: any) => u.kind === 'dummy').hp)
    .toBeLessThan(1500);
  const cd = (await state(page)).player.cooldowns.w;
  await page.keyboard.press('w');
  expect((await state(page)).player.cooldowns.w).toBe(cd);
});

test('pause freezes simulation and clears a held cast', async ({ page }) => {
  await boot(page);
  await page.keyboard.down('r');
  await page.keyboard.press('Escape');
  await expect(page.locator('#battlefield')).not.toHaveClass(/aiming/);
  await page.keyboard.up('r');
  expect((await state(page)).player.cooldowns.r).toBe(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  const tick = (await state(page)).tick;
  await page.waitForTimeout(350);
  expect((await state(page)).tick).toBe(tick);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await expect.poll(async () => (await state(page)).tick).toBeGreaterThan(tick);
});

test('shop purchases change stats and inventory, then reject overspending', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('p');
  await page.locator('[data-buy="blade"]').click();
  await expect(page.locator('.shop-message')).toHaveText('Item purchased');
  expect((await state(page)).player.inventory).toEqual(['blade']);
  expect((await state(page)).units[0].damage).toBe(69);
  await page.locator('[data-buy="pickaxe"]').click();
  await expect(page.locator('.shop-message')).toHaveText('Not enough gold');
  await page.screenshot({ path: 'artifacts/browser-shop.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('#inventory img')).toHaveCount(1);
});

test('HUD fits a laptop viewport and minimap changes camera', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page);
  const hud = await page.locator('.champion-hud').boundingBox(),
    map = await page.locator('.minimap-shell').boundingBox();
  expect(hud!.x + hud!.width).toBeLessThan(map!.x);
  expect(hud!.y).toBeGreaterThan(768 * 0.75);
  const original = await page.evaluate(() => (window as any).__GAME__.view.center.x);
  await page.locator('#minimap').click({ position: { x: 130, y: 65 } });
  expect(await page.evaluate(() => (window as any).__GAME__.view.center.x)).not.toBe(original);
  await page.keyboard.press('Space');
  const { heroX, cameraX } = await page.evaluate(() => ({
    heroX: (window as any).__GAME__.world.hero.x,
    cameraX: (window as any).__GAME__.view.center.x,
  }));
  expect(cameraX).toBeCloseTo(heroX);
  await page.screenshot({ path: 'artifacts/browser-laptop.png' });
});

test('holding aim reuses GPU geometry and Escape cancels without spending mana', async ({
  page,
}) => {
  await boot(page);
  await page.mouse.move(900, 380);
  await page.keyboard.down('w');
  await page.waitForTimeout(150);
  const geometries = await page.evaluate(
    () => (window as any).__GAME__.view.renderer.info.memory.geometries
  );
  await page.mouse.move(1000, 440, { steps: 15 });
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(() => (window as any).__GAME__.view.renderer.info.memory.geometries)
  ).toBe(geometries);
  await page.keyboard.press('Escape');
  await page.keyboard.up('w');
  expect((await state(page)).player.cooldowns.w).toBe(0);
});

test('dialog keeps keyboard focus inside its controls', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Return to the Rift', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Controls & keybindings', exact: true })
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Restart practice', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Return to the Rift', exact: true })).toBeFocused();
});
