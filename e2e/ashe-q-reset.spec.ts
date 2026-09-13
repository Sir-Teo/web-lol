import { expect, test } from '@playwright/test';

test('Q replaces attack recovery with a new empowered animation without consuming the flying arrow', async ({
  page,
}) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      v = g.view;
    g.setPaused(true);
    w.nextWaveTick = 1e9;
    for (const u of w.units) u.ai = false;
    const target = w.spawn('dummy', 'red', { x: w.hero.x + 600, y: w.hero.y });
    w.player.qStacks = 3;
    w.player.qStackExpiry = w.tick + 240;
    w.setOrder(w.hero, { type: 'attack', target: target.id });
    w.step();
    w.step(w.hero.releaseTick - w.tick);
    v.render(w, 1, v.previousElapsed + 0.1);
    const previous = { ...w.hero.attackCycle };
    const arrow = w.projectiles.find((p: any) => p.type === 'attack');
    const beforeClip = v.models.get(w.hero.id).actionName;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.step();
    v.render(w, 1, v.previousElapsed + 0.1);
    const model = v.models.get(w.hero.id);
    const reset = {
      start: w.hero.attackCycle.startTick,
      tick: w.tick,
      clip: model.actionName,
      phase: model.actions.spell1.time,
      flyingArrow: w.projectiles.some((p: any) => p.id === arrow.id),
      release: w.hero.releaseTick,
    };
    w.step(8);
    v.render(w, 1, v.previousElapsed + 0.1);
    const phase = model.actions.spell1.time;
    w.enqueue({ type: 'cast', unit: w.hero.id, ability: 'q', point: w.hero });
    w.step(); // Rejected: Q's four stacks were consumed by the first activation.
    v.render(w, 1, v.previousElapsed + 0.1);
    v.zoom = 0.6;
    v.recenter(w.hero);
    v.resize();
    return {
      previous,
      beforeClip,
      reset,
      phase,
      afterRejected: { start: w.hero.attackCycle.startTick, phase: model.actions.spell1.time },
    };
  });
  expect(result.beforeClip).toBe('attack1');
  expect(result.reset.start).toBe(result.reset.tick);
  expect(result.reset.start).toBeLessThan(result.previous.endTick);
  expect(result.reset.clip).toBe('spell1');
  expect(result.reset.phase).toBe(0);
  expect(result.reset.flyingArrow).toBe(true);
  expect(result.reset.release).toBe(result.reset.tick + 17);
  expect(result.afterRejected.start).toBe(result.reset.start);
  expect(result.afterRejected.phase).toBeGreaterThan(result.phase);
  await page.screenshot({ path: 'artifacts/browser-ashe-q-reset.png' });
});
