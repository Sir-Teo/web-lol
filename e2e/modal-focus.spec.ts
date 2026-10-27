import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
for (const kind of ['offline', 'graphics'] as const)
  test(`${kind} dialog traverses from its initial container focus in both directions`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?scene=fixture');
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    await page.evaluate((kind) => {
      const g = (window as any).__GAME__;
      // Inspect actual modal focus after a complete first scene. Graphics state
      // is a HUD fixture here; this is not a WebGL context recovery test.
      g.world.step = () => {};
      g.world.commands = [];
      g.view.render(g.world, 1, g.view.previousElapsed);
      g.view.renderer.setAnimationLoop(null);
      if (kind === 'graphics') g.hud.setGraphicsState('lost');
      else g.hud.toggleModal('offline');
    }, kind);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeFocused();
    const available = dialog.locator('button:not([disabled]):not([hidden])');
    const count = await available.count();
    expect(count).toBeGreaterThan(1);
    await page.keyboard.press('Shift+Tab');
    await expect(available.last()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(available.first()).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(available.last()).toBeFocused();
    await dialog.focus();
    await page.keyboard.press('Tab');
    await expect(available.first()).toBeFocused();
    for (let i = 1; i < count; i++) {
      await page.keyboard.press('Tab');
      await expect(available.nth(i)).toBeFocused();
    }
    await page.keyboard.press('Tab');
    await expect(available.first()).toBeFocused();
    const commands = await page.evaluate(() => (window as any).__GAME__.world.commands);
    expect(commands).toEqual([]);
    expect(errors).toEqual([]);
    writeFileSync(
      info.outputPath('modal-focus.json'),
      JSON.stringify({ kind, count, commands, errors }, null, 2) + '\n'
    );
  });
