import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
for (const mode of ['lanes', 'practice'] as const)
  test(`pending ${mode} start retains dialog focus and returns to a usable paused match on failure`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?scene=fixture');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    const snapshot = await page.evaluate(() => {
      const g = (window as any).__GAME__;
      g.world.step = () => {};
      g.world.commands = [];
      g.view.render(g.world, 1, g.view.previousElapsed);
      g.view.renderer.setAnimationLoop(null);
      g.hud.actions.startMatch = (...args: any[]) =>
        new Promise<void>((_, reject) => {
          (window as any).__START_ATTEMPT__ = {
            args,
            reject: () => reject(new Error('Start fixture write rejected')),
          };
        });
      g.hud.toggleModal('new-match');
      return g.world.snapshot();
    });
    await page.getByRole('button', { name: 'Lux', exact: true }).click();
    const start = page.getByRole('button', {
      name: mode === 'lanes' ? 'Start 5v5 match' : 'Start practice',
      exact: true,
    });
    await start.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    try {
      await expect(dialog.locator('button:not([disabled])')).toHaveCount(0);
      await expect(dialog).toBeFocused();
      await expect(dialog.getByRole('status')).toHaveText('Starting match…');
      for (const key of ['Tab', 'Shift+Tab', 'Tab']) {
        await page.keyboard.press(key);
        await expect(dialog).toBeFocused();
      }
      expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(snapshot);
      expect(await page.evaluate(() => (window as any).__START_ATTEMPT__.args)).toEqual([
        mode,
        'lux',
        { d: 'flash', f: 'heal' },
      ]);
    } finally {
      await page.evaluate(() => (window as any).__START_ATTEMPT__?.reject());
    }
    await expect(page.getByRole('heading', { name: 'Game paused', exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveText('Start fixture write rejected');
    const resume = page.getByRole('button', { name: 'Return to the Rift', exact: true });
    await expect(resume).toBeEnabled();
    await expect(dialog).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Close menu', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(resume).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Save match', exact: true })).toBeFocused();
    expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(snapshot);
    expect(await page.evaluate(() => (window as any).__GAME__.world.commands)).toEqual([]);
    expect(errors).toEqual([]);
    writeFileSync(
      info.outputPath('match-start-focus.json'),
      JSON.stringify(
        {
          mode,
          pendingFocusRetained: true,
          pendingStatusAnnounced: true,
          failureFocusRestored: true,
          worldUnchanged: true,
          errors,
        },
        null,
        2
      ) + '\n'
    );
  });
