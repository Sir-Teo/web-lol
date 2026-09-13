import { expect, test } from '@playwright/test';

test('threatened bot casts defensive Heal while stunned using its own cooldown', async ({
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
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 } });
    const bot = w.spawn('champion', 'red', { x: 300, y: 0 });
    bot.ai = true;
    bot.hp = 100;
    bot.stunUntil = w.tick + 100;
    w.step(2);
    g.view.render(w, 1, 0);
    g.hud.update(60);
    return {
      hp: bot.hp,
      cast: w.events.some((e: any) => e.type === 'cast' && e.unit === bot.id && e.text === 'f'),
      cooldown: w.abilityCooldownTicks('f', bot.id),
      humanCooldown: w.abilityCooldownTicks('f'),
      speedUntil: bot.summonerHealSpeedUntil,
      tick: w.tick,
      x: bot.x,
      y: bot.y,
    };
  });
  expect(result.cast).toBe(true);
  expect(result.hp).toBeGreaterThan(180);
  expect(result.cooldown).toBe(14400);
  expect(result.humanCooldown).toBe(0);
  expect(result.speedUntil).toBe(result.tick + 60);
  expect([result.x, result.y]).toEqual([300, 0]);
});
