import { expect, test } from '@playwright/test';
test('silence shows on the champion and blocks real spell input until expiry', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const id = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    w.units = [w.hero];
    w.nextWaveTick = Infinity;
    w.pendingSpawns = [];
    w.applySilence(w.hero, 90);
    g.view.recenter(w.hero);
    g.view.render(w, 1, g.view.previousElapsed);
    return w.hero.id;
  });
  await expect(page.locator(`.unit-bar[data-unit="${id}"] .unit-status`)).toHaveText('SILENCED');
  await page.mouse.move(900, 350);
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.down('w');
  await page.keyboard.up('w');
  await page.waitForFunction(() =>
    (window as any).__GAME__.world.events.some((e: any) => e.text === 'Cannot cast while silenced')
  );
  const blocked = await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    g.setPaused(true);
    g.hud.update(60);
    return {
      pending: w.player.pendingCast,
      cooldown: w.player.cooldowns.w,
      messages: w.events.filter((e: any) => e.type === 'message').map((e: any) => e.text),
    };
  });
  expect(blocked.pending).toBeNull();
  expect(blocked.cooldown).toBe(0);
  expect(blocked.messages).toContain('Cannot cast while silenced');
  await page.screenshot({ path: 'artifacts/browser-silence.png' });
  await page.evaluate(() => {
    const g = (window as any).__GAME__,
      w = g.world;
    w.step(w.hero.silenceUntil - w.tick);
    g.view.render(w, 1, g.view.previousElapsed);
  });
  await expect(page.locator(`.unit-bar[data-unit="${id}"] .unit-status`)).toHaveText('');
  await page.evaluate(() => (window as any).__GAME__.setPaused(false));
  await page.keyboard.down('w');
  await page.keyboard.up('w');
  await page.waitForFunction(() => (window as any).__GAME__.world.player.cooldowns.w > 0);
  expect(
    await page.evaluate(() => {
      const w = (window as any).__GAME__.world;
      return w.player.cooldowns.w > 0;
    })
  ).toBe(true);
  expect(errors).toEqual([]);
});
