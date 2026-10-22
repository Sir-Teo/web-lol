import { expect, test, type Page } from '@playwright/test';
test.use({ viewport: { width: 1366, height: 768 } });
async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function reloadAction(page: Page, name: string) {
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name, exact: true }).click(),
  ]);
  await ready(page);
}
async function state(page: Page) {
  return page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    return {
      champion: w.hero.champion,
      name: w.hero.name,
      mode: w.matchMode,
      tick: w.tick,
      paused: g.hud.paused,
      champions: w.units.filter((u: any) => u.kind === 'champion').length,
      bots: w.units.filter((u: any) => u.kind === 'champion' && u.ai).length,
      blueMidBots: w.units.filter(
        (u: any) => u.kind === 'champion' && u.ai && u.team === 'blue' && u.lane === 1
      ).length,
    };
  });
}

test('select Lux with keyboard, cast Binding, save and restart both match modes without losing the champion', async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await ready(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  const lux = page.getByRole('button', { name: 'Lux', exact: true });
  await lux.focus();
  await page.keyboard.press('Enter');
  await expect(lux).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Ashe', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  await expect(page.locator('.lane-description')).toContainText('Lux in mid');
  await page.screenshot({ path: 'artifacts/champion-selection-lux.png', animations: 'disabled' });
  await reloadAction(page, 'Start 5v5 match');
  expect(await state(page)).toEqual({
    champion: 'lux',
    name: 'Lux',
    mode: 'lanes',
    tick: 0,
    paused: true,
    champions: 10,
    bots: 9,
    blueMidBots: 0,
  });
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await expect(page.locator('.champion-title strong')).toHaveText('LUX');
  await page.getByRole('button', { name: 'Upgrade Light Binding', exact: true }).click();
  const target = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const target = w.spawn('dummy', 'red', { x: w.hero.x + 450, y: w.hero.y - 100 });
    g.view.render(w, 1, performance.now() / 1000);
    return { id: target.id, point: g.view.screenPoint(target) };
  });
  await page.mouse.move(target.point.x, target.point.y);
  await page.keyboard.press('q');
  await page.waitForFunction((id) => {
    const w = (window as any).__GAME__.world;
    return w.unit(id).rootUntil > w.tick;
  }, target.id);
  await page.screenshot({ path: 'artifacts/champion-selection-lux-binding.png' });
  await page.keyboard.press('Escape');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { readMatch } = await import('/src/storage/match-store.ts');
        return readMatch('rift');
      })
    )
    .toBe(saved);
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  await reloadAction(page, 'Restart 5v5 match');
  expect(await state(page)).toMatchObject({
    champion: 'lux',
    mode: 'lanes',
    tick: 0,
    paused: true,
    champions: 10,
  });
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Lux', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await reloadAction(page, 'Start practice');
  expect(await state(page)).toMatchObject({
    champion: 'lux',
    mode: 'practice',
    tick: 0,
    paused: true,
    champions: 2,
  });
  await reloadAction(page, 'Restart practice');
  expect(await state(page)).toMatchObject({
    champion: 'lux',
    mode: 'practice',
    tick: 0,
    paused: true,
    champions: 2,
  });
  expect(errors).toEqual([]);
});
