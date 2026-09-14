import { expect, test } from '@playwright/test';

test('an outnumbered bot creates distance and resumes fighting with allied support', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
    w.hero.x = -2500;
    w.hero.y = -2500;
    w.battlefield.lineOfSight = () => true;
    const bot = w.spawn('champion', 'blue', { x: 0, y: 0 });
    bot.ai = true;
    w.spawn('champion', 'red', { x: 450, y: -100 });
    w.spawn('champion', 'red', { x: 450, y: 100 });
    w.step(12);
    const escape = { order: bot.order.type, x: bot.x, retreating: bot.aiRetreating };
    w.spawn('champion', 'blue', { x: -100, y: 0 });
    bot.nextThink = w.tick + 1;
    w.step();
    g.view.recenter(bot);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return { escape, supported: bot.order.type, windup: bot.releaseTick !== null };
  });
  expect(result.escape.order).toBe('move');
  expect(result.escape.x).toBeLessThan(-20);
  expect(result.escape.retreating).toBe(false);
  expect(result.supported).toBe('attack');
  expect(result.windup).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/browser-bot-disengage.png' });
});
