import { expect, test } from '@playwright/test';

test('offline Ashe bot completes its crit item and exposes it through normal scoreboard inspection', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    const bot = w.spawn('champion', 'blue', w.battlefield.spawns.blue, 'ashe');
    bot.ai = true;
    bot.speed = 0;
    const state = w.championState(bot.id);
    state.gold = 4250;
    w.step();
    const checkpoint = w.snapshot();
    w.step(120);
    const expected = w.snapshot();
    Object.assign(w, w.constructor.fromSnapshot(checkpoint, w.battlefield));
    w.step(120);
    g.hud.scoreboard(true);
    const current = w.championState(bot.id);
    return {
      id: bot.id,
      inventory: current.inventory,
      gold: current.gold,
      expected,
      actual: w.snapshot(),
      chance: w.criticalChance(w.unit(bot.id)),
    };
  });
  expect(result.inventory.filter(Boolean)).toEqual(['blade', 'boots', 'infinity-edge']);
  expect(result.gold).toBe(0);
  expect(result.chance).toBe(0.25);
  expect(result.actual).toBe(result.expected);
  const item = page.locator(`[data-item-key="${result.id}:2"]`);
  await item.hover();
  await expect(page.locator('#scoreboard-item-tooltip strong')).toHaveText('Infinity Edge');
  await expect(page.locator('#scoreboard-item-tooltip p')).toContainText(
    '+30% Critical Strike Damage'
  );
  await page.screenshot({ path: 'artifacts/bot-infinity-edge.png' });
});
