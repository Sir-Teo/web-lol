import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import judgmentProfiles from '../../src/content/garen-spin.json' with { type: 'json' };

const otherSlots = [
  'rift',
  'rift:recovery',
  'development-roster-rift',
  'development-roster-rift:recovery',
];
const playtestSlot = 'roster-playtest';

async function checkpoints(page: Page, seed: boolean) {
  return page.evaluate(
    async ({ otherSlots, playtestSlot, seed }) => {
      const request = indexedDB.open('rift-local-matches', 1);
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        return await new Promise<Record<string, string | undefined>>((resolve, reject) => {
          const transaction = db.transaction('checkpoints', seed ? 'readwrite' : 'readonly');
          const store = transaction.objectStore('checkpoints');
          if (seed) for (const key of otherSlots) store.put(`existing ${key}`, key);
          const requests = [...otherSlots, playtestSlot, `${playtestSlot}:recovery`].map(
            (key) => [key, store.get(key)] as const
          );
          transaction.oncomplete = () =>
            resolve(Object.fromEntries(requests.map(([key, read]) => [key, read.result])));
          transaction.onabort = () => reject(transaction.error);
        });
      } finally {
        db.close();
      }
    },
    { otherSlots, playtestSlot, seed }
  );
}

async function loaded(page: Page) {
  await expect(page.locator('#loading')).toHaveCount(0, { timeout: 120_000 });
  await expect(page.locator('.match-identity')).toContainText('5V5 MATCH');
  await expect(page.locator('.match-identity')).toContainText('ROSTER PLAYTEST');
  expect(await page.evaluate(() => '__GAME__' in window)).toBe(false);
}

test('built roster playtest keeps separate saves and restores a real match without network', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  const judgmentPaths = new Set([
    '/assets/models/garen-spin.glb',
    ...judgmentProfiles.flatMap(({ texture, colorLookup }) =>
      (colorLookup.texture ? [texture, colorLookup.texture] : [texture]).map((path) => `/${path}`)
    ),
  ]);
  const loadedJudgment = new Set<string>();
  const baronRequests = new Set<string>();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (judgmentPaths.has(path) && response.ok()) loadedJudgment.add(path);
    if (path.endsWith('/sru-baron-base.glb') && response.ok()) baronRequests.add('rig');
    if (path.includes('/assets/audio/baron-basic/')) baronRequests.add('audio');
  });
  // On a fresh load the development selectors must not activate a fixture.
  await page.goto('/?scene=fixture&encounter=baron&champion=ahri');
  await loaded(page);
  await expect(page.locator('.champion-title strong')).toHaveText('ASHE');
  expect(loadedJudgment).toEqual(judgmentPaths);
  expect([...baronRequests]).toEqual(['rig']);
  await checkpoints(page, true);

  const button = (name: string) => page.getByRole('button', { name, exact: true });
  await button('Pause game').click();
  await button('New match').click();
  await expect(
    page.getByRole('group', { name: 'Choose your champion' }).getByRole('button')
  ).toHaveText(['Ashe', 'Lux', 'Garen', 'Master Yi', 'Leona', 'Ahri']);
  await button('Lux').click();
  await Promise.all([page.waitForEvent('load'), button('Start 5v5 match').click()]);
  await loaded(page);
  await expect(page.locator('.champion-title strong')).toHaveText('LUX');
  await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
  const initial = (await checkpoints(page, false))[playtestSlot];
  expect(initial).toBeDefined();

  await button('Return to the Rift').click();
  await page.keyboard.down('Tab');
  try {
    await expect(page.locator('.scoreboard-row')).toHaveCount(10);
    await expect(page.getByRole('region', { name: 'Baron Nashor' })).toHaveText(
      /^Baron Nashor in (20:00|19:\d\d)$/
    );
    for (const [role, champion, count] of [
      ['top', 'Garen', 2],
      ['jungle', 'Master Yi', 2],
      ['mid', 'Ahri', 1],
      ['mid', 'Lux', 1],
      ['carry', 'Ashe', 2],
      ['support', 'Leona', 2],
    ] as const)
      await expect(
        page.locator(`.scoreboard-row[data-role="${role}"]`).filter({
          has: page.locator(`.scoreboard-portrait img[alt="${champion}"]`),
        })
      ).toHaveCount(count);
  } finally {
    await page.keyboard.up('Tab');
  }
  await expect(page.locator('#clock')).not.toHaveText('00:00', { timeout: 60_000 });
  await button('Pause game').click();
  await expect
    .poll(async () => (await checkpoints(page, false))[`${playtestSlot}:recovery`])
    .toBeDefined();
  await button('Save match').click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const savedClock = await page.locator('#clock').innerText();
  const saved = await checkpoints(page, false);
  expect(saved[playtestSlot]).toBeDefined();
  expect(saved[playtestSlot]).not.toBe(initial);
  expect(saved[`${playtestSlot}:recovery`]).toBeUndefined();
  for (const key of otherSlots) expect(saved[key]).toBe(`existing ${key}`);

  // Give the disposable Chrome context room for the complete source-quality pack.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Storage.overrideQuotaForOrigin', {
    origin: new URL(page.url()).origin,
    quotaSize: 1024 ** 3,
  });
  await button('Offline files').click();
  await button('Download game pack').click();
  // The cancel control is hidden on both success and failure.
  await expect(button('Cancel download')).toBeHidden({ timeout: 180_000 });
  await expect(page.locator('.offline-status')).toHaveText(
    'Ready for offline use on this browser.'
  );
  await context.setOffline(true);
  loadedJudgment.clear();
  const response = await page.reload();
  expect(response?.fromServiceWorker()).toBe(true);
  await loaded(page);
  expect(loadedJudgment).toEqual(judgmentPaths);
  await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
  await expect(page.locator('.champion-title strong')).toHaveText('LUX');
  await expect(page.locator('#clock')).toHaveText(savedClock);
  await button('Match files').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    button('Download current match').click(),
  ]);
  expect(await readFile(await download.path(), 'utf8')).toBe(saved[playtestSlot]);
  expect(await checkpoints(page, false)).toEqual(saved);

  expect(errors).toEqual([]);
});
