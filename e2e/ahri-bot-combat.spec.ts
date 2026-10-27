import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';

async function prepare(page: Page, charm: boolean) {
  await page.goto('/?scene=fixture&npc=ahri', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 300000 });
  await page.locator('#loading').waitFor({ state: 'detached' });
  return page.evaluate((charm) => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.hud.closeModal();
    g.setPaused(true);
    const bot = w.units.find((u: any) => u.champion === 'ahri');
    w.units = [w.hero, bot];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.hero.ai = false;
    w.hero.x = bot.x - 2500;
    w.hero.y = bot.y;
    w.setOrder(bot, { type: 'idle' });
    bot.ai = true;
    bot.nextThink = 0;
    const state = w.championState(bot.id);
    state.cooldowns.d = state.cooldowns.f = Infinity;
    if (charm) w.gainExperience(280, bot.id);
    const target = w.spawn('champion', 'red', { x: bot.x + 650, y: bot.y }, 'lux');
    target.ai = false;
    target.hp = target.maxHp = 10000;
    if (!charm) {
      const blocker = w.spawn('melee', 'red', { x: bot.x + 300, y: bot.y });
      blocker.ai = false;
    }
    w.step();
    const commands = structuredClone(w.commands);
    w.step();
    g.view.zoom = 0.6;
    g.view.recenter(bot);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      sourceId: bot.id,
      targetId: target.id,
      commands,
      ranks: state.spellRanks,
      pending: state.pendingCast,
      clip: g.view.models.get(bot.id).actionName,
      mana: bot.mana,
      maxMana: bot.maxMana,
    };
  }, charm);
}

test('AI-learned Charm renders its normal flight/control and resumes through real Save/reload', async ({
  page,
}, info) => {
  test.setTimeout(420000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const start = await prepare(page, true);
  expect(start.ranks).toEqual({ q: 1, w: 0, e: 1, r: 0 });
  expect(start.commands).toMatchObject([{ type: 'cast', unit: start.sourceId, ability: 'e' }]);
  expect(start.pending).toMatchObject({ ability: 'e', rank: 1, damage: 80 });
  expect(start.clip).toBe('spell3_north');
  expect(start.mana).toBeLessThan(start.maxMana);
  const flight = await page.evaluate(({ sourceId }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(20);
    g.view.render(w, 1, g.view.previousElapsed);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    copy.step(180);
    return {
      saved,
      future: copy.snapshot(),
      tick: w.tick,
      clip: g.view.models.get(sourceId).actionName,
      missile: w.projectiles.find((p: any) => p.type === 'charm' && p.source === sourceId),
      markers: [...g.view.projectileModels.values()].map((m: any) => m.name),
    };
  }, start);
  expect(flight.missile).toMatchObject({ speed: 1550, charmRank: 1 });
  expect(flight.markers).toContain('Ahri provisional Charm');
  await page.screenshot({ path: info.outputPath('ahri-bot-charm-flight.png') });
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 300000 });
  await page.locator('#loading').waitFor({ state: 'detached' });
  const impact = await page.evaluate(({ sourceId, targetId }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      saved = w.snapshot();
    g.hud.closeModal();
    g.setPaused(true);
    const source = w.unit(sourceId),
      target = w.unit(targetId);
    for (let i = 0; i < 100 && !target.charm; i++) w.step();
    const before = { x: target.x, y: target.y };
    w.step();
    g.view.recenter(source);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      saved,
      charm: target.charm,
      before,
      after: { x: target.x, y: target.y },
      tick: w.tick,
      ai: source.ai,
      paused: g.hud.paused,
    };
  }, start);
  expect(impact.saved).toBe(flight.saved);
  expect(impact.ai).toBe(true);
  expect(impact.paused).toBe(true);
  expect(impact.charm).toMatchObject({ sourceId: start.sourceId, rank: 1 });
  expect(impact.after.x).toBeLessThan(impact.before.x);
  await expect(page.getByText('CHARMED', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('ahri-bot-charm-control.png') });
  const future = await page.evaluate((tick) => {
    const w = (window as any).__GAME__.world;
    w.step(tick - w.tick);
    return w.snapshot();
  }, flight.tick + 180);
  expect(future).toBe(flight.future);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('ahri-bot-charm.json'),
    JSON.stringify({ start, flight, impact, future, errors }, null, 2)
  );
});

test('level-one AI Orb passes the lane blocker and hits both legs with exact saved flight', async ({
  page,
}, info) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const start = await prepare(page, false);
  expect(start.ranks).toEqual({ q: 1, w: 0, e: 0, r: 0 });
  expect(start.commands).toMatchObject([{ type: 'cast', unit: start.sourceId, ability: 'q' }]);
  expect(start.pending).toMatchObject({ ability: 'q', rank: 1, damage: 35 });
  expect(start.clip).toBe('spell1');
  const flight = await page.evaluate(({ sourceId }) => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(20);
    g.view.render(w, 1, g.view.previousElapsed);
    const saved = w.snapshot(),
      copy = w.constructor.fromSnapshot(saved, w.battlefield);
    return {
      saved,
      exact: copy.snapshot() === saved,
      orb: w.ahriOrbs.find((o: any) => o.sourceId === sourceId),
      clip: g.view.models.get(sourceId).actionName,
    };
  }, start);
  expect(flight.exact).toBe(true);
  expect(flight.orb).toMatchObject({ sourceId: start.sourceId, rank: 1, damage: 35 });
  await page.screenshot({ path: info.outputPath('ahri-bot-orb-flight.png') });
  const hits = await page.evaluate(({ sourceId }) => {
    const g = (window as any).__GAME__,
      w = g.world,
      copy = w.constructor.fromSnapshot(w.snapshot(), w.battlefield),
      outward = new Set<number>(),
      returning = new Set<number>();
    for (let i = 0; i < 180; i++) {
      w.step();
      copy.step();
      for (const orb of w.ahriOrbs.filter((o: any) => o.sourceId === sourceId)) {
        orb.outwardHits.forEach((id: number) => outward.add(id));
        orb.returnHits.forEach((id: number) => returning.add(id));
      }
    }
    return {
      outward: [...outward],
      returning: [...returning],
      sameFuture: copy.snapshot() === w.snapshot(),
    };
  }, start);
  expect(hits.outward).toContain(start.targetId);
  expect(hits.returning).toContain(start.targetId);
  expect(hits.sameFuture).toBe(true);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('ahri-bot-orb.json'),
    JSON.stringify({ start, flight, hits, errors }, null, 2)
  );
});
