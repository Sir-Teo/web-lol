import { expect, test } from '@playwright/test';

test('close-range sparring bot releases repeated attacks and preserves a paused windup', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.nextWaveTick = Infinity;
    w.units = [w.hero];
    w.hero.x = 0;
    w.hero.y = 0;
    w.hero.previous = { x: 0, y: 0 };
    w.hero.maxHp = w.hero.hp = 10000;
    w.hero.speed = 400;
    const bot = w.spawn('champion', 'red', { x: 250, y: 0 });
    bot.ai = true;
    w.step();
    const initial = {
      order: bot.order.type,
      release: bot.releaseTick,
      attackTarget: bot.attackTarget,
    };
    const paused = w.snapshot();
    g.view.recenter(w.hero);
    g.view.render(w, 1, 0);
    g.view.render(w, 1, 10);
    const unchanged = w.snapshot() === paused;
    const releases = new Set();
    let recoveryMoves = 0;
    for (let i = 0; i < 360; i++) {
      if (i % 6 === 0)
        w.enqueue({
          type: 'order',
          unit: w.hero.id,
          order: { type: 'move', point: { x: bot.x, y: bot.y } },
        });
      w.step();
      for (const e of w.events) if (e.type === 'attack' && e.unit === bot.id) releases.add(e.tick);
      if (bot.order.type === 'move' && bot.releaseTick === null && w.tick < bot.nextAttackTick)
        recoveryMoves++;
    }
    g.view.recenter(bot);
    g.view.render(w, 1, 0);
    g.hud.update(60);
    return {
      initial,
      unchanged,
      attacks: releases.size,
      recoveryMoves,
      damage: w.hero.maxHp - w.hero.hp,
      hero: w.hero.id,
    };
  });
  expect(result.initial.order).toBe('attack');
  expect(result.initial.release).not.toBeNull();
  expect(result.initial.attackTarget).toBe(result.hero);
  expect(result.unchanged).toBe(true);
  expect(result.attacks).toBeGreaterThanOrEqual(3);
  expect(result.recoveryMoves).toBeGreaterThan(15);
  expect(result.damage).toBeGreaterThan(0);
  await page.screenshot({ path: 'artifacts/browser-bot-kiting.png' });
});
