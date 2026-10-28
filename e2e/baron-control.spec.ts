import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}

test('real Lux input damages Baron without a root and survives save/reload', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture&encounter=baron');
  await ready(page);
  const lux = await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const { createBaronEncounter } = await import('/src/simulation/baron-encounter.ts');
    return createBaronEncounter(g.world.battlefield, 'lux').snapshot();
  });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Match files', exact: true }).click();
  await page.getByLabel('Match file', { exact: true }).setInputFiles({
    name: 'baron-lux.json',
    mimeType: 'application/json',
    buffer: Buffer.from(lux),
  });
  await expect(page.getByRole('button', { name: 'Load this match', exact: true })).toBeVisible();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Load this match', exact: true }).click(),
  ]);
  await ready(page);
  await expect(page.locator('.champion-title strong')).toHaveText('LUX');
  const before = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      b = w.units.find((u: any) => u.monster?.species === 'baron'),
      hp = b.hp,
      step = w.step;
    w.step = function (this: any, ...args: any[]) {
      const result = step.apply(this, args);
      if (b.hp < hp) {
        this.step = step;
        g.setPaused(true);
      }
      return result;
    };
    return { id: b.id, hp, rank: w.player.spellRanks.q, point: g.view.screenPoint(b, 0.65) };
  });
  expect(before.rank).toBe(1);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.mouse.move(before.point.x, before.point.y);
  await page.keyboard.press('q');
  await expect
    .poll(() => page.evaluate((id) => (window as any).__GAME__.world.unit(id).hp, before.id), {
      timeout: 20000,
    })
    .toBeLessThan(before.hp);
  const hit = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      b = g.world.unit(id);
    return { hp: b.hp, rootUntil: b.rootUntil, paused: g.hud.paused, tick: g.world.tick };
  }, before.id);
  expect(hit.rootUntil).toBe(0);
  expect(hit.paused).toBe(true);
  await page.screenshot({ path: info.outputPath('baron-lux-q-resisted.png') });
  await page.keyboard.press('Escape');
  const expected = await page.evaluate(() => {
    const w = (window as any).__GAME__.world,
      snapshot = w.snapshot(),
      copy = w.constructor.fromSnapshot(snapshot, w.battlefield);
    copy.step(180);
    return { snapshot, future: copy.snapshot() };
  });
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(
    expected.snapshot
  );
  const future = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    w.step(180);
    return w.snapshot();
  });
  expect(future).toBe(expected.future);
  expect(errors).toEqual([]);
  await writeFile(
    info.outputPath('baron-root-resisted.json'),
    JSON.stringify({ before, hit, expected, future, errors }, null, 2)
  );
});
