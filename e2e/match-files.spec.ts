import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function files(page: Page) {
  await page.getByRole('button', { name: 'Match files', exact: true }).click();
}
async function snapshot(page: Page) {
  return page.evaluate(() => (window as any).__GAME__.world.snapshot());
}
async function stored(page: Page) {
  return page.evaluate(async () => {
    const { readMatch } = await import('/src/storage/match-store.ts');
    return readMatch((window as any).__GAME__.world.battlefield.id);
  });
}
async function upload(page: Page, text: string) {
  await page.getByLabel('Match file', { exact: true }).setInputFiles({
    name: 'match.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
}

test('download transfers an exact paused checkpoint and pending command to another browser context', async ({
  page,
  browser,
}) => {
  await page.goto('/?scene=fixture');
  await ready(page);
  await page.keyboard.press('Escape');
  const expected = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.step(1801);
    w.hero.hp = 100;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'f', point: { x: w.hero.x, y: w.hero.y } });
    const saved = w.snapshot();
    const clone = w.constructor.fromSnapshot(saved, w.battlefield);
    clone.step();
    return { saved, tick: w.tick, continued: clone.snapshot() };
  });
  await files(page);
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download current match' }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe(`rift-practice-fixture-tick-${expected.tick}.json`);
  const text = await readFile((await download.path())!, 'utf8');
  expect(text).toBe(expected.saved);
  expect(await stored(page)).toBeUndefined();
  expect(await snapshot(page)).toBe(expected.saved);
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const target = await context.newPage();
  try {
    await target.goto(new URL('/?scene=fixture', page.url()).href);
    await ready(target);
    await target.keyboard.press('Escape');
    const before = await snapshot(target);
    await files(target);
    const chooserEvent = target.waitForEvent('filechooser');
    await target.getByRole('button', { name: 'Choose match file' }).click();
    const chooser = await chooserEvent;
    await chooser.setFiles({
      name: download.suggestedFilename(),
      mimeType: 'application/json',
      buffer: Buffer.from(text),
    });
    await expect(target.locator('.file-status')).toContainText('0:30 · Match in progress');
    expect(await snapshot(target)).toBe(before);
    expect(await stored(target)).toBeUndefined();
    await target.screenshot({ path: 'artifacts/match-file-preview.png' });
    await Promise.all([
      target.waitForEvent('load'),
      target.getByRole('button', { name: 'Load this match' }).click(),
    ]);
    await ready(target);
    await expect(target.getByRole('heading', { name: 'Game paused' })).toBeVisible();
    expect(await snapshot(target)).toBe(text);
    expect(await stored(target)).toBe(text);
    await target.waitForTimeout(100);
    expect(await snapshot(target)).toBe(text);
    expect(
      await target.evaluate(() => {
        const w = (window as any).__GAME__.world;
        w.step();
        return w.snapshot();
      })
    ).toBe(expected.continued);
  } finally {
    await context.close();
  }
});

test('invalid, incompatible, wrong-map and oversized files preserve current and saved matches', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await ready(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await snapshot(page);
  await page.evaluate(() => {
    (window as any).__GAME__.world.player.gold += 100;
  });
  const current = await snapshot(page);
  await files(page);
  const wrongMap = await page.evaluate(async () => {
    const { loadRiftBattlefield } = await import('/src/content/rift.ts');
    const World = (window as any).__GAME__.world.constructor;
    return new World(true, await loadRiftBattlefield()).snapshot();
  });
  for (const [text, message] of [
    ['{', 'could not be read'],
    [JSON.stringify({ ...JSON.parse(saved), version: -1 }), 'different game version'],
    [wrongMap, 'different battlefield'],
    [' '.repeat(16 * 1024 * 1024 + 1), 'too large'],
  ]) {
    // A rejected replacement must also invalidate a previously valid preview.
    await upload(page, saved);
    await expect(page.getByRole('button', { name: 'Load this match' })).toBeVisible();
    await upload(page, text);
    await expect(page.locator('.file-status')).toContainText(message);
    await expect(page.getByRole('button', { name: 'Load this match' })).toBeHidden();
    expect(await snapshot(page)).toBe(current);
    expect(await stored(page)).toBe(saved);
  }
  await page.screenshot({ path: 'artifacts/match-file-rejected.png' });
});

test('failed import transaction keeps the running match and previous save and permits retry', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await ready(page);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const saved = await snapshot(page);
  await page.evaluate(() => {
    (window as any).__GAME__.world.player.gold += 250;
  });
  const current = await snapshot(page);
  await files(page);
  await upload(page, saved);
  await expect(page.getByRole('button', { name: 'Load this match' })).toBeVisible();
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args: any[]) {
      const transaction = Reflect.apply(original, this, args);
      if (args[1] === 'readwrite') {
        IDBDatabase.prototype.transaction = original;
        queueMicrotask(() => transaction.abort());
      }
      return transaction;
    };
  });
  await page.getByRole('button', { name: 'Load this match' }).click();
  await expect(page.locator('.file-status')).toContainText('Saved match could not be updated');
  expect(await snapshot(page)).toBe(current);
  expect(await stored(page)).toBe(saved);
  await expect(page.getByRole('button', { name: 'Load this match' })).toBeEnabled();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Load this match' }).click(),
  ]);
  await ready(page);
  expect(await snapshot(page)).toBe(saved);
});

test('a graphics loss still permits an exact match-file download', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await ready(page);
  await page.evaluate(() => (window as any).__GAME__.view.renderer.forceContextLoss());
  await expect(page.getByRole('heading', { name: 'Restoring the battlefield' })).toBeVisible();
  const frozen = await snapshot(page);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download current match' }).click();
  const download = await pending;
  expect(await readFile((await download.path())!, 'utf8')).toBe(frozen);
  expect(await stored(page)).toBeUndefined();
  await page.keyboard.press('Escape');
  expect(await snapshot(page)).toBe(frozen);
  await expect(page.getByRole('heading', { name: 'Restoring the battlefield' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/match-file-graphics-loss.png' });
});
