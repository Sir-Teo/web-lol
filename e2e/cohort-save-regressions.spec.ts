import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
async function ready(page: Page) {
  await page.waitForFunction(() => !!(window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
}

test('Crystal Arrow splash preserves a real source ward through Save match and reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await ready(page);
  const target = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    const { wardScaling } = await import('/src/content/warding-totem.ts');
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    for (const u of w.units) u.ai = false;
    Object.assign(w.hero, { x: 0, y: -1000, previous: { x: 0, y: -1000 } });
    const primary = w.spawn('champion', 'red', { x: 550, y: -1000 });
    primary.ai = false;
    primary.hp = primary.maxHp = 10000;
    const minion = w.spawn('melee', 'red', { x: 550, y: -750 });
    minion.ai = false;
    const ward = w.spawnWard({
      ownerId: primary.id,
      team: 'red',
      origin: primary,
      point: { x: 550, y: -800 },
      startTick: w.tick,
      readyTick: w.tick,
      lifeTicks: wardScaling(1).lifeTicks,
    });
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      primary: primary.id,
      ward: ward.id,
      minion: minion.id,
      screen: g.view.screenPoint(primary),
    };
  });
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.mouse.move(target.screen.x, target.screen.y);
  await page.keyboard.down('r');
  await page.keyboard.up('r');
  await page.waitForFunction((id) => {
    const g = (window as any).__GAME__;
    if (g.world.unit(id).stunUntil <= g.world.tick) return false;
    g.setPaused(true);
    return true;
  }, target.primary);
  const state = await page.evaluate(({ ward, minion }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      u = w.unit(ward),
      v = w.unit(minion);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      ward: {
        hp: u.hp,
        slowUntil: u.slowUntil,
        slows: u.slows,
        stunUntil: u.stunUntil,
        rootUntil: u.rootUntil,
      },
      minionSlowed: v.slowUntil > w.tick,
      saved: w.snapshot(),
    };
  }, target);
  expect(state.ward).toEqual({ hp: 3, slowUntil: 0, slows: [], stunUntil: 0, rootUntil: 0 });
  expect(state.minionSlowed).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(state.saved);
  await page.screenshot({ path: 'artifacts/cohort-ward-reload.png' });
  writeFileSync(
    'artifacts/cohort-ward-reload.json',
    JSON.stringify(
      { ward: state.ward, minionSlowed: state.minionSlowed, exactReload: true },
      null,
      2
    ) + '\n'
  );
  expect(errors).toEqual([]);
});

test('winning restoration boundary exports a valid result file and loads through Match files', async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await ready(page);
  const result = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    const { grantRedBuff, RED_BUFF_REGEN_TICKS } = await import('/src/simulation/red-buff.ts');
    const { LOST_CHAPTER } = await import('/src/content/mage-items.ts');
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    w.units = w.units.filter((u: any) => u.id === w.hero.id || u.structure);
    for (const role of ['outer-turret', 'inner-turret', 'inhibitor-turret', 'inhibitor'])
      w.damage(
        w.hero,
        w.units.find(
          (u: any) => u.team === 'red' && u.structure?.role === role && u.structure.lane === 'mid'
        ),
        1e6,
        'true'
      );
    for (const unit of w.units.filter(
      (u: any) => u.team === 'red' && u.structure?.role === 'nexus-turret'
    ))
      w.damage(w.hero, unit, 1e6, 'true');
    const nexus = w.units.find((u: any) => u.team === 'red' && u.kind === 'nexus');
    nexus.hp = 1;
    w.step(300);
    const attacker = w.spawn('melee', 'blue', { x: nexus.x + 350, y: nexus.y });
    attacker.ai = false;
    w.setOrder(attacker, { type: 'attack', target: nexus.id });
    w.step();
    const release = attacker.releaseTick;
    grantRedBuff(w.player, release - RED_BUFF_REGEN_TICKS);
    w.player.enlighten = {
      startTick: release - LOST_CHAPTER.durationSeconds * 60,
      endTick: release,
      totalMana: w.hero.maxMana * LOST_CHAPTER.manaFraction,
    };
    w.hero.hp = 1;
    w.hero.mana = 0;
    w.step(release - w.tick - 1);
    const before = { hp: w.hero.hp, mana: w.hero.mana };
    w.step();
    g.view.recenter(nexus);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      winner: w.winner,
      tick: w.tick,
      before,
      after: { hp: w.hero.hp, mana: w.hero.mana },
      nextRegen: w.player.redBuff.nextRegenTick,
      enlighten: w.player.enlighten,
      saved: w.snapshot(),
    };
  });
  expect(result.winner).toBe('blue');
  expect(result.after).toEqual(result.before);
  expect(result.nextRegen).toBe(result.tick + 30);
  expect(result.enlighten).toBeNull();
  await expect(page.getByRole('heading', { name: 'Victory', exact: true })).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download current match', exact: true }).click();
  const download = await pending,
    text = readFileSync((await download.path())!, 'utf8');
  expect(text).toBe(result.saved);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }),
    target = await context.newPage();
  target.on('pageerror', (error) => errors.push(error.message));
  try {
    await target.goto(new URL('/', page.url()).href);
    await ready(target);
    await target.keyboard.press('Escape');
    await target.getByRole('button', { name: 'Match files', exact: true }).click();
    await target
      .getByLabel('Match file', { exact: true })
      .setInputFiles({
        name: download.suggestedFilename(),
        mimeType: 'application/json',
        buffer: Buffer.from(text),
      });
    await expect(
      target.getByRole('button', { name: 'Load this match', exact: true })
    ).toBeVisible();
    await Promise.all([
      target.waitForEvent('load'),
      target.getByRole('button', { name: 'Load this match', exact: true }).click(),
    ]);
    await ready(target);
    await expect(target.getByRole('heading', { name: 'Victory', exact: true })).toBeVisible();
    expect(
      await target.evaluate(() => {
        const w = (window as any).__GAME__.world;
        w.step(120);
        return w.snapshot();
      })
    ).toBe(text);
    await target.screenshot({ path: 'artifacts/cohort-winning-file-import.png' });
  } finally {
    await context.close();
  }
  writeFileSync(
    'artifacts/cohort-winning-file-import.json',
    JSON.stringify({ ...result, saved: undefined, exactResultFileImport: true }, null, 2) + '\n'
  );
  expect(errors).toEqual([]);
});
