import { expect, test } from '@playwright/test';

test('sparring bot autonomously casts Volley at a visible distant champion', async ({ page }) => {
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
    const bot = w.spawn('champion', 'red', { x: 900, y: 0 });
    bot.ai = true;
    w.step(2);
    g.view.render(w, 1, 0);
    const clip = g.view.models.get(bot.id).actionName;
    const pending = w.championState(bot.id).pendingCast?.ability;
    for (let i = 0; i < 90 && !w.hero.criticalSlow; i++) w.step();
    g.view.render(w, 1, 0);
    return {
      clip,
      pending,
      damage: w.hero.maxHp - w.hero.hp,
      slow: w.hero.criticalSlow,
      cooldown: w.abilityCooldownTicks('w', bot.id),
      humanCooldown: w.abilityCooldownTicks('w'),
    };
  });
  expect(result.clip).toBe('spell2');
  expect(result.pending).toBe('w');
  expect(result.damage).toBeGreaterThan(0);
  expect(result.slow).not.toBeNull();
  expect(result.cooldown).toBeGreaterThan(0);
  expect(result.humanCooldown).toBe(0);
});
