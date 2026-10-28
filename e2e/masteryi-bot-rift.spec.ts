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

test('Yi jungle bot trial keeps paid companions, natural Alpha clears, private saves and real Ashe restart', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=masteryi-rift', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await pause(page);
  const original = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    const { createLaneMatch } = await import('/src/simulation/lane-match.ts');
    const { writeMatch } = await import('/src/storage/match-store.ts');
    const ordinary = createLaneMatch(
      { ...w.battlefield, developmentMasterYiRift: undefined, developmentMasterYiBots: undefined },
      'ashe'
    ).snapshot();
    await writeMatch('rift', ordinary);
    return { original: w.snapshot(), ordinary };
  });
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.goto('/?scene=masteryi-rift&bots=masteryi', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await pause(page);
  const initial = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    return {
      hero: w.hero.champion,
      role: w.player.role,
      summoners: w.player.summoners,
      gold: w.player.gold,
      inventory: w.player.inventory,
      humanCompanion: w.companions.some((c: any) => c.ownerId === w.hero.id),
      roster: w.units
        .filter((u: any) => u.kind === 'champion')
        .map((u: any) => ({ champion: u.champion, ai: u.ai, role: w.championState(u.id).role })),
    };
  });
  expect(initial).toMatchObject({
    hero: 'masteryi',
    role: 'jungle',
    summoners: { d: 'smite', f: 'flash' },
    gold: 500,
    inventory: [],
    humanCompanion: false,
  });
  expect(initial.roster).toHaveLength(10);
  expect(initial.roster.filter((u) => u.champion === 'masteryi')).toHaveLength(2);
  expect(initial.roster.filter((u) => u.ai)).toHaveLength(9);
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Master Yi', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ashe', exact: true }).click();
  await reloadAction(page, 'Start 5v5 match');
  await pause(page);
  const selected = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const junglers = w.units.filter(
      (u: any) => u.kind === 'champion' && w.championState(u.id).role === 'jungle'
    );
    g.hud.scoreboard(true);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      hero: w.hero.champion,
      role: w.player.role,
      tick: w.tick,
      saved: w.snapshot(),
      junglers: junglers.map((u: any) => ({
        id: u.id,
        champion: u.champion,
        ai: u.ai,
        gold: w.championState(u.id).gold,
        inventory: w.championState(u.id).inventory,
        summoners: w.championState(u.id).summoners,
        companion: w.companions.find((c: any) => c.ownerId === u.id)?.kind,
      })),
    };
  });
  expect(selected).toMatchObject({ hero: 'ashe', role: 'carry', tick: 0 });
  expect(selected.junglers).toHaveLength(2);
  for (const bot of selected.junglers)
    expect(bot).toMatchObject({
      champion: 'masteryi',
      ai: true,
      gold: 50,
      inventory: ['mosstomper'],
      summoners: { d: 'smite', f: 'flash' },
      companion: 'mosstomper',
    });
  await expect(page.locator('.scoreboard-row')).toHaveCount(10);
  await page.screenshot({ path: info.outputPath('masteryi-bot-rift-scoreboard.png') });
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
    if (!target) throw new Error('Normal Yi route did not begin a monster Alpha Strike');
    w.step(7);
    g.view.zoom = 0.6;
    g.view.recenter(bot);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const state = w.championState(bot.id),
      saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(180);
    return {
      sourceId: bot.id,
      targetId: target.id,
      saved,
      future: copy.snapshot(),
      tick: w.tick,
      alpha: structuredClone(state.alphaStrike),
      targetSpecies: target.monster.species,
      targetHp: target.hp,
      visibleTarget: w.visible(target, 'blue'),
      visibleBody: g.view.models.get(bot.id).root.visible,
      qLayers: g.view.alphaCasts.models.size,
      ai: bot.ai,
      ranks: state.spellRanks,
      role: state.role,
    };
  });
  expect(clear.alpha).toMatchObject({ primaryTargetId: clear.targetId, reappearTick: null });
  expect(clear.ai).toBe(true);
  expect(clear.role).toBe('jungle');
  expect(clear.ranks.q).toBeGreaterThan(0);
  expect(clear.visibleTarget).toBe(true);
  expect(clear.visibleBody).toBe(false);
  expect(clear.qLayers).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('masteryi-bot-rift-alpha-clear.png') });
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const stored = await page.evaluate(async () => {
    const { readMatch } = await import('/src/storage/match-store.ts');
    return {
      original: await readMatch('development-masteryi-rift'),
      ordinary: await readMatch('rift'),
      bots: await readMatch('development-masteryi-bots-rift'),
    };
  });
  expect(stored.original).toBe(original.original);
  expect(stored.ordinary).toBe(original.ordinary);
  expect(stored.bots).toBe(clear.saved);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  const restored = await page.evaluate(({ tick, sourceId, targetId }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      saved = w.snapshot();
    w.step(tick + 180 - w.tick);
    return {
      saved,
      future: w.snapshot(),
      hero: w.hero.champion,
      ai: w.unit(sourceId).ai,
      targetHp: w.unit(targetId)?.hp ?? 0,
      paused: g.hud.paused,
    };
  }, clear);
  expect(restored.saved).toBe(clear.saved);
  expect(restored.future).toBe(clear.future);
  expect(restored.hero).toBe('ashe');
  expect(restored.ai).toBe(true);
  expect(restored.paused).toBe(true);
  expect(restored.targetHp).toBeLessThan(clear.targetHp);
  await reloadAction(page, 'Restart 5v5 match');
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(selected.saved);
  await page.goto('/?scene=masteryi-rift', { waitUntil: 'domcontentloaded' });
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(
    original.original
  );
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('masteryi-bot-rift.json'),
    JSON.stringify({ original, initial, selected, clear, stored, restored, errors }, null, 2)
  );
});
