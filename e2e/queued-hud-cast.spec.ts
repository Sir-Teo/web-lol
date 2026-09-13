import { expect, test } from '@playwright/test';

test('a HUD Heal queued between simulation steps can be saved and restored', async ({ page }) => {
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    g.advanceForTest = g.world.step.bind(g.world);
    // Keep the UI live while holding the simulation between command dispatch and execution.
    g.world.step = () => {};
    g.world.hero.hp = 100;
    g.world.commands = [];
  });
  await page.locator('[data-ability="f"]').click();
  const result = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    const queued = w.commands.map((command: any) => ({ ...command }));
    const saved = w.snapshot();
    const restored = w.constructor.fromSnapshot(saved, w.battlefield);
    g.advanceForTest();
    restored.step();
    const result = {
      queued,
      same: restored.snapshot() === w.snapshot(),
      hp: w.hero.hp,
      cooldown: w.player.cooldowns.f - w.tick,
    };
    w.step = g.advanceForTest;
    delete g.advanceForTest;
    return result;
  });
  expect(result.queued).toHaveLength(1);
  expect(result.queued[0].type).toBe('cast');
  expect(result.queued[0].ability).toBe('f');
  expect(Object.keys(result.queued[0].point).sort()).toEqual(['x', 'y']);
  expect(result.same).toBe(true);
  expect(result.hp).toBeGreaterThan(100);
  expect(result.cooldown).toBe(240 * 60);
});
