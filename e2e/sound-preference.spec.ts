import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('muting and unmuting survive real game reloads without opening audio on startup', async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const ready = async () => {
    await page.waitForFunction(() => (window as any).__GAME__?.ready);
    await page.locator('#loading').waitFor({ state: 'detached' });
    if (await page.evaluate(() => (window as any).__GAME__.hud.modal === 'pause'))
      await page.keyboard.press('Escape');
    await page.evaluate(() => (window as any).__GAME__.setPaused(true));
  };
  const read = () =>
    page.evaluate(() => {
      const g = (window as any).__GAME__;
      return {
        sound: g.hud.sound,
        enabled: g.audio.enabled,
        context: g.audio.context?.state ?? null,
        preference: localStorage.getItem('browser-moba.sound.v1'),
      };
    });
  await page.goto('/?scene=fixture');
  await ready();
  const initial = await read();
  expect(initial).toEqual({ sound: true, enabled: true, context: null, preference: null });
  const snapshot = await page.evaluate(() => (window as any).__GAME__.world.snapshot());
  await page.getByRole('button', { name: 'Toggle sound', exact: true }).click();
  const muted = await read();
  expect(muted.sound).toBe(false);
  expect(muted.enabled).toBe(false);
  expect(muted.preference).toBe('muted');
  expect(await page.evaluate(() => (window as any).__GAME__.world.snapshot())).toBe(snapshot);
  await page.reload();
  await ready();
  const restoredMuted = await read();
  expect(restoredMuted).toEqual({
    sound: false,
    enabled: false,
    context: null,
    preference: 'muted',
  });
  const sound = page.getByRole('button', { name: 'Toggle sound', exact: true });
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  await expect(sound).toHaveAttribute('title', 'Unmute sound');
  await sound.click();
  const unmuted = await read();
  expect(unmuted.sound).toBe(true);
  expect(unmuted.enabled).toBe(true);
  expect(unmuted.preference).toBe('enabled');
  await page.reload();
  await ready();
  const restoredEnabled = await read();
  expect(restoredEnabled).toEqual({
    sound: true,
    enabled: true,
    context: null,
    preference: 'enabled',
  });
  await expect(page.getByRole('button', { name: 'Toggle sound', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(errors).toEqual([]);
  writeFileSync(
    info.outputPath('sound-preference-reloads.json'),
    JSON.stringify({ initial, muted, restoredMuted, unmuted, restoredEnabled, errors }, null, 2) +
      '\n'
  );
});
