import { expect, test } from '@playwright/test';

test('manual checkpoint survives reload exactly, resumes explicitly and restart removes it', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    g.world.step(1801);
  });
  await page.keyboard.press('Escape');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  await expect(page.locator('.welcome')).toHaveCount(0);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
  await page.screenshot({ path: 'artifacts/browser-restored-save.png' });
  await page.getByRole('button', { name: 'Return to the Rift' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.world.snapshot()))
    .not.toBe(saved);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Restart practice' }).click();
  await page.waitForFunction(
    () => (window as any).__GAME__?.ready && (window as any).__GAME__.world.tick < 100
  );
  await page.locator('#loading').waitFor({ state: 'detached' });
  await expect(page.getByRole('heading', { name: 'Game paused' })).toHaveCount(0);
});

test('failed checkpoint write preserves the previous save and the current match', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.keyboard.press('Escape');
  const saved = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.evaluate(() => {
    (window as any).__GAME__.world.player.gold += 100;
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args: any[]) {
      const transaction = Reflect.apply(original, this, args);
      if (args[1] === 'readwrite') queueMicrotask(() => transaction.abort());
      return transaction;
    };
  });
  const current = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toContainText('Saved match could not be updated');
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(current);
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
});

test('an incompatible checkpoint is retained and never loaded into a running match', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.evaluate(async () => {
    const request = indexedDB.open('rift-local-matches', 1);
    const db = await new Promise<IDBDatabase>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    const tx = db.transaction('checkpoints', 'readwrite'),
      store = tx.objectStore('checkpoints');
    const get = store.get('practice-fixture');
    get.onsuccess = () => {
      const bad = JSON.parse(get.result);
      bad.ruleset = 'incompatible';
      store.put(JSON.stringify(bad), 'practice-fixture');
    };
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await expect(page.locator('#toast')).toContainText('different game version');
  expect(await page.evaluate(() => (window as any).__GAME__.world.tick)).toBe(0);
  await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
  const retained = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const open = indexedDB.open('rift-local-matches', 1);
        open.onsuccess = () => {
          const db = open.result,
            request = db
              .transaction('checkpoints')
              .objectStore('checkpoints')
              .get('practice-fixture');
          request.onsuccess = () => {
            resolve(JSON.parse(request.result).ruleset);
            db.close();
          };
        };
      })
  );
  expect(retained).toBe('incompatible');
});
