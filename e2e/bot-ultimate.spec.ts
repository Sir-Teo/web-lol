import { expect, test } from '@playwright/test';

test('bot ultimate uses its source cast animation and finishes a visible opponent', async ({
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
    w.nextWaveTick = Infinity;
    for (const u of w.units) {
      u.ai = false;
      w.setOrder(u, { type: 'idle' });
    }
    w.battlefield.lineOfSight = () => true;
    Object.assign(w.hero, { x: 0, y: 0, previous: { x: 0, y: 0 }, hp: 100 });
    const bot = w.spawn('champion', 'red', { x: 900, y: 0 });
    bot.ai = true;
    w.step(2);
    g.view.render(w, 1, performance.now() / 1000);
    const clip = g.view.models.get(bot.id).actionName;
    const state = w.championState(bot.id);
    const pending = state.pendingCast?.ability;
    w.step(15);
    const projectile = w.projectiles.some((p: any) => p.source === bot.id && p.type === 'ultimate');
    w.step(90);
    g.view.render(w, 1, performance.now() / 1000);
    return {
      clip,
      pending,
      projectile,
      killed: w.hero.hp === 0,
      kills: state.kills,
      cooldown: w.abilityCooldownTicks('r', bot.id),
      humanCooldown: w.abilityCooldownTicks('r'),
    };
  });
  expect(result.clip).toBe('spell4');
  expect(result.pending).toBe('r');
  expect(result.projectile).toBe(true);
  expect(result.killed).toBe(true);
  expect(result.kills).toBe(1);
  expect(result.cooldown).toBeGreaterThan(0);
  expect(result.humanCooldown).toBe(0);
  expect(errors).toEqual([]);
});
