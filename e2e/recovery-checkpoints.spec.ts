import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function slots(page: Page) {
  return page.evaluate(async () => {
    const { readMatch, recoveryMatchKey } = await import('/src/storage/match-store.ts');
    const key = (window as any).__GAME__.world.battlefield.id;
    return { manual: await readMatch(key), recovery: await readMatch(recoveryMatchKey(key)) };
  });
}
async function save(page: Page) {
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
}

test('startup exposes a recovery-only checkpoint while keeping its bytes paused for review', async ({
  page,
}, info) => {
  await page.goto('/?scene=fixture');
  await ready(page);
  await page.keyboard.press('Escape');
  // Let the first interruption write settle before taking the later checkpoint.
  await expect.poll(async () => (await slots(page)).recovery).toBeTruthy();
  const expected = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(60);
    w.enqueue({ type: 'move', unit: w.hero.id, point: { x: w.hero.x + 100, y: w.hero.y } });
    g.setPaused(true);
    return w.snapshot();
  });
  await expect.poll(async () => (await slots(page)).recovery).toBe(expected);
  expect((await slots(page)).manual).toBeUndefined();
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.hud.paused)).toBe(true);
  await expect(page.locator('#toast')).toContainText('recovery checkpoint is available');
  expect(await slots(page)).toEqual({ manual: undefined, recovery: expected });
  await page.getByRole('button', { name: 'Match files', exact: true }).click();
  await page.getByRole('button', { name: 'Preview recovery checkpoint', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Load this match', exact: true })).toBeVisible();
  expect(await slots(page)).toEqual({ manual: undefined, recovery: expected });
  await writeFile(
    info.outputPath('recovery-only-startup.json'),
    JSON.stringify({ expected, slots: await slots(page) }, null, 2)
  );
});

test('periodic recovery preserves the manual save and previews an exact resumable checkpoint', async ({
  page,
}, info) => {
  await page.goto('/?scene=fixture');
  await ready(page);
  await page.keyboard.press('Escape');
  await save(page);
  const manual = (await slots(page)).manual;
  expect(manual).toBeTruthy();
  expect((await slots(page)).recovery).toBeUndefined();
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.world.step(1800);
    const render = g.view.render;
    // Freeze after the first active frame has already checked the periodic backup.
    g.view.render = function (...args: any[]) {
      const result = render.apply(this, args);
      this.render = render;
      g.setPaused(true);
      return result;
    };
    g.hud.closeModal();
  });
  await expect.poll(async () => (await slots(page)).recovery).toBeTruthy();
  await expect.poll(() => page.evaluate(() => (window as any).__GAME__.hud.paused)).toBe(true);
  const expected = await page.evaluate(() => {
    const w = (window as any).__GAME__.world,
      snapshot = w.snapshot();
    w.step(180);
    return { snapshot, future: w.snapshot() };
  });
  expect(await slots(page)).toEqual({ manual, recovery: expected.snapshot });
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(manual);
  await page.getByRole('button', { name: 'Match files', exact: true }).click();
  await page.getByRole('button', { name: 'Preview recovery checkpoint', exact: true }).click();
  await expect(page.locator('.file-status')).toContainText('Recovery checkpoint · Practice · 0:30');
  expect(await slots(page)).toEqual({ manual, recovery: expected.snapshot });
  await page.screenshot({ path: info.outputPath('recovery-preview.png') });
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Load this match', exact: true }).click(),
  ]);
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(
    expected.snapshot
  );
  expect(await slots(page)).toEqual({ manual: expected.snapshot, recovery: undefined });
  const future = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.step(180);
    return w.snapshot();
  });
  expect(future).toBe(expected.future);
  await writeFile(
    info.outputPath('recovery-continuity.json'),
    JSON.stringify({ manual, expected, future }, null, 2)
  );
});

test('missing and corrupt recovery previews preserve the match and manual save', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await ready(page);
  await page.keyboard.press('Escape');
  await save(page);
  const before = await slots(page),
    snapshot = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.getByRole('button', { name: 'Match files', exact: true }).click();
  await page.getByRole('button', { name: 'Preview recovery checkpoint', exact: true }).click();
  await expect(page.locator('.file-status')).toHaveText(
    'No recovery checkpoint is available on this browser yet.'
  );
  await page.evaluate(async () => {
    const { writeMatch, recoveryMatchKey } = await import('/src/storage/match-store.ts');
    await writeMatch(recoveryMatchKey((window as any).__GAME__.world.battlefield.id), '{broken');
  });
  await page.getByRole('button', { name: 'Preview recovery checkpoint', exact: true }).click();
  await expect(page.locator('.file-status')).not.toHaveText('Checking recovery checkpoint…');
  await expect(page.getByRole('button', { name: 'Load this match', exact: true })).toBeHidden();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(snapshot);
  expect(await slots(page)).toEqual({ manual: before.manual, recovery: '{broken' });
});

test('failed backup storage leaves manual saving usable and replacement aborts atomically', async ({
  page,
}, info) => {
  await page.goto('/?scene=fixture');
  await ready(page);
  await page.keyboard.press('Escape');
  await save(page);
  const before = (await slots(page)).manual;
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      original = indexedDB.open;
    indexedDB.open = function () {
      indexedDB.open = original;
      throw new DOMException('Injected unavailable storage', 'QuotaExceededError');
    };
    g.world.step(1);
    g.setPaused(true);
  });
  await expect(page.locator('#toast')).toHaveText(
    'Recovery checkpoint could not be saved. Your manual save is unchanged.'
  );
  expect(await slots(page)).toEqual({ manual: before, recovery: undefined });
  await save(page);
  const saved = await slots(page);
  expect(saved.manual).not.toBe(before);
  const atomic = await page.evaluate(async () => {
    const { readMatch, writeMatch, replaceMatch, recoveryMatchKey } =
      await import('/src/storage/match-store.ts');
    const key = (window as any).__GAME__.world.battlefield.id,
      backupKey = recoveryMatchKey(key);
    await writeMatch(backupKey, 'retained-backup');
    const original = IDBObjectStore.prototype.delete;
    let error = '';
    IDBObjectStore.prototype.delete = function (key) {
      if (key === backupKey) throw new DOMException('Injected deletion failure', 'UnknownError');
      return original.call(this, key);
    };
    try {
      await replaceMatch(key, 'must-not-commit');
    } catch (e) {
      error = (e as Error).message;
    } finally {
      IDBObjectStore.prototype.delete = original;
    }
    return { error, manual: await readMatch(key), recovery: await readMatch(backupKey) };
  });
  expect(atomic.error).toContain('Saved match could not be updated');
  expect(atomic.manual).toBe(saved.manual);
  expect(atomic.recovery).toBe('retained-backup');
  await writeFile(
    info.outputPath('recovery-storage-faults.json'),
    JSON.stringify({ before, saved, atomic }, null, 2)
  );
});
