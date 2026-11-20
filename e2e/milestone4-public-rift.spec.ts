import { expect, test, type Page } from '@playwright/test';

test.setTimeout(360_000);

async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 120_000 });
  await page.locator('#loading').waitFor({ state: 'detached' });
}

async function openNewMatch(page: Page) {
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.hud.closeModal();
    g.setPaused(true);
  });
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'New match', exact: true }).click();
}

async function reloadWithButton(page: Page, label: string) {
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: label, exact: true }).click(),
  ]);
  await ready(page);
}

test('public Summoner’s Rift loads rigs on demand, runs all six practice kits, and persists bot difficulty and live Baron in 5v5', async ({
  page,
}) => {
  const errors: string[] = [];
  const requestedModels = new Set<string>();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.includes('/assets/models/')) requestedModels.add(path.split('/').at(-1)!);
  });

  // Note: in dev mode, Garen/Lux base rigs stay warmed for dev probes; Baron, Leona, Ahri and Yi stay unloaded in Ashe practice.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await ready(page);
  expect(requestedModels.has('sru-baron-base.glb')).toBe(false);
  expect(requestedModels.has('leona-base.glb')).toBe(false);
  expect(requestedModels.has('ahri-base.glb')).toBe(false);
  expect(requestedModels.has('masteryi-base.glb')).toBe(false);

  // Exercise Garen practice + Practice Tools cooldown reset + Intro bot difficulty restart.
  await openNewMatch(page);
  await page.getByRole('button', { name: 'Garen', exact: true }).click();
  await page
    .getByRole('group', { name: 'Choose bot skill' })
    .getByRole('button', { name: 'Intro', exact: true })
    .click();
  await reloadWithButton(page, 'Start practice');
  expect(
    await page.evaluate(() => {
      const w = (window as any).__GAME__.world;
      w.player.garenPassiveReadyTick = w.tick + 300;
      return {
        champion: w.hero.champion,
        mode: w.matchMode,
        botDifficulty: w.botDifficulty,
        riftBaron: w.riftBaron,
        passiveBefore: w.player.garenPassiveReadyTick,
      };
    })
  ).toEqual({
    champion: 'garen',
    mode: 'practice',
    botDifficulty: 'intro',
    riftBaron: null,
    passiveBefore: 300,
  });
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.locator('#practice-button').click();
  await page.getByRole('button', { name: 'Reset cooldowns', exact: true }).click();
  expect(
    await page.evaluate(() => (window as any).__GAME__.world.player.garenPassiveReadyTick)
  ).toBe(0);
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.locator('#pause-button').click();
  await reloadWithButton(page, 'Restart practice');
  expect(
    await page.evaluate(() => ({
      champion: (window as any).__GAME__.world.hero.champion,
      mode: (window as any).__GAME__.world.matchMode,
      botDifficulty: (window as any).__GAME__.world.botDifficulty,
    }))
  ).toEqual({ champion: 'garen', mode: 'practice', botDifficulty: 'intro' });

  // Verify the remaining newly graduated practice kits (Master Yi, Leona, Ahri).
  for (const [id, name] of [
    ['masteryi', 'Master Yi'],
    ['leona', 'Leona'],
    ['ahri', 'Ahri'],
  ] as const) {
    await openNewMatch(page);
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start practice', exact: true })).toBeEnabled();
    await reloadWithButton(page, 'Start practice');
    expect(
      await page.evaluate(() => ({
        champion: (window as any).__GAME__.world.hero.champion,
        mode: (window as any).__GAME__.world.matchMode,
        riftBaron: (window as any).__GAME__.world.riftBaron,
      }))
    ).toEqual({ champion: id, mode: 'practice', riftBaron: null });
  }
  expect(requestedModels.has('sru-baron-base.glb')).toBe(false);

  // Start a public 5v5 match with Intro bot skill and verify all 6 champions + live Baron.
  await openNewMatch(page);
  await page.getByRole('button', { name: 'Lux', exact: true }).click();
  await page
    .getByRole('group', { name: 'Choose bot skill' })
    .getByRole('button', { name: 'Intro', exact: true })
    .click();
  await reloadWithButton(page, 'Start 5v5 match');
  expect(requestedModels.has('sru-baron-base.glb')).toBe(true);
  const matchState = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    return {
      champion: w.hero.champion,
      mode: w.matchMode,
      botDifficulty: w.botDifficulty,
      riftBaron: w.riftBaron,
      roster: w.units
        .filter((u: any) => u.kind === 'champion')
        .map((u: any) => `${u.team}:${w.championState(u.id).role}:${u.champion}`)
        .sort(),
    };
  });
  expect(matchState).toEqual({
    champion: 'lux',
    mode: 'lanes',
    botDifficulty: 'intro',
    riftBaron: { unitId: null, lastClear: null, holders: [] },
    roster: [
      'blue:carry:ashe',
      'blue:jungle:masteryi',
      'blue:mid:lux',
      'blue:support:leona',
      'blue:top:garen',
      'red:carry:ashe',
      'red:jungle:masteryi',
      'red:mid:ahri',
      'red:support:leona',
      'red:top:garen',
    ],
  });
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.keyboard.down('Tab');
  await expect(page.getByRole('region', { name: 'Baron Nashor' })).toHaveText(
    /^Baron Nashor in (20:00|19:\d\d)$/
  );
  await page.keyboard.up('Tab');
  expect(errors).toEqual([]);
});
