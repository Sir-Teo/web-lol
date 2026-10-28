import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test.setTimeout(420000);
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
async function reloadAction(page: Page, name: string) {
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name, exact: true }).click(),
  ]);
  await ready(page);
}
async function choose(page: Page, name: 'Ashe' | 'Lux') {
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await expect(page.locator('[data-action="choose-champion"]')).toHaveCount(2);
  await page.getByRole('button', { name, exact: true }).click();
  await reloadAction(page, 'Start 5v5 match');
  await pause(page);
}

test('combined roster uses six identities with real Lux/Ashe selection, natural jungle casts and isolated saved futures', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=ahri-rift&bots=ahri', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await pause(page);
  const previous = await page.evaluate(async () => {
    const w = (window as any).__GAME__.world;
    const { createLaneMatch } = await import('/src/simulation/lane-match.ts');
    const { writeMatch } = await import('/src/storage/match-store.ts');
    const base = {
      ...w.battlefield,
      developmentAhriRift: undefined,
      developmentAhriBots: undefined,
    };
    const ordinary = createLaneMatch(base).snapshot();
    const yi = createLaneMatch(
      { ...base, developmentMasterYiRift: true, developmentMasterYiBots: true },
      'masteryi',
      { d: 'smite', f: 'flash' }
    ).snapshot();
    await writeMatch('rift', ordinary);
    await writeMatch('development-masteryi-bots-rift', yi);
    return { ahri: w.snapshot(), ordinary, yi };
  });
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.goto('/?scene=roster-rift', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await pause(page);
  const initial = await page.evaluate(async () => {
    const w = (window as any).__GAME__.world;
    const { createLaneMatch } = await import('/src/simulation/lane-match.ts');
    return {
      hero: w.hero.champion,
      role: w.player.role,
      gold: w.player.gold,
      inventory: w.player.inventory,
      freshAshe: createLaneMatch(w.battlefield, 'ashe', w.player.summoners).snapshot(),
      roster: w.units
        .filter((u: any) => u.kind === 'champion')
        .map((u: any) => ({
          champion: u.champion,
          team: u.team,
          role: w.championState(u.id).role,
          ai: u.ai,
        })),
    };
  });
  expect(initial).toMatchObject({ hero: 'ashe', role: 'carry', gold: 500, inventory: [] });
  expect(initial.roster).toHaveLength(10);
  for (const champion of ['garen', 'masteryi', 'ahri', 'leona'])
    expect(initial.roster.filter((u) => u.champion === champion)).toHaveLength(2);
  await choose(page, 'Lux');
  const selected = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.hud.scoreboard(true);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      hero: w.hero.champion,
      role: w.player.role,
      tick: w.tick,
      saved: w.snapshot(),
      roster: w.units
        .filter((u: any) => u.kind === 'champion')
        .map((u: any) => ({
          id: u.id,
          champion: u.champion,
          ai: u.ai,
          team: u.team,
          role: w.championState(u.id).role,
          gold: w.championState(u.id).gold,
          inventory: [...w.championState(u.id).inventory],
        })),
    };
  });
  expect(selected).toMatchObject({ hero: 'lux', role: 'mid', tick: 0 });
  expect([...new Set(selected.roster.map((u) => u.champion))].sort()).toEqual([
    'ahri',
    'ashe',
    'garen',
    'leona',
    'lux',
    'masteryi',
  ]);
  expect(selected.roster.filter((u) => u.ai)).toHaveLength(9);
  for (const bot of selected.roster.filter((u) => u.role === 'jungle'))
    expect(bot).toMatchObject({
      champion: 'masteryi',
      ai: true,
      gold: 50,
      inventory: ['mosstomper'],
    });
  await expect(page.locator('.scoreboard-row')).toHaveCount(10);
  await page.screenshot({ path: info.outputPath('roster-rift-scoreboard.png') });
  const clear = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.hud.scoreboard(false);
    const bot = w.units.find((u: any) => u.champion === 'masteryi' && u.team === 'blue');
    let target;
    for (let i = 0; i < 7200; i++) {
      w.step();
      const alpha = w.championState(bot.id).alphaStrike;
      const candidate = alpha ? w.unit(alpha.primaryTargetId) : undefined;
      if (alpha && candidate?.kind === 'monster') {
        target = candidate;
        break;
      }
    }
    if (!target) throw new Error('Combined roster never began a natural monster Alpha');
    w.step(7);
    g.view.zoom = 0.6;
    g.view.recenter(bot);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(180);
    return {
      saved,
      future: copy.snapshot(),
      tick: w.tick,
      sourceId: bot.id,
      targetId: target.id,
      targetHp: target.hp,
      alpha: structuredClone(w.championState(bot.id).alphaStrike),
      visibleTarget: w.visible(target, 'blue'),
      visibleBody: g.view.models.get(bot.id).root.visible,
      qLayers: g.view.alphaCasts.models.size,
      botRanks: w.units
        .filter((u: any) => u.ai && u.kind === 'champion')
        .map((u: any) => ({
          champion: u.champion,
          ranks: { ...w.championState(u.id).spellRanks },
        })),
    };
  });
  expect(clear.alpha).toMatchObject({ primaryTargetId: clear.targetId, reappearTick: null });
  expect(clear.visibleTarget).toBe(true);
  expect(clear.visibleBody).toBe(false);
  expect(clear.qLayers).toBeGreaterThan(0);
  for (const bot of clear.botRanks)
    expect(Object.values(bot.ranks).reduce((a: number, b: any) => a + b, 0)).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('roster-rift-natural-alpha.png') });
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const stored = await page.evaluate(async () => {
    const { readMatch } = await import('/src/storage/match-store.ts');
    return {
      roster: await readMatch('development-roster-rift'),
      ahri: await readMatch('development-ahri-bots-rift'),
      yi: await readMatch('development-masteryi-bots-rift'),
      ordinary: await readMatch('rift'),
    };
  });
  expect(stored).toEqual({
    roster: clear.saved,
    ahri: previous.ahri,
    yi: previous.yi,
    ordinary: previous.ordinary,
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  const restored = await page.evaluate(({ tick, targetId }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      saved = w.snapshot();
    w.step(tick + 180 - w.tick);
    return {
      saved,
      future: w.snapshot(),
      targetHp: w.unit(targetId)?.hp ?? 0,
      paused: g.hud.paused,
    };
  }, clear);
  expect(restored.saved).toBe(clear.saved);
  expect(restored.future).toBe(clear.future);
  expect(restored.targetHp).toBeLessThan(clear.targetHp);
  expect(restored.paused).toBe(true);
  await reloadAction(page, 'Restart 5v5 match');
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(selected.saved);
  await pause(page);
  await choose(page, 'Ashe');
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(
    initial.freshAshe
  );
  await page.goto('/?scene=ahri-rift&bots=ahri', { waitUntil: 'domcontentloaded' });
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(previous.ahri);
  writeFileSync(
    info.outputPath('roster-rift.json'),
    JSON.stringify({ previous, initial, selected, clear, stored, restored, errors }, null, 2)
  );
  expect(errors).toEqual([]);
});
