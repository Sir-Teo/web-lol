import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test.use({ viewport: { width: 1440, height: 900 } });
test.setTimeout(120000);

async function ready(page: Page) {
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 90000 });
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 90000 });
}
function errorsFor(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
async function trial(page: Page) {
  await page.goto('/?scene=leona-rift');
  await ready(page);
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

test('the development support uses real Rift navigation, Leona controls and the ten-role roster', async ({
  page,
}, info) => {
  const errors = errorsFor(page),
    maps: string[] = [];
  page.on('request', (r) => {
    if (/\/assets\/maps\/rift-(nav\.(?:json|bin)|layout\.json)$/.test(r.url())) maps.push(r.url());
  });
  await trial(page);
  await expect(page.locator('.champion-title strong')).toHaveText('LEONA');
  await expect(page.locator('#practice-button')).toBeHidden();
  const initial = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    return {
      battlefield: w.battlefield.id,
      mode: w.matchMode,
      champion: w.hero.champion,
      role: w.player.role,
      ai: w.hero.ai,
      lane: w.hero.lane,
      ranks: w.player.spellRanks,
      points: w.player.skillPoints,
      champions: w.units
        .filter((u: any) => u.kind === 'champion')
        .map((u: any) => ({
          id: u.id,
          team: u.team,
          champion: u.champion,
          role: w.championState(u.id).role,
          ai: u.ai,
          lane: u.lane,
        })),
      turrets: w.units.filter((u: any) => u.kind === 'turret').length,
      dummy: w.units.some((u: any) => u.kind === 'dummy'),
    };
  });
  expect(initial).toMatchObject({
    battlefield: 'rift',
    mode: 'lanes',
    champion: 'leona',
    role: 'support',
    ai: false,
    lane: null,
    ranks: { q: 0, w: 0, e: 0, r: 0 },
    points: 1,
    turrets: 22,
    dummy: false,
  });
  expect(initial.champions).toHaveLength(10);
  expect(initial.champions.filter((u: any) => u.ai)).toHaveLength(9);
  for (const team of ['blue', 'red'])
    expect(
      initial.champions
        .filter((u: any) => u.team === team)
        .map((u: any) => u.role)
        .sort()
    ).toEqual(['carry', 'jungle', 'mid', 'support', 'top']);
  expect(new Set(maps.map((u) => new URL(u).pathname.split('/').at(-1))).size).toBe(3);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.press('Control+q');
  await page.waitForFunction(() => (window as any).__GAME__.world.player.spellRanks.q === 1);
  const mana = await page.evaluate(() => (window as any).__GAME__.world.hero.mana);
  await page.keyboard.press('q');
  await page.waitForFunction(() => !!(window as any).__GAME__.world.player.leonaQ);
  const paid = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    return { mana: g.world.hero.mana, cooldown: g.world.player.cooldowns.q, tick: g.world.tick };
  });
  expect(paid.mana).toBeLessThan(mana - 20);
  expect(paid.cooldown).toBeGreaterThan(paid.tick);
  const movement = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const origin = { x: w.hero.x, y: w.hero.y };
    const lane = w.battlefield.lanes.find((l: any) => l.name === 'bot');
    w.setOrder(w.hero, { type: 'move', point: lane.points[2] });
    let walkable = true;
    for (let i = 0; i < 360; i++) {
      w.step();
      for (const u of w.units.filter((u: any) => u.kind === 'champion'))
        walkable &&= w.battlefield.lineWalkable(u.previous, u, u.radius, u.team);
    }
    g.view.recenter(w.hero);
    g.view.render(w, 1, 10);
    g.hud.update(60);
    return {
      walkable,
      distance: Math.hypot(w.hero.x - origin.x, w.hero.y - origin.y),
      snapshot: w.snapshot(),
    };
  });
  expect(movement.walkable).toBe(true);
  expect(movement.distance).toBeGreaterThan(1000);
  await page.screenshot({ path: info.outputPath('leona-on-rift.png') });
  writeFileSync(
    info.outputPath('rift-support.json'),
    JSON.stringify({ initial, paid, movement, maps, errors }, null, 2)
  );
  expect(errors).toEqual([]);
});

test('trial Save/reload and restart preserve support identity and keep the ordinary save', async ({
  page,
}, info) => {
  const errors = errorsFor(page);
  await page.goto('/');
  await ready(page);
  const ordinary = await page.evaluate(async () => {
    const g = (window as any).__GAME__;
    g.setPaused(true);
    const { writeMatch } = await import('/src/storage/match-store.ts');
    const saved = g.world.snapshot();
    await writeMatch('rift', saved);
    return saved;
  });
  await trial(page);
  const prepared = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(300);
    w.learnSpell('e');
    w.setOrder(w.hero, {
      type: 'move',
      point: w.battlefield.lanes.find((l: any) => l.name === 'bot').points[2],
    });
    w.step(90);
    const { World } = await import('/src/simulation/world.ts');
    const snapshot = w.snapshot(),
      copy = World.fromSnapshot(snapshot, w.battlefield);
    copy.step(400);
    g.hud.toggleModal('pause');
    return { snapshot, future: copy.snapshot() };
  });
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  const stored = await page.evaluate(async () => {
    const { readMatch } = await import('/src/storage/match-store.ts');
    return { ordinary: await readMatch('rift'), trial: await readMatch('development-leona-rift') };
  });
  expect(stored.ordinary).toBe(ordinary);
  expect(stored.trial).toBe(prepared.snapshot);
  await page.reload();
  await ready(page);
  const restored = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      snapshot = w.snapshot();
    w.step(400);
    return { snapshot, future: w.snapshot(), champion: w.hero.champion, role: w.player.role };
  });
  expect(restored).toEqual({ ...prepared, champion: 'leona', role: 'support' });
  await reloadAction(page, 'Restart 5v5 match');
  const restarted = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    const { readMatch } = await import('/src/storage/match-store.ts');
    return {
      tick: w.tick,
      mode: w.matchMode,
      champion: w.hero.champion,
      role: w.player.role,
      ranks: w.player.spellRanks,
      champions: w.units.filter((u: any) => u.kind === 'champion').length,
      ordinary: await readMatch('rift'),
    };
  });
  expect(restarted).toEqual({
    tick: 0,
    mode: 'lanes',
    champion: 'leona',
    role: 'support',
    ranks: { q: 0, w: 0, e: 0, r: 0 },
    champions: 10,
    ordinary,
  });
  writeFileSync(
    info.outputPath('saved-support.json'),
    JSON.stringify({ prepared, restored, restarted, stored, errors }, null, 2)
  );
  expect(errors).toEqual([]);
});

test('the ordinary chooser remains Ashe/Lux and its choice survives the trial URL', async ({
  page,
}, info) => {
  const errors = errorsFor(page);
  await trial(page);
  await page.evaluate(() => (window as any).__GAME__.hud.toggleModal('pause'));
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Leona', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Lux', exact: true }).click();
  await reloadAction(page, 'Start 5v5 match');
  const selected = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    return { champion: w.hero.champion, role: w.player.role, mode: w.matchMode, tick: w.tick };
  });
  expect(selected).toEqual({ champion: 'lux', role: 'mid', mode: 'lanes', tick: 0 });
  await reloadAction(page, 'Restart 5v5 match');
  expect(await page.evaluate(() => (window as any).__GAME__.world.hero.champion)).toBe('lux');
  await page.getByRole('button', { name: 'New match', exact: true }).click();
  await reloadAction(page, 'Start practice');
  expect(
    await page.evaluate(() => {
      const w = (window as any).__GAME__.world;
      return { champion: w.hero.champion, mode: w.matchMode };
    })
  ).toEqual({ champion: 'lux', mode: 'practice' });
  await expect(page.locator('#practice-button')).toBeVisible();
  writeFileSync(info.outputPath('chooser.json'), JSON.stringify({ selected, errors }, null, 2));
  expect(errors).toEqual([]);
});

test('ordinary Rift rejects a trial save and a champion query cannot grant development permission', async ({
  page,
}, info) => {
  const errors = errorsFor(page);
  await trial(page);
  const trialSave = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      snapshot = g.world.snapshot();
    const { writeMatch } = await import('/src/storage/match-store.ts');
    await writeMatch('rift', snapshot);
    return snapshot;
  });
  await page.goto('/?champion=leona');
  await ready(page);
  const ordinary = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const { readMatch } = await import('/src/storage/match-store.ts');
    return {
      champion: w.hero.champion,
      mode: w.matchMode,
      permission: w.battlefield.developmentLeona ?? false,
      leonas: w.units.filter((u: any) => u.champion === 'leona').length,
      stored: await readMatch('rift'),
    };
  });
  expect(ordinary).toEqual({
    champion: 'ashe',
    mode: 'practice',
    permission: false,
    leonas: 0,
    stored: trialSave,
  });
  writeFileSync(
    info.outputPath('ordinary-gate.json'),
    JSON.stringify({ ordinary, errors }, null, 2)
  );
  expect(errors).toEqual([]);
});
