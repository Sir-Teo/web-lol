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

test('accepted Heal survives pause, save, browser reload and explicit resume exactly', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__;
    // Hold a real UI command between dispatch and its next fixed simulation step.
    g.world.step = () => {};
    g.world.hero.hp = 100;
    g.world.commands = [];
  });
  await page.locator('[data-ability="f"]').click();
  const checkpoint = await page.evaluate(() => {
    const w = (window as any).__GAME__.world;
    const saved = w.snapshot();
    const uninterrupted = w.constructor.fromSnapshot(saved, w.battlefield);
    uninterrupted.step();
    return { saved, continued: uninterrupted.snapshot(), queued: w.commands.length };
  });
  expect(checkpoint.queued).toBe(1);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(
    checkpoint.saved
  );
  await page.getByRole('button', { name: 'Save match', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('Match saved on this browser.');
  await page.reload();
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  await expect(page.getByRole('heading', { name: 'Game paused' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(
    checkpoint.saved
  );
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(
    checkpoint.saved
  );
  await page.screenshot({ path: 'artifacts/queued-cast-restored.png' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world,
      step = w.step;
    w.step = function (...args: any[]) {
      const result = step.apply(this, args);
      if (!g.firstResumedSnapshot) {
        g.firstResumedSnapshot = this.snapshot();
        g.firstResumedHP = this.hero.hp;
        g.firstResumedCommands = this.commands.length;
      }
      return result;
    };
  });
  await page.getByRole('button', { name: 'Return to the Rift', exact: true }).click();
  await page.waitForFunction(() => !!(window as any).__GAME__.firstResumedSnapshot);
  const resumed = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    return {
      snapshot: g.firstResumedSnapshot,
      hp: g.firstResumedHP,
      commands: g.firstResumedCommands,
    };
  });
  expect(resumed.snapshot).toBe(checkpoint.continued);
  expect(resumed.hp).toBeGreaterThan(100);
  expect(resumed.commands).toBe(0);
  expect(errors).toEqual([]);
});
