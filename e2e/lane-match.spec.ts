import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1366, height: 768 } });

async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function start(page: Page, name: string) {
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name, exact: true }).click(),
  ]);
  await ready(page);
}
async function choose(page: Page) {
  await page.getByRole('button', { name: 'New match', exact: true }).click();
}

test('local lane match starts, saves, restarts in its mode, and can return to practice', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto('/');
  await ready(page);
  await page.keyboard.press('Escape');
  await choose(page);
  await expect(page.getByText('Choose your match', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/lane-match-menu.png' });
  await start(page, 'Start 5v5 match');
  const first = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    return {
      paused: g.hud.paused,
      mode: w.matchMode,
      tick: w.tick,
      champions: w.units.filter((u: any) => u.kind === 'champion').length,
      bots: w.units.filter((u: any) => u.kind === 'champion' && u.ai).length,
      dummy: w.units.some((u: any) => u.kind === 'dummy'),
      saved: w.snapshot(),
    };
  });
  expect(first).toMatchObject({
    paused: true,
    mode: 'lanes',
    tick: 0,
    champions: 10,
    bots: 9,
    dummy: false,
  });
  await expect(page.locator('#practice-button')).toBeHidden();
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(first.saved);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.step(300);
    g.hud.update(60);
    g.hud.scoreboard(true);
    g.view.render(g.world, 1, 5);
  });
  await expect(page.locator('.scoreboard-title')).toHaveText('5V5 MATCH');
  await page.screenshot({ path: 'artifacts/lane-match-scoreboard.png' });
  await page.keyboard.press('Escape');
  await start(page, 'Restart 5v5 match');
  expect(
    await page.evaluate(() => ({
      mode: (window as any).__GAME__.world.matchMode,
      tick: (window as any).__GAME__.world.tick,
    }))
  ).toEqual({ mode: 'lanes', tick: 0 });
  await choose(page);
  await start(page, 'Start practice');
  expect(
    await page.evaluate(() => {
      const w = (window as any).__GAME__.world;
      return {
        mode: w.matchMode,
        champions: w.units.filter((u: any) => u.kind === 'champion').length,
        dummy: w.units.some((u: any) => u.kind === 'dummy'),
      };
    })
  ).toEqual({ mode: 'practice', champions: 2, dummy: true });
  await expect(page.locator('#practice-button')).toBeVisible();
});

test('failed new-match write preserves the current match and previous browser save', async ({
  page,
}) => {
  await page.goto('/');
  await ready(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await choose(page);
  await page.getByRole('button', { name: 'Lux', exact: true }).click();
  const before = await page.evaluate(async () => {
    const { readMatch } = await import('/src/storage/match-store.ts');
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args: any[]) {
      const tx = Reflect.apply(original, this, args);
      if (args[1] === 'readwrite') {
        IDBDatabase.prototype.transaction = original;
        queueMicrotask(() => tx.abort());
      }
      return tx;
    };
    return { world: (window as any).__GAME__.world.snapshot(), stored: await readMatch('rift') };
  });
  await page.getByRole('button', { name: 'Start 5v5 match', exact: true }).click();
  await expect(page.locator('.import-error')).toBeVisible();
  expect(
    await page.evaluate(async () => {
      const { readMatch } = await import('/src/storage/match-store.ts');
      return { world: (window as any).__GAME__.world.snapshot(), stored: await readMatch('rift') };
    })
  ).toEqual(before);
  await expect(page.getByRole('button', { name: 'Return to the Rift', exact: true })).toBeEnabled();
});
