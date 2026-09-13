import { expect, test } from '@playwright/test';

test('queued Lux W renders its source cast, outbound and return flight, and both self shields', async ({
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
    Object.assign(w.hero, { x: -500, y: -500, previous: { x: -500, y: -500 } });
    w.setOrder(w.hero, { type: 'idle' });
    const lux = w.spawn('champion', 'blue', { x: 0, y: 0 }, 'lux');
    w.spawn('champion', 'blue', { x: 500, y: 0 });
    w.enqueue({ type: 'cast', unit: lux.id, ability: 'w', point: { x: 1000, y: 0 } });
    w.step(8);
    g.view.render(w, 1, performance.now() / 1000);
    const model = g.view.models.get(lux.id);
    const cast = {
      action: model.actionName,
      time: model.actions.spell2.time,
      shield: w.shieldAmount(lux),
    };
    w.step(30);
    g.view.render(w, 1, performance.now() / 1000);
    const p = w.projectiles[0];
    const outbound = {
      phase: p.prismatic.phase,
      x: p.x,
      visible: g.view.projectileModels.get(p.id).visible,
    };
    w.step(65);
    g.view.render(w, 1, performance.now() / 1000);
    const returning = {
      phase: p.prismatic.phase,
      direction: p.direction.x,
      visible: g.view.projectileModels.get(p.id).visible,
    };
    w.step(47);
    g.view.render(w, 1, performance.now() / 1000);
    return {
      cast,
      outbound,
      returning,
      shield: w.shieldAmount(lux),
      remaining: w.projectiles.length,
    };
  });
  expect(result.cast.action).toBe('spell2');
  expect(result.cast.time).toBeGreaterThan(0);
  expect(result.cast.shield).toBe(40);
  expect(result.outbound.phase).toBe('out');
  expect(result.outbound.x).toBeGreaterThan(0);
  expect(result.outbound.visible).toBe(true);
  expect(result.returning).toEqual({ phase: 'return', direction: -1, visible: true });
  expect(result.shield).toBe(80);
  expect(result.remaining).toBe(0);
  await page.screenshot({ path: 'artifacts/lux-w-shields.png' });
  expect(errors).toEqual([]);
});
