import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test.setTimeout(600000);
async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 180000 });
  await page.locator('#loading').waitFor({ state: 'detached' });
}
async function pause(page: Page) {
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.hud.closeModal();
    g.setPaused(true);
  });
}
async function newMatch(page: Page) {
  await pause(page);
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'New match', exact: true }).click();
}
async function reloadAction(page: Page, name: string) {
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name, exact: true }).click(),
  ]);
  await ready(page);
}

const choices = [
  { id: 'garen', name: 'Garen', role: 'top' },
  { id: 'masteryi', name: 'Master Yi', role: 'jungle' },
  { id: 'leona', name: 'Leona', role: 'support' },
  { id: 'ahri', name: 'Ahri', role: 'mid' },
  { id: 'lux', name: 'Lux', role: 'mid' },
  { id: 'ashe', name: 'Ashe', role: 'carry' },
] as const;

test('all six private player choices keep their own manual kit, roles, actual saves and exact restarts', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=roster-rift', { waitUntil: 'domcontentloaded' });
  await ready(page);
  const records: any[] = [];
  let previous = 'ashe';
  for (const choice of choices) {
    await newMatch(page);
    await expect(page.locator('[data-action="choose-champion"]')).toHaveCount(6);
    await expect(page.locator(`[data-champion="${previous}"]`)).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await page.getByRole('button', { name: choice.name, exact: true }).click();
    await expect(page.locator(`[data-champion="${choice.id}"]`)).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.locator('.lane-description')).toContainText(choice.name);
    if (choice.id === 'ashe' || choice.id === 'lux')
      await expect(page.getByRole('button', { name: 'Start practice', exact: true })).toBeEnabled();
    else {
      await expect(
        page.getByRole('button', { name: 'Start practice', exact: true })
      ).toBeDisabled();
      await expect(page.locator('.practice-description')).toContainText('Choose Ashe or Lux');
    }
    await page
      .locator(
        `[data-summoner-slot="d"][data-spell="${choice.id === 'masteryi' ? 'smite' : 'flash'}"]`
      )
      .click();
    await page
      .locator(
        `[data-summoner-slot="f"][data-spell="${choice.id === 'masteryi' ? 'flash' : 'heal'}"]`
      )
      .click();
    if (choice.id === 'garen') {
      const bounds = await page
        .locator('.game-dialog')
        .evaluate((e) => ({ scroll: e.scrollWidth, width: e.clientWidth }));
      expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);
      await page.screenshot({ path: info.outputPath('six-player-chooser.png') });
    }
    await reloadAction(page, 'Start 5v5 match');
    const fresh = await page.evaluate(() => {
      const w = (window as any).__GAME__.world;
      return {
        saved: w.snapshot(),
        hero: w.hero.champion,
        ai: w.hero.ai,
        lane: w.hero.lane,
        role: w.player.role,
        tick: w.tick,
        gold: w.player.gold,
        inventory: [...w.player.inventory],
        skillPoints: w.player.skillPoints,
        ranks: { ...w.player.spellRanks },
        summoners: { ...w.player.summoners },
        companion: w.companions.some((p: any) => p.ownerId === w.hero.id),
        champions: w.units.filter((u: any) => u.kind === 'champion').length,
        bots: w.units.filter((u: any) => u.kind === 'champion' && u.ai).length,
        title: document.querySelector('.champion-title strong')!.textContent,
      };
    });
    expect(fresh).toMatchObject({
      hero: choice.id,
      ai: false,
      lane: null,
      role: choice.role,
      tick: 0,
      gold: 500,
      inventory: [],
      skillPoints: 1,
      ranks: { q: 0, w: 0, e: 0, r: 0 },
      companion: false,
      champions: 10,
      bots: 9,
      summoners: choice.id === 'masteryi' ? { d: 'smite', f: 'flash' } : { d: 'flash', f: 'heal' },
    });
    expect(fresh.title!.replace(/\s/g, '').toLowerCase()).toBe(choice.id);
    await pause(page);
    if (choice.id === 'garen') {
      await expect(page.locator('.resource.mana')).toBeHidden();
      await expect(page.locator('.garen-resource')).toBeVisible();
    } else await expect(page.locator('.resource.mana')).toBeVisible();
    const saved = await page.evaluate(() => {
      const w = (window as any).__GAME__.world;
      w.step(37);
      return w.snapshot();
    });
    await page.locator('#pause-button').click();
    await page.getByRole('button', { name: 'Save match', exact: true }).click();
    await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready(page);
    expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(saved);
    await reloadAction(page, 'Restart 5v5 match');
    expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(fresh.saved);
    records.push({ choice, fresh, saved });
    previous = choice.id;
    writeFileSync(
      info.outputPath('six-player-selection.json'),
      JSON.stringify({ records, errors }, null, 2)
    );
  }
  expect(errors).toEqual([]);
});

test('public and separate trials retain two choices while the combined trial enforces its practice boundary', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await newMatch(page);
  expect(
    await page
      .locator('[data-action="choose-champion"]')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.champion))
  ).toEqual(['ashe', 'lux']);
  await page.getByRole('button', { name: 'Lux', exact: true }).click();
  await reloadAction(page, 'Start practice');
  expect(
    await page.evaluate(() => ({
      champion: (window as any).__GAME__.world.hero.champion,
      mode: (window as any).__GAME__.world.matchMode,
    }))
  ).toEqual({ champion: 'lux', mode: 'practice' });
  await page.goto('/?scene=ahri-rift&bots=ahri', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await newMatch(page);
  expect(
    await page
      .locator('[data-action="choose-champion"]')
      .evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.champion))
  ).toEqual(['ashe', 'lux']);
  await page.goto('/?scene=roster-rift', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await pause(page);
  const denied = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      before = g.world.snapshot();
    let error = '';
    try {
      await g.hud.actions.startMatch('practice', 'garen', g.world.player.summoners);
    } catch (e) {
      error = (e as Error).message;
    }
    return { error, unchanged: before === g.world.snapshot() };
  });
  expect(denied).toEqual({
    error: 'Choose Ashe or Lux for practice in this trial.',
    unchanged: true,
  });
  await page.setViewportSize({ width: 1024, height: 720 });
  await newMatch(page);
  await page.getByRole('button', { name: 'Master Yi', exact: true }).click();
  await page.locator('.lane-description').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('yi-role-preparation-1024.png') });
  await page.getByRole('button', { name: 'Leona', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start practice', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Start 5v5 match', exact: true })).toBeVisible();
  const bounds = await page
    .locator('.game-dialog')
    .evaluate((e) => ({ scroll: e.scrollWidth, width: e.clientWidth }));
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);
  await page.screenshot({ path: info.outputPath('six-player-chooser-1024.png') });
  writeFileSync(
    info.outputPath('selection-boundaries.json'),
    JSON.stringify({ denied, bounds, errors }, null, 2)
  );
  expect(errors).toEqual([]);
});
