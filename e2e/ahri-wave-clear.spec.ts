import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('Ahri chooses a paid wave Q, renders its outbound orb and farms after actual Save/reload', async ({
  page,
}, info) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture&npc=ahri', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 180000 });
  await page.locator('#loading').waitFor({ state: 'detached' });
  const start = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.hud.closeModal();
    g.setPaused(true);
    const bot = w.units.find((u: any) => u.champion === 'ahri');
    w.units = [w.hero, bot];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    w.hero.x = w.hero.y = -3000;
    bot.x = -650;
    bot.y = 350;
    w.setOrder(bot, { type: 'idle' });
    bot.ai = true;
    bot.nextThink = 0;
    const state = w.championState(bot.id);
    state.cooldowns.q = 0;
    state.cooldowns.d = state.cooldowns.f = Infinity;
    const targets = [700, 800, 900].map((dx) => {
      const m = w.spawn('caster', 'red', { x: bot.x + dx, y: bot.y });
      m.ai = false;
      m.hp = 50;
      m.magicResist = 0;
      return m.id;
    });
    const mana = bot.mana;
    w.step();
    const commands = structuredClone(w.commands);
    w.step();
    g.view.zoom = 0.6;
    g.view.recenter(bot);
    g.view.render(w, 1, g.view.previousElapsed);
    return {
      sourceId: bot.id,
      targets,
      commands,
      rank: state.spellRanks.q,
      pending: structuredClone(state.pendingCast),
      clip: g.view.models.get(bot.id).actionName,
      manaBefore: mana,
      manaAfter: bot.mana,
    };
  });
  expect(start.rank).toBe(1);
  expect(start.commands).toMatchObject([{ ability: 'q', unit: start.sourceId }]);
  expect(start.pending).toMatchObject({ ability: 'q', rank: 1, damage: 35 });
  expect(start.clip).toBe('spell1');
  expect(start.manaAfter).toBeLessThan(start.manaBefore);
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
      orb: structuredClone(w.ahriOrbs.find((o: any) => o.sourceId === sourceId)),
      markers: [...g.view.projectileModels.values()].map((m: any) => m.name),
    };
  }, start);
  expect(flight.orb).toMatchObject({ sourceId: start.sourceId, rank: 1, damage: 35 });
  expect(flight.markers.length).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('ahri-wave-orb.png') });
  await page.locator('#pause-button').click();
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window as any).__GAME__?.ready, null, { timeout: 180000 });
  await page.locator('#loading').waitFor({ state: 'detached' });
  const restored = await page.evaluate(
    ({ sourceId, targets, tick }) => {
      const g = (window as any).__GAME__,
        w = g.world,
        saved = w.snapshot();
      g.hud.closeModal();
      g.setPaused(true);
      const outward = new Set<number>(),
        returning = new Set<number>();
      while (w.tick < tick + 180) {
        w.step();
        for (const orb of w.ahriOrbs) {
          orb.outwardHits.forEach((id: number) => outward.add(id));
          orb.returnHits.forEach((id: number) => returning.add(id));
        }
      }
      g.view.render(w, 1, g.view.previousElapsed);
      return {
        saved,
        future: w.snapshot(),
        cs: w.championState(sourceId).cs,
        dead: targets.map((id) => !w.alive(w.unit(id))),
        outward: [...outward],
        returning: [...returning],
        ai: w.unit(sourceId).ai,
        paused: g.hud.paused,
      };
    },
    { sourceId: start.sourceId, targets: start.targets, tick: flight.tick }
  );
  expect(restored.saved).toBe(flight.saved);
  expect(restored.future).toBe(flight.future);
  expect(restored.cs).toBe(3);
  expect(restored.dead).toEqual([true, true, true]);
  for (const id of start.targets) {
    expect(restored.outward).toContain(id);
  }
  expect(restored.returning.length).toBeGreaterThan(0);
  expect(restored.ai).toBe(true);
  expect(restored.paused).toBe(true);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('ahri-wave-clear.json'),
    JSON.stringify({ start, flight, restored, errors }, null, 2)
  );
});
