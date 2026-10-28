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

test('normal Ahri mid bot casts on the source Rift and restores flight without overwriting other saves', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=ahri-rift', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await pause(page);
  const original = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    const { createLaneMatch } = await import('/src/simulation/lane-match.ts');
    const { writeMatch } = await import('/src/storage/match-store.ts');
    const ordinary = createLaneMatch(
      { ...w.battlefield, developmentAhriRift: undefined, developmentAhriBots: undefined },
      'ashe'
    ).snapshot();
    await writeMatch('rift', ordinary);
    return { original: w.snapshot(), ordinary };
  });
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.goto('/?scene=ahri-rift&bots=ahri', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await pause(page);
  const encounter = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const enemy = w.units.find((u: any) => u.champion === 'ahri' && u.team === 'red');
    const lane = w.battlefield.lanes.find((l: any) => l.name === 'mid');
    const roster = w.units
      .filter((u: any) => u.kind === 'champion')
      .map((u: any) => ({
        id: u.id,
        champion: u.champion,
        team: u.team,
        ai: u.ai,
        role: w.championState(u.id).role,
      }));
    w.setOrder(w.hero, { type: 'move', point: lane.points[Math.floor(lane.points.length / 2)] });
    let walkable = true;
    for (let i = 0; i < 6000 && w.championState(enemy.id).pendingCast?.ability !== 'q'; i++) {
      w.step();
      walkable &&= w.battlefield.lineWalkable(w.hero.previous, w.hero, w.hero.radius, 'blue');
    }
    w.setOrder(w.hero, { type: 'idle' });
    g.view.zoom = 0.6;
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      roster,
      walkable,
      enemyId: enemy.id,
      heroId: w.hero.id,
      pending: structuredClone(w.championState(enemy.id).pendingCast),
      clip: g.view.models.get(enemy.id).actionName,
      visible: w.visible(enemy, 'blue'),
      heroAlive: w.alive(w.hero),
      flag: w.battlefield.developmentAhriBots,
      battlefield: w.battlefield.id,
    };
  });
  expect(encounter.roster).toHaveLength(10);
  expect(encounter.roster.filter((u) => u.ai)).toHaveLength(9);
  expect(encounter.roster.filter((u) => u.champion === 'ahri')).toHaveLength(2);
  expect(encounter.roster.find((u) => u.id === encounter.enemyId)).toMatchObject({
    ai: true,
    role: 'mid',
  });
  expect(encounter.pending).toMatchObject({ ability: 'q', rank: 1 });
  expect(encounter.clip).toBe('spell1');
  expect(encounter.visible).toBe(true);
  expect(encounter.heroAlive).toBe(true);
  expect(encounter.walkable).toBe(true);
  expect(encounter.flag).toBe(true);
  expect(encounter.battlefield).toBe('rift');
  const flight = await page.evaluate(({ enemyId }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(20);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(180);
    const orb = w.ahriOrbs.find((o: any) => o.sourceId === enemyId);
    return {
      saved,
      future: copy.snapshot(),
      tick: w.tick,
      orb: structuredClone(orb),
      marker: g.view.projectileModels.get(orb.id).name,
    };
  }, encounter);
  expect(flight.orb.sourceId).toBe(encounter.enemyId);
  expect(flight.marker).toBe('Ahri Q development orb');
  await page.screenshot({ path: info.outputPath('ahri-bot-rift-flight.png') });
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  const stored = await page.evaluate(async () => {
    const { readMatch } = await import('/src/storage/match-store.ts');
    return {
      original: await readMatch('development-ahri-rift'),
      ordinary: await readMatch('rift'),
      bots: await readMatch('development-ahri-bots-rift'),
    };
  });
  expect(stored.original).toBe(original.original);
  expect(stored.ordinary).toBe(original.ordinary);
  expect(stored.bots).toBe(flight.saved);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await ready(page);
  const restored = await page.evaluate(
    ({ tick, enemyId, heroId }) => {
      const g = (window as any).__GAME__,
        w = g.world,
        saved = w.snapshot();
      let hit = false;
      while (w.tick < tick + 180) {
        w.step();
        hit ||= w.ahriOrbs.some(
          (o: any) => o.sourceId === enemyId && o.outwardHits.includes(heroId)
        );
      }
      return { saved, future: w.snapshot(), hit, ai: w.unit(enemyId).ai, paused: g.hud.paused };
    },
    { tick: flight.tick, enemyId: encounter.enemyId, heroId: encounter.heroId }
  );
  expect(restored.saved).toBe(flight.saved);
  expect(restored.future).toBe(flight.future);
  expect(restored.hit).toBe(true);
  expect(restored.ai).toBe(true);
  expect(restored.paused).toBe(true);
  await page.goto('/?scene=ahri-rift', { waitUntil: 'domcontentloaded' });
  await ready(page);
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(
    original.original
  );
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('ahri-bot-rift-save.json'),
    JSON.stringify({ original, encounter, flight, stored, restored, errors }, null, 2)
  );
});

test('real Ashe selection and restart retain two bot mids and all ten scoreboard roles', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=ahri-rift&bots=ahri', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await pause(page);
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ahri', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ashe', exact: true }).click();
  await reloadAction(page, 'Start 5v5 match');
  const selected = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.hud.closeModal();
    g.setPaused(true);
    g.hud.scoreboard(true);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      hero: w.hero.champion,
      role: w.player.role,
      tick: w.tick,
      mids: w.units
        .filter((u: any) => u.kind === 'champion' && w.championState(u.id).role === 'mid')
        .map((u: any) => ({ champion: u.champion, ai: u.ai })),
      saved: w.snapshot(),
    };
  });
  expect(selected).toMatchObject({ hero: 'ashe', role: 'carry', tick: 0 });
  expect(selected.mids).toEqual([
    { champion: 'ahri', ai: true },
    { champion: 'ahri', ai: true },
  ]);
  await expect(page.locator('.scoreboard-row')).toHaveCount(10);
  await page.screenshot({ path: info.outputPath('ahri-bot-rift-scoreboard.png') });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.hud.scoreboard(false);
    g.hud.toggleModal('pause');
  });
  await reloadAction(page, 'Restart 5v5 match');
  const restarted = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    return { hero: w.hero.champion, role: w.player.role, tick: w.tick, saved: w.snapshot() };
  });
  expect(restarted).toEqual({ hero: 'ashe', role: 'carry', tick: 0, saved: selected.saved });
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('ahri-bot-rift-chooser.json'),
    JSON.stringify({ selected, restarted, errors }, null, 2)
  );
});
