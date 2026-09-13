import { expect, test } from '@playwright/test';

test('Lux bot shields an ally, binds and detonates E through normal queued casts', async ({
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
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    Object.assign(w.hero, { x: -300, y: -300, previous: { x: -300, y: -300 } });
    w.setOrder(w.hero, { type: 'idle' });
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    const ally = w.spawn('champion', 'blue', { x: 250, y: 0 });
    ally.hp = ally.maxHp * 0.4;
    const enemy = w.spawn('champion', 'red', { x: 800, y: 0 });
    enemy.hp = enemy.maxHp = 10000;
    lux.ai = true;
    lux.nextThink = 0;
    w.championState(lux.id).cooldowns.f = Infinity;
    // At x=800 the target is inside the fixture's brush. Lux must not react to it.
    w.step(18);
    const hiddenCasts = w.events.filter(
      (event: any) => event.type === 'cast' && event.unit === lux.id
    ).length;
    enemy.x = 400;
    const casts = new Set<string>();
    let shielded = false,
      bound = false,
      detonated = false;
    for (let tick = 0; tick < 240; tick++) {
      w.step();
      for (const event of w.events)
        if (event.type === 'cast' && event.unit === lux.id) casts.add(event.text);
      shielded ||= w.shieldAmount(ally) > 0;
      bound ||= enemy.rootUntil > w.tick;
      detonated ||= w.singularities.some(
        (z: any) => z.sourceId === lux.id && z.detonatedTick !== null
      );
      g.view.render(w, 1, performance.now() / 1000);
    }
    return {
      casts: [...casts].sort(),
      hiddenCasts,
      shielded,
      bound,
      detonated,
      damaged: enemy.hp < enemy.maxHp,
      mana: lux.mana,
    };
  });
  expect(result.hiddenCasts).toBe(0);
  expect(result.casts).toEqual(['e', 'q', 'w']);
  expect(result.shielded).toBe(true);
  expect(result.bound).toBe(true);
  expect(result.detonated).toBe(true);
  expect(result.damaged).toBe(true);
  expect(result.mana).toBeGreaterThanOrEqual(0);
  await page.screenshot({ path: 'artifacts/lux-bot-encounter.png' });
  expect(errors).toEqual([]);
});
