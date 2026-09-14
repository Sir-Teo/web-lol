import { expect, test } from '@playwright/test';

test('Courage protects Garen from a queued Lux binding and preserves its independent timers', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.pendingSpawns = [];
    w.nextWaveTick = Infinity;
    Object.assign(w.hero, { x: 0, y: -500, previous: { x: 0, y: -500 } });
    w.battlefield.lineOfSight = () => true;
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    const garen = w.spawn('champion', 'red', { x: 300, y: 0 }, 'garen');
    w.learnSpell('q', lux.id);
    w.learnSpell('w', garen.id);
    w.enqueue({ type: 'cast', unit: garen.id, ability: 'w', point: { x: 300, y: 0 } });
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'q', point: { x: 1000, y: 0 } });
    let steps = 0;
    while (!garen.rootUntil && steps++ < 100) w.step();
    const contactTick = w.tick;
    const courage = w.championState(garen.id).garenW;
    const contact = {
      rootTicks: garen.rootUntil - contactTick,
      shield: w.shieldAmount(garen),
      hp: garen.hp,
      maxHp: garen.maxHp,
      upfrontActive: contactTick < courage.upfrontUntil,
    };
    const restored = w.constructor.fromSnapshot(w.snapshot(), w.battlefield);
    const remaining = courage.upfrontUntil - contactTick;
    w.step(remaining);
    restored.step(remaining);
    g.view.recenter(garen);
    g.view.render(w, 1, g.view.previousElapsed);
    g.hud.update(60);
    return {
      contact,
      shieldAfter: w.shieldAmount(garen),
      defenseRemaining: courage.defenseUntil - w.tick,
      savedEqual: restored.snapshot() === w.snapshot(),
      rootRemaining: garen.rootUntil - w.tick,
    };
  });
  expect(result.contact.upfrontActive).toBe(true);
  expect(result.contact.rootTicks).toBe(48);
  expect(result.contact.shield).toBeGreaterThan(0);
  expect(result.contact.hp).toBe(result.contact.maxHp);
  expect(result.shieldAfter).toBe(0);
  expect(result.defenseRemaining).toBe(195);
  expect(result.rootRemaining).toBeGreaterThan(0);
  expect(result.savedEqual).toBe(true);
  await page.screenshot({ path: 'artifacts/browser-garen-courage-binding.png' });
  expect(errors).toEqual([]);
});
