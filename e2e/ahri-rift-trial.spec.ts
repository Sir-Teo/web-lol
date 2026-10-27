import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { pauseAtCombatState } from './helpers/pause-combat-state';

test.use({ viewport: { width: 1440, height: 900 } });
test.setTimeout(180000);

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
  await page.goto('/?scene=ahri-rift');
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

test('human Ahri navigates source mid, aims a real Q and reloads its outbound orb exactly', async ({
  page,
}, info) => {
  const errors = errorsFor(page),
    maps: string[] = [];
  page.on('request', (r) => {
    if (/\/assets\/maps\/rift-(nav\.(?:json|bin)|layout\.json)$/.test(r.url())) maps.push(r.url());
  });
  await trial(page);
  await expect(page.locator('.champion-title strong')).toHaveText('AHRI');
  await expect(page.locator('#practice-button')).toBeHidden();
  const initial = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    return {
      battlefield: w.battlefield.id,
      mode: w.matchMode,
      champion: w.hero.champion,
      role: w.player.role,
      ai: w.hero.ai,
      lane: w.hero.lane,
      ranks: w.player.spellRanks,
      points: w.player.skillPoints,
      maxMana: w.hero.maxMana,
      champions: w.units
        .filter((u: any) => u.kind === 'champion')
        .map((u: any) => ({
          team: u.team,
          champion: u.champion,
          role: w.championState(u.id).role,
          ai: u.ai,
        })),
      turrets: w.units.filter((u: any) => u.kind === 'turret').length,
    };
  });
  expect(initial).toMatchObject({
    battlefield: 'rift',
    mode: 'lanes',
    champion: 'ahri',
    role: 'mid',
    ai: false,
    lane: null,
    ranks: { q: 0, w: 0, e: 0, r: 0 },
    points: 1,
    maxMana: 418,
    turrets: 22,
  });
  expect(initial.champions).toHaveLength(10);
  expect(initial.champions.filter((u: any) => u.ai)).toHaveLength(9);
  expect(initial.champions.filter((u: any) => u.champion === 'ahri')).toHaveLength(1);
  expect(initial.champions.filter((u: any) => u.champion === 'ashe')).toHaveLength(6);
  expect(initial.champions.filter((u: any) => u.champion === 'lux')).toHaveLength(3);
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
  const prepared = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const lane = w.battlefield.lanes.find((l: any) => l.name === 'mid'),
      origin = { x: w.hero.x, y: w.hero.y };
    const target = w.units.find(
      (u: any) => u.kind === 'champion' && u.team === 'red' && w.championState(u.id)?.role === 'mid'
    );
    w.setOrder(w.hero, { type: 'move', point: lane.points[Math.floor(lane.points.length / 2)] });
    let walkable = true;
    for (
      let i = 0;
      i < 6000 &&
      !(w.visible(target, 'blue') && Math.hypot(w.hero.x - target.x, w.hero.y - target.y) <= 650);
      i++
    ) {
      w.step();
      walkable &&= w.battlefield.lineWalkable(w.hero.previous, w.hero, w.hero.radius, 'blue');
    }
    w.setOrder(w.hero, { type: 'idle' });
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      walkable,
      distance: Math.hypot(w.hero.x - origin.x, w.hero.y - origin.y),
      targetId: target.id,
      targetChampion: target.champion,
      targetAI: target.ai,
      targetVisible: w.visible(target, 'blue'),
      targetDistance: Math.hypot(target.x - w.hero.x, target.y - w.hero.y),
      heroAlive: w.alive(w.hero),
      hp: target.hp,
    };
  });
  expect(prepared.walkable).toBe(true);
  expect(prepared.distance).toBeGreaterThan(1000);
  expect(prepared.targetChampion).toBe('lux');
  expect(prepared.targetAI).toBe(true);
  expect(prepared.targetVisible).toBe(true);
  expect(prepared.targetDistance).toBeLessThanOrEqual(650);
  expect(prepared.heroAlive).toBe(true);
  await page.waitForFunction(
    (id) => (window as any).__GAME__.view.models.get(id)?.root.visible,
    prepared.targetId
  );
  const aim = await page.evaluate((id) => {
    const g = (window as any).__GAME__,
      t = g.world.unit(id);
    return g.view.screenPoint(t);
  }, prepared.targetId);
  await page.mouse.move(aim.x, aim.y);
  await pauseAtCombatState(page, 'pending-cast');
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.down('q');
  await expect.poll(() => page.evaluate(() => (window as any).__GAME__.view.aimMode)).toBe('q');
  await expect
    .poll(() => page.evaluate(() => (window as any).__GAME__.view.aimLine.geometry.drawRange.count))
    .toBe(5);
  await page.keyboard.up('q');
  await page.waitForFunction(
    () =>
      (window as any).__GAME__.world.player.pendingCast?.ability === 'q' &&
      (window as any).__GAME__.hud.paused
  );
  const outbound = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(20);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    const snapshot = w.snapshot(),
      copy = w.constructor.fromSnapshot(snapshot, w.battlefield),
      outward = new Set<number>(),
      returning = new Set<number>();
    for (let i = 0; i < 180; i++) {
      copy.step();
      for (const orb of copy.ahriOrbs) {
        orb.outwardHits.forEach((id: number) => outward.add(id));
        orb.returnHits.forEach((id: number) => returning.add(id));
      }
    }
    const { writeMatch } = await import('/src/storage/match-store.ts');
    await writeMatch('development-ahri-rift', snapshot);
    return {
      snapshot,
      future: copy.snapshot(),
      orbs: w.ahriOrbs,
      outward: [...outward],
      returning: [...returning],
      mana: w.hero.mana,
    };
  });
  expect(outbound.orbs).toHaveLength(1);
  expect(outbound.orbs[0].sourceId).toBe(JSON.parse(outbound.snapshot).player.id);
  expect(outbound.outward).toContain(prepared.targetId);
  expect(outbound.returning).toContain(prepared.targetId);
  await page.screenshot({ path: info.outputPath('ahri-source-mid-q-outbound.png') });
  await page.reload();
  await ready(page);
  const restored = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      snapshot = w.snapshot();
    w.step(180);
    g.hud.closeModal();
    g.setPaused(true);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      snapshot,
      future: w.snapshot(),
      champion: w.hero.champion,
      role: w.player.role,
      orbs: w.ahriOrbs.length,
      walkable: w.battlefield.lineWalkable(w.hero, w.hero, w.hero.radius, 'blue'),
    };
  });
  expect(restored.snapshot).toBe(outbound.snapshot);
  expect(restored.future).toBe(outbound.future);
  expect(restored.champion).toBe('ahri');
  expect(restored.role).toBe('mid');
  expect(restored.orbs).toBe(0);
  expect(restored.walkable).toBe(true);
  await page.waitForFunction(
    () =>
      (window as any).__GAME__.view.models.get((window as any).__GAME__.world.hero.id)?.root.visible
  );
  await expect(page.locator('#modal')).toBeHidden();
  await page.screenshot({ path: info.outputPath('ahri-source-mid-return-visible.png') });
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('source-mid.json'),
    JSON.stringify({ initial, prepared, aim, outbound, restored, maps, errors }, null, 2)
  );
});

test('trial Save/reload and restart preserve mid identity and keep the ordinary save', async ({
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
      point: w.battlefield.lanes.find((l: any) => l.name === 'mid').points[2],
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
    return { ordinary: await readMatch('rift'), trial: await readMatch('development-ahri-rift') };
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
  expect(restored).toEqual({ ...prepared, champion: 'ahri', role: 'mid' });
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
    champion: 'ahri',
    role: 'mid',
    ranks: { q: 0, w: 0, e: 0, r: 0 },
    champions: 10,
    ordinary,
  });
  writeFileSync(
    info.outputPath('saved-mid.json'),
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
  await expect(page.getByRole('button', { name: 'Ahri', exact: true })).toHaveCount(0);
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
  await page.goto('/?champion=ahri');
  await ready(page);
  const ordinary = await page.evaluate(async () => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    const { readMatch } = await import('/src/storage/match-store.ts');
    return {
      champion: w.hero.champion,
      mode: w.matchMode,
      permission: w.battlefield.developmentAhriRift ?? false,
      ahriUnits: w.units.filter((u: any) => u.champion === 'ahri').length,
      stored: await readMatch('rift'),
    };
  });
  expect(ordinary).toEqual({
    champion: 'ashe',
    mode: 'practice',
    permission: false,
    ahriUnits: 0,
    stored: trialSave,
  });
  writeFileSync(
    info.outputPath('ordinary-gate.json'),
    JSON.stringify({ ordinary, errors }, null, 2)
  );
  expect(errors).toEqual([]);
});
