import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
test('pending match import keeps keyboard focus in its dialog and restores the load control on failure', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=fixture');
  await page.waitForFunction(() => (window as any).__GAME__?.ready);
  await page.locator('#loading').waitFor({ state: 'detached' });
  const snapshot = await page.evaluate(() => {
    const g = (window as any).__GAME__;
    // The real import UI is under test; retain a complete first scene, then
    // freeze rendering/steps while a controlled load failure holds the dialog.
    g.world.step = () => {};
    g.world.commands = [];
    g.view.render(g.world, 1, g.view.previousElapsed);
    g.view.renderer.setAnimationLoop(null);
    const prepare = g.hud.actions.prepareImport;
    g.hud.actions.prepareImport = async (file: File) => {
      const candidate = await prepare(file);
      return {
        ...candidate,
        load: () =>
          new Promise<void>((_, reject) => {
            (window as any).__REJECT_IMPORT__ = () =>
              reject(new Error('Focus fixture write rejected'));
          }),
      };
    };
    g.hud.toggleModal('files');
    return g.world.snapshot();
  });
  await page
    .getByLabel('Match file', { exact: true })
    .setInputFiles({
      name: 'focus.match.json',
      mimeType: 'application/json',
      buffer: Buffer.from(snapshot),
    });
  const load = page.getByRole('button', { name: 'Load this match', exact: true });
  await expect(load).toBeFocused();
  await load.click();
  await expect(page.locator('.file-status')).toHaveText('Loading match…');
  const dialog = page.getByRole('dialog');
  try {
    await expect(dialog.locator('button:not([disabled])')).toHaveCount(0);
    await expect(dialog).toBeFocused();
    for (const key of ['Tab', 'Shift+Tab', 'Tab']) {
      await page.keyboard.press(key);
      await expect(dialog).toBeFocused();
    }
    expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(snapshot);
  } finally {
    await page.evaluate(() => (window as any).__REJECT_IMPORT__?.());
  }
  await expect(page.locator('.file-status')).toHaveText('Focus fixture write rejected');
  await expect(load).toBeEnabled();
  await expect(load).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Back to pause menu', exact: true })).toBeFocused();
  expect(await page.evaluate(() => (window as any).__GAME__.world.commands)).toEqual([]);
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('import-focus.json'),
    JSON.stringify(
      { pendingFocusRetained: true, failureFocusRestored: true, commands: [], errors },
      null,
      2
    ) + '\n'
  );
});
